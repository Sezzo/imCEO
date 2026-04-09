import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import type { AgentSessionState, Prisma } from '@prisma/client';

const serviceLogger = logger.child({ component: 'AgentSessionService' });

export interface CreateAgentSessionDTO {
  teamSessionId: string;
  agentId: string;
  assignedWorkItemId?: string;
}

export interface UpdateAgentSessionDTO {
  state?: AgentSessionState;
  costAccumulated?: number;
  contextAccumulated?: number;
  failureReason?: string;
}

export interface AgentActivity {
  type: 'thinking' | 'acting' | 'waiting' | 'error' | 'completed';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export class AgentSessionService {
  async findAll() {
    serviceLogger.debug('Finding all agent sessions');
    return prisma.agentSession.findMany({
      orderBy: { startedAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ agentSessionId: id }, 'Finding agent session by id');
    return prisma.agentSession.findUnique({
      where: { agentSessionId: id },
      include: {
        teamSession: true,
      },
    });
  }

  async findByTeamSessionId(teamSessionId: string) {
    serviceLogger.debug(
      { teamSessionId },
      'Finding agent sessions by team session id'
    );
    return prisma.agentSession.findMany({
      where: { teamSessionId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findByAgentId(agentId: string) {
    serviceLogger.debug({ agentId }, 'Finding agent sessions by agent id');
    return prisma.agentSession.findMany({
      where: { agentId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findActiveByAgentId(agentId: string) {
    serviceLogger.debug({ agentId }, 'Finding active agent sessions');
    return prisma.agentSession.findMany({
      where: {
        agentId,
        state: {
          in: ['Assigned', 'Running', 'Waiting', 'Idle', 'Blocked'],
        },
      },
    });
  }

  async create(data: CreateAgentSessionDTO) {
    serviceLogger.info(
      { teamSessionId: data.teamSessionId, agentId: data.agentId },
      'Creating agent session'
    );
    return prisma.agentSession.create({
      data: {
        teamSessionId: data.teamSessionId,
        agentId: data.agentId,
        assignedWorkItemId: data.assignedWorkItemId,
        state: 'Assigned',
        costAccumulated: 0,
        contextAccumulated: 0,
      },
    });
  }

  async start(agentSessionId: string) {
    serviceLogger.info({ agentSessionId }, 'Starting agent session');

    const now = new Date();
    return prisma.agentSession.update({
      where: { agentSessionId },
      data: {
        state: 'Running',
        startedAt: now,
        lastActiveAt: now,
      },
    });
  }

  async updateState(
    agentSessionId: string,
    newState: AgentSessionState,
    failureReason?: string
  ) {
    serviceLogger.info(
      { agentSessionId, newState, failureReason },
      'Updating agent session state'
    );

    const updateData: Prisma.AgentSessionUpdateInput = {
      state: newState,
      lastActiveAt: new Date(),
    };

    if (failureReason) {
      updateData.failureReason = failureReason;
    }

    if (newState === 'Completed' || newState === 'Failed' || newState === 'Killed') {
      updateData.endedAt = new Date();
    }

    if (newState === 'Running') {
      updateData.lastActiveAt = new Date();
    }

    return prisma.agentSession.update({
      where: { agentSessionId },
      data: updateData,
    });
  }

  async updateCost(agentSessionId: string, additionalCost: number) {
    serviceLogger.debug(
      { agentSessionId, additionalCost },
      'Updating agent session cost'
    );

    return prisma.agentSession.update({
      where: { agentSessionId },
      data: {
        costAccumulated: {
          increment: additionalCost,
        },
        lastActiveAt: new Date(),
      },
    });
  }

  async updateContextUsage(agentSessionId: string, additionalTokens: number) {
    serviceLogger.debug(
      { agentSessionId, additionalTokens },
      'Updating agent session context usage'
    );

    return prisma.agentSession.update({
      where: { agentSessionId },
      data: {
        contextAccumulated: {
          increment: additionalTokens,
        },
        lastActiveAt: new Date(),
      },
    });
  }

  async recordActivity(
    agentSessionId: string,
    activity: Omit<AgentActivity, 'timestamp'>
  ) {
    serviceLogger.debug(
      { agentSessionId, activityType: activity.type },
      'Recording agent activity'
    );

    // Update last active timestamp
    await prisma.agentSession.update({
      where: { agentSessionId },
      data: {
        lastActiveAt: new Date(),
      },
    });

    // Activity is logged - in production, this would publish to WebSocket/Event system
    return {
      agentSessionId,
      ...activity,
      timestamp: new Date(),
    };
  }

  async assignWorkItem(agentSessionId: string, workItemId: string) {
    serviceLogger.info(
      { agentSessionId, workItemId },
      'Assigning work item to agent session'
    );

    return prisma.agentSession.update({
      where: { agentSessionId },
      data: {
        assignedWorkItemId: workItemId,
        lastActiveAt: new Date(),
      },
    });
  }

  async unassignWorkItem(agentSessionId: string) {
    serviceLogger.info(
      { agentSessionId },
      'Unassigning work item from agent session'
    );

    return prisma.agentSession.update({
      where: { agentSessionId },
      data: {
        assignedWorkItemId: null,
        lastActiveAt: new Date(),
      },
    });
  }

  async complete(agentSessionId: string) {
    serviceLogger.info({ agentSessionId }, 'Completing agent session');

    return prisma.agentSession.update({
      where: { agentSessionId },
      data: {
        state: 'Completed',
        endedAt: new Date(),
        lastActiveAt: new Date(),
      },
    });
  }

  async fail(agentSessionId: string, reason: string) {
    serviceLogger.warn({ agentSessionId, reason }, 'Failing agent session');

    return prisma.agentSession.update({
      where: { agentSessionId },
      data: {
        state: 'Failed',
        failureReason: reason,
        endedAt: new Date(),
        lastActiveAt: new Date(),
      },
    });
  }

  async kill(agentSessionId: string, reason?: string) {
    serviceLogger.warn({ agentSessionId, reason }, 'Killing agent session');

    return prisma.agentSession.update({
      where: { agentSessionId },
      data: {
        state: 'Killed',
        failureReason: reason || 'Session terminated by system',
        endedAt: new Date(),
        lastActiveAt: new Date(),
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ agentSessionId: id }, 'Deleting agent session');
    await prisma.agentSession.delete({
      where: { agentSessionId: id },
    });
  }

  // State transition validation
  private readonly validTransitions: Record<AgentSessionState, AgentSessionState[]> = {
    Assigned: ['Running', 'Blocked', 'Failed', 'Killed'],
    Running: ['Waiting', 'Idle', 'Blocked', 'Completed', 'Failed', 'Killed'],
    Waiting: ['Running', 'Idle', 'Blocked', 'Failed', 'Killed'],
    Idle: ['Running', 'Waiting', 'Blocked', 'Completed', 'Failed', 'Killed'],
    Blocked: ['Running', 'Waiting', 'Idle', 'Failed', 'Killed'],
    Completed: [],
    Failed: [],
    Killed: [],
  };

  isValidTransition(from: AgentSessionState, to: AgentSessionState): boolean {
    return this.validTransitions[from]?.includes(to) ?? false;
  }

  // Get agent session metrics
  async getSessionMetrics(agentSessionId: string) {
    serviceLogger.debug(
      { agentSessionId },
      'Getting agent session metrics'
    );

    const session = await this.findById(agentSessionId);
    if (!session) {
      throw new Error(`Agent session ${agentSessionId} not found`);
    }

    const now = new Date();
    const startedAt = session.startedAt;
    const endedAt = session.endedAt;
    const lastActiveAt = session.lastActiveAt;

    return {
      state: session.state,
      costAccumulated: session.costAccumulated,
      contextAccumulated: session.contextAccumulated,
      duration: endedAt
        ? endedAt.getTime() - (startedAt?.getTime() ?? 0)
        : now.getTime() - (startedAt?.getTime() ?? 0),
      idleTime: lastActiveAt && startedAt
        ? now.getTime() - lastActiveAt.getTime()
        : 0,
      assignedWorkItemId: session.assignedWorkItemId,
      failureReason: session.failureReason,
    };
  }

  // Bulk operations for team session management
  async killAllInTeamSession(
    teamSessionId: string,
    reason?: string
  ): Promise<number> {
    serviceLogger.info(
      { teamSessionId, reason },
      'Killing all agent sessions in team session'
    );

    const result = await prisma.agentSession.updateMany({
      where: {
        teamSessionId,
        state: {
          in: ['Assigned', 'Running', 'Waiting', 'Idle', 'Blocked'],
        },
      },
      data: {
        state: 'Killed',
        failureReason: reason || 'Team session terminated',
        endedAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    return result.count;
  }

  async getTeamSessionSummary(teamSessionId: string) {
    serviceLogger.debug(
      { teamSessionId },
      'Getting team session agent summary'
    );

    const agentSessions = await this.findByTeamSessionId(teamSessionId);

    const summary = {
      total: agentSessions.length,
      byState: {} as Record<AgentSessionState, number>,
      totalCost: 0,
      totalContext: 0,
      activeWorkItems: new Set<string>(),
    };

    for (const session of agentSessions) {
      summary.byState[session.state] = (summary.byState[session.state] || 0) + 1;
      summary.totalCost += Number(session.costAccumulated);
      summary.totalContext += session.contextAccumulated;
      if (session.assignedWorkItemId) {
        summary.activeWorkItems.add(session.assignedWorkItemId);
      }
    }

    return {
      ...summary,
      activeWorkItems: Array.from(summary.activeWorkItems),
    };
  }
}
