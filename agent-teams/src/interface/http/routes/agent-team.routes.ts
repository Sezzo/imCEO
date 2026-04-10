import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateTeamSchema = z.object({
  team_name: z.string().min(1),
  description: z.string().optional(),
  agent_type: z.string().optional(),
});

const CreateTaskSchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  activeForm: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  blockedBy: z.array(z.string()).optional(),
});

const UpdateTaskSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).optional(),
  owner: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const SendMessageSchema = z.object({
  to: z.string().min(1),
  summary: z.string().optional(),
  message: z.union([z.string(), z.record(z.unknown())]),
});

const SpawnAgentSchema = z.object({
  description: z.string().min(1),
  prompt: z.string().min(1),
  name: z.string().min(1),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
  mode: z.enum(['default', 'plan', 'bypassPermissions']).optional(),
  subagent_type: z.string().optional(),
});

// ============================================================================
// Route Handlers
// ============================================================================

export async function agentTeamRoutes(fastify: FastifyInstance) {
  // ============================================================================
  // Team Management
  // ============================================================================

  /**
   * POST /teams - Create a new team
   */
  fastify.post('/teams', async (request, reply) => {
    const prisma = request.server.prisma;
    const webSocket = request.server.agentTeamWebSocket;

    const parseResult = CreateTeamSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { team_name, description, agent_type } = parseResult.data;
    const session = request.session;

    try {
      // Check if already leading a team
      const existingTeam = await prisma.agentTeam.findFirst({
        where: { leadAgentId: session.agentId },
      });

      if (existingTeam) {
        return reply.status(409).send({
          error: `Already leading team "${existingTeam.teamName}"`,
          existingTeam: {
            teamId: existingTeam.teamId,
            teamName: existingTeam.teamName,
          },
        });
      }

      // Generate unique team name
      const finalTeamName = await generateUniqueTeamName(team_name, prisma);
      const leadAgentId = `team-lead@${finalTeamName.replace(/[^a-z0-9-]/g, '-')}`;

      // Create team
      const team = await prisma.agentTeam.create({
        data: {
          teamName: finalTeamName,
          description,
          companyId: session.companyId,
          leadAgentId,
          leadSessionId: session.sessionId,
          currentState: 'active',
          metadata: {
            createdBy: session.agentId,
            createdByName: session.agentName,
          },
          members: {
            create: [
              {
                agentId: leadAgentId,
                name: 'team-lead',
                agentType: agent_type || 'team-lead',
                color: '#FF6B6B',
                backendType: 'in_process',
                isActive: true,
                isLeader: true,
                planModeRequired: false,
              },
            ],
          },
        },
      });

      // Publish event
      await webSocket.publishToTeam(finalTeamName, 'team:created', {
        teamId: team.teamId,
        teamName: finalTeamName,
        leadAgentId,
        timestamp: new Date().toISOString(),
      });

      return reply.status(201).send({
        success: true,
        data: {
          team_name: finalTeamName,
          team_id: team.teamId,
          lead_agent_id: leadAgentId,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to create team',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /teams/:teamId - Get team details
   */
  fastify.get('/teams/:teamId', async (request, reply) => {
    const prisma = request.server.prisma;
    const { teamId } = request.params as { teamId: string };

    try {
      const team = await prisma.agentTeam.findUnique({
        where: { teamId },
        include: {
          members: {
            select: {
              agentId: true,
              name: true,
              agentType: true,
              color: true,
              isActive: true,
              isLeader: true,
              joinedAt: true,
            },
          },
          _count: {
            select: {
              tasks: true,
              mailbox: { where: { isRead: false } },
            },
          },
        },
      });

      if (!team) {
        return reply.status(404).send({ error: 'Team not found' });
      }

      return reply.send({
        success: true,
        data: team,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to get team',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * DELETE /teams/:teamId - Delete team
   */
  fastify.delete('/teams/:teamId', async (request, reply) => {
    const prisma = request.server.prisma;
    const webSocket = request.server.agentTeamWebSocket;
    const { teamId } = request.params as { teamId: string };
    const session = request.session;

    try {
      // Get team
      const team = await prisma.agentTeam.findUnique({
        where: { teamId },
        include: { members: true },
      });

      if (!team) {
        return reply.status(404).send({ error: 'Team not found' });
      }

      // Verify lead is deleting
      if (team.leadAgentId !== session.agentId) {
        return reply.status(403).send({
          error: 'Only the team lead can delete the team',
        });
      }

      // Check for active members
      const activeMembers = team.members.filter((m) => m.name !== 'team-lead' && m.isActive);

      if (activeMembers.length > 0) {
        return reply.status(409).send({
          error: `Cannot delete team with ${activeMembers.length} active member(s)`,
          activeMembers: activeMembers.map((m) => m.name),
        });
      }

      // Delete in transaction
      await prisma.$transaction(async (tx: any) => {
        await tx.agentTask.deleteMany({ where: { teamId } });
        await tx.teamMailbox.deleteMany({ where: { teamId } });
        await tx.agentExecutionLog.deleteMany({ where: { teamId } });
        await tx.agentTeamSession.deleteMany({ where: { teamId } });
        await tx.agentTeamMember.deleteMany({ where: { teamId } });
        await tx.agentTeam.delete({ where: { teamId } });
      });

      // Publish event
      await webSocket.publishToTeam(team.teamName, 'team:deleted', {
        teamId,
        teamName: team.teamName,
        timestamp: new Date().toISOString(),
      });

      return reply.send({
        success: true,
        message: `Team "${team.teamName}" deleted`,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to delete team',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============================================================================
  // Task Management
  // ============================================================================

  /**
   * POST /teams/:teamId/tasks - Create task
   */
  fastify.post('/teams/:teamId/tasks', async (request, reply) => {
    const prisma = request.server.prisma;
    const webSocket = request.server.agentTeamWebSocket;
    const { teamId } = request.params as { teamId: string };
    const session = request.session;

    const parseResult = CreateTaskSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { subject, description, activeForm, metadata, blockedBy } = parseResult.data;

    try {
      // Verify team exists and user is member
      const team = await prisma.agentTeam.findFirst({
        where: {
          teamId,
          members: { some: { agentId: session.agentId } },
        },
      });

      if (!team) {
        return reply.status(404).send({ error: 'Team not found or access denied' });
      }

      // Validate dependencies
      let validBlockedBy: string[] = [];
      if (blockedBy?.length) {
        const existingTasks = await prisma.agentTask.findMany({
          where: {
            taskId: { in: blockedBy },
            teamId,
          },
          select: { taskId: true },
        });
        validBlockedBy = blockedBy.filter((id) => existingTasks.some((t: any) => t.taskId === id));
      }

      const initialStatus = validBlockedBy.length > 0 ? 'blocked' : 'pending';

      // Create task
      const task = await prisma.agentTask.create({
        data: {
          teamId,
          subject,
          description,
          activeForm,
          status: initialStatus,
          blockedBy: validBlockedBy,
          blocks: [],
          metadata,
          hookValidationStatus: 'passed',
        },
      });

      // Update blocks on dependencies
      if (validBlockedBy.length) {
        for (const depId of validBlockedBy) {
          await prisma.agentTask.update({
            where: { taskId: depId },
            data: { blocks: { push: task.taskId } },
          });
        }
      }

      // Publish event
      await webSocket.publishToTeam(team.teamName, 'task:created', {
        taskId: task.taskId,
        teamName: team.teamName,
        subject,
        description,
        status: initialStatus,
        blockedBy: validBlockedBy,
        timestamp: new Date().toISOString(),
      });

      return reply.status(201).send({
        success: true,
        data: {
          task: {
            id: task.taskId,
            subject: task.subject,
            status: task.status,
          },
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to create task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /teams/:teamId/tasks - List tasks
   */
  fastify.get('/teams/:teamId/tasks', async (request, reply) => {
    const prisma = request.server.prisma;
    const { teamId } = request.params as { teamId: string };
    const {
      status,
      owner,
      limit = '50',
    } = request.query as {
      status?: string;
      owner?: string;
      limit?: string;
    };

    try {
      const where: any = { teamId };
      if (status) where.status = status;
      if (owner) where.ownerAgentId = owner;

      const tasks = await prisma.agentTask.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: parseInt(limit),
      });

      const statusCounts = await prisma.agentTask.groupBy({
        by: ['status'],
        where: { teamId },
        _count: { status: true },
      });

      const byStatus: Record<string, number> = {};
      for (const sc of statusCounts) {
        byStatus[sc.status] = sc._count.status;
      }

      return reply.send({
        success: true,
        data: {
          tasks: tasks.map((t: any) => ({
            ...t,
            isBlocked:
              t.status === 'blocked' || (t.blockedBy?.length > 0 && t.status === 'pending'),
            canClaim: t.status === 'pending' && !t.ownerAgentId && !(t.blockedBy?.length > 0),
          })),
          total: tasks.length,
          byStatus,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to list tasks',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /teams/:teamId/tasks/:taskId - Get task
   */
  fastify.get('/teams/:teamId/tasks/:taskId', async (request, reply) => {
    const prisma = request.server.prisma;
    const { teamId, taskId } = request.params as { teamId: string; taskId: string };

    try {
      const task = await prisma.agentTask.findFirst({
        where: { taskId, teamId },
      });

      if (!task) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Get blockedBy details
      let blockedByDetails;
      if (task.blockedBy?.length) {
        const deps = await prisma.agentTask.findMany({
          where: { taskId: { in: task.blockedBy }, teamId },
          select: { taskId: true, subject: true, status: true },
        });
        blockedByDetails = deps;
      }

      return reply.send({
        success: true,
        data: {
          task: {
            ...task,
            blockedByDetails,
          },
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to get task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * PATCH /teams/:teamId/tasks/:taskId - Update task
   */
  fastify.patch('/teams/:teamId/tasks/:taskId', async (request, reply) => {
    const prisma = request.server.prisma;
    const webSocket = request.server.agentTeamWebSocket;
    const { teamId, taskId } = request.params as { teamId: string; taskId: string };
    const session = request.session;

    const parseResult = UpdateTaskSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const updates = parseResult.data;

    try {
      const existingTask = await prisma.agentTask.findFirst({
        where: { taskId, teamId },
      });

      if (!existingTask) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const previousStatus = existingTask.status;
      const updateData: any = {};

      if (updates.status) {
        updateData.status = updates.status;
        if (updates.status === 'in_progress' && previousStatus !== 'in_progress') {
          updateData.claimedAt = new Date();
        }
        if (updates.status === 'completed' && previousStatus !== 'completed') {
          updateData.completedAt = new Date();
        }
      }

      if (updates.owner !== undefined) {
        updateData.ownerAgentId = updates.owner;
        if (updates.owner && previousStatus === 'pending') {
          updateData.status = 'in_progress';
          updateData.claimedAt = new Date();
        }
        if (updates.owner === null && previousStatus === 'in_progress') {
          updateData.status = 'pending';
        }
      }

      if (updates.metadata) {
        updateData.metadata = { ...existingTask.metadata, ...updates.metadata };
      }

      const task = await prisma.agentTask.update({
        where: { taskId },
        data: updateData,
      });

      // Handle unblocking
      const unblockedTasks: string[] = [];
      if (updates.status === 'completed' && existingTask.blocks?.length) {
        for (const blockedId of existingTask.blocks) {
          const blockedTask = await prisma.agentTask.findUnique({
            where: { taskId: blockedId },
          });
          if (blockedTask?.status === 'blocked') {
            const deps = await prisma.agentTask.findMany({
              where: { taskId: { in: blockedTask.blockedBy }, teamId },
            });
            const allComplete = deps.every((d: any) => d.status === 'completed');
            if (allComplete) {
              await prisma.agentTask.update({
                where: { taskId: blockedId },
                data: { status: 'pending' },
              });
              unblockedTasks.push(blockedId);
            }
          }
        }
      }

      // Get team name for events
      const team = await prisma.agentTeam.findUnique({ where: { teamId } });

      // Publish events
      const newStatus = task.status;
      if (newStatus === 'in_progress' && previousStatus !== 'in_progress') {
        await webSocket.publishToTeam(team!.teamName, 'task:claimed', {
          taskId,
          teamName: team!.teamName,
          agentId: task.ownerAgentId,
          agentName: session.agentName,
          timestamp: new Date().toISOString(),
        });
      }

      if (newStatus === 'completed' && previousStatus !== 'completed') {
        await webSocket.publishToTeam(team!.teamName, 'task:completed', {
          taskId,
          teamName: team!.teamName,
          agentId: task.ownerAgentId,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          task: {
            id: task.taskId,
            subject: task.subject,
            status: task.status,
            ownerAgentId: task.ownerAgentId,
            previousStatus,
            unblockedTasks: unblockedTasks.length > 0 ? unblockedTasks : undefined,
          },
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to update task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============================================================================
  // Messaging
  // ============================================================================

  /**
   * POST /teams/:teamId/messages - Send message
   */
  fastify.post('/teams/:teamId/messages', async (request, reply) => {
    const prisma = request.server.prisma;
    const webSocket = request.server.agentTeamWebSocket;
    const { teamId } = request.params as { teamId: string };
    const session = request.session;

    const parseResult = SendMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { to, summary, message } = parseResult.data;

    try {
      const team = await prisma.agentTeam.findFirst({
        where: {
          teamId,
          members: { some: { agentId: session.agentId } },
        },
      });

      if (!team) {
        return reply.status(404).send({ error: 'Team not found or access denied' });
      }

      const senderName = session.agentName || 'unknown';
      let messageType: string = 'text';
      let content: string;
      let requestId: string | undefined;
      let responseType: 'approve' | 'reject' | undefined;
      let feedback: string | undefined;

      // Handle structured message
      if (typeof message === 'object') {
        content = JSON.stringify(message);
        messageType = (message as any).type || 'text';
        requestId = (message as any).request_id;
        if ((message as any).approve !== undefined) {
          responseType = (message as any).approve ? 'approve' : 'reject';
        }
        feedback = (message as any).feedback || (message as any).reason;
      } else {
        content = message;
        if (!summary) {
          return reply.status(400).send({
            error: 'summary is required for text messages',
          });
        }
      }

      // Handle broadcast
      if (to === '*') {
        const members = await prisma.agentTeamMember.findMany({
          where: { teamId, isActive: true },
        });

        for (const member of members) {
          if (member.name === senderName) continue;

          await prisma.teamMailbox.create({
            data: {
              teamId,
              toAgentId: member.name,
              fromAgentId: senderName,
              messageType: 'broadcast',
              content,
              summary: summary || content.substring(0, 50),
              isRead: false,
              isProcessed: false,
            },
          });
        }

        await webSocket.publishToTeam(team.teamName, 'message:broadcast', {
          teamName: team.teamName,
          fromAgentId: senderName,
          fromAgentName: senderName,
          summary: summary || content.substring(0, 50),
          timestamp: new Date().toISOString(),
        });

        return reply.status(201).send({
          success: true,
          data: {
            message: `Message broadcast to ${members.length - 1} teammate(s)`,
            recipients: members.filter((m) => m.name !== senderName).map((m) => m.name),
          },
        });
      }

      // Direct message
      const recipient = await prisma.agentTeamMember.findFirst({
        where: { teamId, name: to, isActive: true },
      });

      if (!recipient) {
        return reply.status(404).send({
          error: `Teammate "${to}" not found or inactive`,
        });
      }

      const mailboxMessage = await prisma.teamMailbox.create({
        data: {
          teamId,
          toAgentId: to,
          fromAgentId: senderName,
          messageType: messageType as any,
          content,
          summary:
            summary || (typeof message === 'string' ? message.substring(0, 50) : messageType),
          requestId,
          responseType,
          feedback,
          isRead: false,
          isProcessed: false,
        },
      });

      await webSocket.publishToTeam(team.teamName, 'message:received', {
        messageId: mailboxMessage.messageId,
        teamName: team.teamName,
        fromAgentId: senderName,
        fromAgentName: senderName,
        toAgentId: to,
        summary: summary || content.substring(0, 50),
        messageType,
        timestamp: new Date().toISOString(),
      });

      return reply.status(201).send({
        success: true,
        data: {
          message: `Message sent to ${to}`,
          messageId: mailboxMessage.messageId,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to send message',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /teams/:teamId/messages - Get messages
   */
  fastify.get('/teams/:teamId/messages', async (request, reply) => {
    const prisma = request.server.prisma;
    const { teamId } = request.params as { teamId: string };
    const session = request.session;
    const {
      to,
      from,
      unread,
      limit = '50',
    } = request.query as {
      to?: string;
      from?: string;
      unread?: string;
      limit?: string;
    };

    try {
      const where: any = { teamId };

      // Filter to messages for this agent
      if (to) {
        where.toAgentId = to;
      } else {
        // Default: show messages to the requesting agent
        where.toAgentId = session.agentName;
      }

      if (from) where.fromAgentId = from;
      if (unread === 'true') where.isRead = false;

      const messages = await prisma.teamMailbox.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
      });

      return reply.send({
        success: true,
        data: { messages },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to get messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * PATCH /teams/:teamId/messages/:messageId/read - Mark message as read
   */
  fastify.patch('/teams/:teamId/messages/:messageId/read', async (request, reply) => {
    const prisma = request.server.prisma;
    const { teamId, messageId } = request.params as { teamId: string; messageId: string };

    try {
      const message = await prisma.teamMailbox.update({
        where: { messageId, teamId },
        data: { isRead: true, readAt: new Date() },
      });

      return reply.send({
        success: true,
        data: { message },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to mark message as read',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============================================================================
  // Agent Spawning
  // ============================================================================

  /**
   * POST /teams/:teamId/agents - Spawn agent
   */
  fastify.post('/teams/:teamId/agents', async (request, reply) => {
    const prisma = request.server.prisma;
    const inProcessManager = request.server.inProcessManager;
    const { teamId } = request.params as { teamId: string };
    const session = request.session;

    const parseResult = SpawnAgentSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { description, prompt, name, model, mode, subagent_type } = parseResult.data;

    try {
      // Verify team exists and user is lead
      const team = await prisma.agentTeam.findFirst({
        where: {
          teamId,
          leadAgentId: session.agentId,
        },
      });

      if (!team) {
        return reply.status(403).send({
          error: 'Only the team lead can spawn agents',
        });
      }

      // Spawn teammate via manager
      const result = await inProcessManager.spawnTeammate({
        name,
        teamName: team.teamName,
        prompt,
        description,
        model,
        planModeRequired: mode === 'plan',
        agentType: subagent_type,
        invokingRequestId: session.sessionId,
      });

      if (!result.success) {
        return reply.status(500).send({
          error: 'Failed to spawn teammate',
          message: result.error,
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          status: 'teammate_spawned',
          teammate_id: result.teammateId,
          agent_id: result.agentId,
          name,
          team_name: team.teamName,
          plan_mode_required: mode === 'plan',
          model,
          prompt,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to spawn agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /teams/:teamId/agents/:agentId/shutdown - Request shutdown
   */
  fastify.post('/teams/:teamId/agents/:agentId/shutdown', async (request, reply) => {
    const inProcessManager = request.server.inProcessManager;
    const { teamId, agentId } = request.params as { teamId: string; agentId: string };
    const { reason } = request.body as { reason?: string };

    try {
      // Get team name
      const team = await request.server.prisma.agentTeam.findUnique({
        where: { teamId },
      });

      if (!team) {
        return reply.status(404).send({ error: 'Team not found' });
      }

      const success = await inProcessManager.requestShutdown(agentId, team.teamName, reason);

      return reply.send({
        success,
        data: {
          message: success
            ? `Shutdown requested for ${agentId}`
            : `No active agent found for ${agentId}`,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to request shutdown',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /teams/:teamId/agents/:agentId/kill - Force kill agent
   */
  fastify.post('/teams/:teamId/agents/:agentId/kill', async (request, reply) => {
    const inProcessManager = request.server.inProcessManager;
    const { teamId, agentId } = request.params as { teamId: string; agentId: string };

    try {
      const team = await request.server.prisma.agentTeam.findUnique({
        where: { teamId },
      });

      if (!team) {
        return reply.status(404).send({ error: 'Team not found' });
      }

      const success = await inProcessManager.killTeammate(agentId, team.teamName);

      return reply.send({
        success,
        data: {
          message: success ? `Agent ${agentId} killed` : `No active agent found for ${agentId}`,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to kill agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

async function generateUniqueTeamName(baseName: string, prisma: any): Promise<string> {
  let name = baseName;
  let suffix = 2;

  while (await prisma.agentTeam.findUnique({ where: { teamName: name } })) {
    name = `${baseName}-${suffix}`;
    suffix++;
  }

  return name;
}
