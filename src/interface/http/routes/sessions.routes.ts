import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TeamSessionService } from '../../../application/services/session-team.service';
import { AgentSessionService } from '../../../application/services/session-agent.service';
import { CostEnforcementService } from '../../../application/services/cost-enforcement.service';
import { websocketServer, eventPublisher } from '../../../infrastructure/websocket';
import { logger } from '../../../config/logger';

const routeLogger = logger.child({ component: 'SessionRoutes' });

const teamSessionService = new TeamSessionService();
const agentSessionService = new AgentSessionService();
const costEnforcementService = new CostEnforcementService();

// Validation schemas
const createSessionSchema = z.object({
  teamId: z.string().uuid(),
  initiatingWorkItemId: z.string().uuid().optional(),
  sessionPurpose: z.string().optional(),
});

const launchSessionSchema = z.object({
  agentIds: z.array(z.string().uuid()),
  workItemAssignments: z.record(z.string().uuid()).optional(),
});

const updateStateSchema = z.object({
  state: z.enum([
    'Queued',
    'Launching',
    'Active',
    'Waiting',
    'Idle',
    'Failed',
    'Completed',
    'Terminated',
  ]),
  reason: z.string().optional(),
});

const updateAgentStateSchema = z.object({
  state: z.enum([
    'Assigned',
    'Running',
    'Waiting',
    'Idle',
    'Blocked',
    'Completed',
    'Failed',
    'Killed',
  ]),
  failureReason: z.string().optional(),
});

const recordActivitySchema = z.object({
  type: z.enum(['thinking', 'acting', 'waiting', 'error', 'completed']),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const budgetPolicySchema = z.object({
  scopeType: z.enum(['company', 'team', 'agent', 'session']),
  scopeId: z.string(),
  dailyLimit: z.number().optional(),
  monthlyLimit: z.number().optional(),
  perTaskLimit: z.number().optional(),
  perSessionLimit: z.number().optional(),
  alertThresholds: z.array(z.number()).default([50, 75, 90, 100]),
});

export async function sessionRoutes(server: FastifyInstance) {
  // ===== Team Session Routes =====

  // GET /sessions - List all team sessions
  server.get('/sessions', async (request, reply) => {
    routeLogger.debug('Listing all team sessions');
    const sessions = await teamSessionService.findAll();
    return { data: sessions };
  });

  // GET /sessions/:id - Get team session by ID
  server.get('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    routeLogger.debug({ sessionId: id }, 'Getting team session');

    const session = await teamSessionService.findById(id);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    return { data: session };
  });

  // GET /teams/:teamId/sessions - Get sessions by team
  server.get('/teams/:teamId/sessions', async (request, reply) => {
    const { teamId } = request.params as { teamId: string };
    routeLogger.debug({ teamId }, 'Getting team sessions');

    const sessions = await teamSessionService.findByTeamId(teamId);
    return { data: sessions };
  });

  // GET /teams/:teamId/sessions/active - Get active sessions for team
  server.get('/teams/:teamId/sessions/active', async (request, reply) => {
    const { teamId } = request.params as { teamId: string };
    routeLogger.debug({ teamId }, 'Getting active team sessions');

    const sessions = await teamSessionService.findActiveByTeamId(teamId);
    return { data: sessions };
  });

  // POST /sessions - Create new team session
  server.post('/sessions', async (request, reply) => {
    const result = createSessionSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: result.error.errors });
    }

    routeLogger.info(result.data, 'Creating team session');
    const session = await teamSessionService.create(result.data);

    // Publish event
    eventPublisher.publish(
      'session_created',
      {
        sessionId: session.teamSessionId,
        teamId: session.teamId,
        state: session.currentState,
      },
      { sessionId: session.teamSessionId, teamId: session.teamId }
    );

    return reply.status(201).send({ data: session });
  });

  // POST /sessions/:id/launch - Launch session with agents
  server.post('/sessions/:id/launch', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = launchSessionSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: result.error.errors });
    }

    routeLogger.info({ sessionId: id, config: result.data }, 'Launching team session');

    try {
      const session = await teamSessionService.launch(id, result.data);

      // Publish event
      eventPublisher.publish(
        'session_launched',
        {
          sessionId: id,
          agentCount: result.data.agentIds.length,
          state: session.currentState,
        },
        { sessionId: id }
      );

      return { data: session };
    } catch (error) {
      routeLogger.error({ sessionId: id, error }, 'Failed to launch session');
      return reply.status(500).send({ error: 'Failed to launch session' });
    }
  });

  // PATCH /sessions/:id/state - Update session state
  server.patch('/sessions/:id/state', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = updateStateSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: result.error.errors });
    }

    const { state, reason } = result.data;
    routeLogger.info({ sessionId: id, newState: state, reason }, 'Updating session state');

    try {
      const session = await teamSessionService.updateState(id, state, reason);

      // Publish event
      eventPublisher.publish(
        'session_state_changed',
        {
          sessionId: id,
          newState: state,
          previousState: session.currentState,
          reason,
        },
        { sessionId: id, priority: state === 'Failed' ? 'high' : 'normal' }
      );

      return { data: session };
    } catch (error) {
      routeLogger.error({ sessionId: id, error }, 'Failed to update session state');
      return reply.status(500).send({ error: 'Failed to update session state' });
    }
  });

  // POST /sessions/:id/terminate - Terminate session
  server.post('/sessions/:id/terminate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };

    routeLogger.info({ sessionId: id, reason }, 'Terminating session');

    try {
      const session = await teamSessionService.terminate(id, reason);

      // Publish event
      eventPublisher.publish(
        'session_terminated',
        {
          sessionId: id,
          reason,
          finalCost: session.currentCost,
        },
        { sessionId: id, priority: 'high' }
      );

      return { data: session };
    } catch (error) {
      routeLogger.error({ sessionId: id, error }, 'Failed to terminate session');
      return reply.status(500).send({ error: 'Failed to terminate session' });
    }
  });

  // GET /sessions/:id/stats - Get session statistics
  server.get('/sessions/:id/stats', async (request, reply) => {
    const { id } = request.params as { id: string };
    routeLogger.debug({ sessionId: id }, 'Getting session stats');

    try {
      const stats = await teamSessionService.getSessionStats(id);
      return { data: stats };
    } catch (error) {
      return reply.status(404).send({ error: 'Session not found' });
    }
  });

  // ===== Agent Session Routes =====

  // GET /sessions/:id/agents - Get agent sessions for team session
  server.get('/sessions/:id/agents', async (request, reply) => {
    const { id } = request.params as { id: string };
    routeLogger.debug({ sessionId: id }, 'Getting agent sessions');

    const agents = await agentSessionService.findByTeamSessionId(id);
    return { data: agents };
  });

  // GET /agents/:agentId/sessions - Get sessions by agent
  server.get('/agents/:agentId/sessions', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    routeLogger.debug({ agentId }, 'Getting agent sessions');

    const sessions = await agentSessionService.findByAgentId(agentId);
    return { data: sessions };
  });

  // GET /agent-sessions/:id - Get agent session by ID
  server.get('/agent-sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    routeLogger.debug({ agentSessionId: id }, 'Getting agent session');

    const session = await agentSessionService.findById(id);
    if (!session) {
      return reply.status(404).send({ error: 'Agent session not found' });
    }

    return { data: session };
  });

  // GET /agent-sessions/:id/metrics - Get agent session metrics
  server.get('/agent-sessions/:id/metrics', async (request, reply) => {
    const { id } = request.params as { id: string };
    routeLogger.debug({ agentSessionId: id }, 'Getting agent session metrics');

    try {
      const metrics = await agentSessionService.getSessionMetrics(id);
      return { data: metrics };
    } catch (error) {
      return reply.status(404).send({ error: 'Agent session not found' });
    }
  });

  // PATCH /agent-sessions/:id/state - Update agent session state
  server.patch('/agent-sessions/:id/state', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = updateAgentStateSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: result.error.errors });
    }

    const { state, failureReason } = result.data;
    routeLogger.info(
      { agentSessionId: id, newState: state },
      'Updating agent session state'
    );

    try {
      const session = await agentSessionService.updateState(id, state, failureReason);

      // Publish event
      eventPublisher.publish(
        'agent_state_changed',
        {
          agentSessionId: id,
          agentId: session.agentId,
          newState: state,
          failureReason,
        },
        { agentId: session.agentId, priority: state === 'Failed' ? 'high' : 'normal' }
      );

      return { data: session };
    } catch (error) {
      routeLogger.error({ agentSessionId: id, error }, 'Failed to update agent session state');
      return reply.status(500).send({ error: 'Failed to update agent session state' });
    }
  });

  // POST /agent-sessions/:id/start - Start agent session
  server.post('/agent-sessions/:id/start', async (request, reply) => {
    const { id } = request.params as { id: string };
    routeLogger.info({ agentSessionId: id }, 'Starting agent session');

    try {
      const session = await agentSessionService.start(id);

      eventPublisher.publish(
        'agent_started',
        { agentSessionId: id, agentId: session.agentId },
        { agentId: session.agentId }
      );

      return { data: session };
    } catch (error) {
      routeLogger.error({ agentSessionId: id, error }, 'Failed to start agent session');
      return reply.status(500).send({ error: 'Failed to start agent session' });
    }
  });

  // POST /agent-sessions/:id/complete - Complete agent session
  server.post('/agent-sessions/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string };
    routeLogger.info({ agentSessionId: id }, 'Completing agent session');

    try {
      const session = await agentSessionService.complete(id);

      eventPublisher.publish(
        'agent_completed',
        { agentSessionId: id, agentId: session.agentId },
        { agentId: session.agentId }
      );

      return { data: session };
    } catch (error) {
      routeLogger.error({ agentSessionId: id, error }, 'Failed to complete agent session');
      return reply.status(500).send({ error: 'Failed to complete agent session' });
    }
  });

  // POST /agent-sessions/:id/fail - Fail agent session
  server.post('/agent-sessions/:id/fail', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };

    routeLogger.warn({ agentSessionId: id, reason }, 'Failing agent session');

    try {
      const session = await agentSessionService.fail(id, reason);

      eventPublisher.publish(
        'agent_failed',
        { agentSessionId: id, agentId: session.agentId, reason },
        { agentId: session.agentId, priority: 'high' }
      );

      return { data: session };
    } catch (error) {
      routeLogger.error({ agentSessionId: id, error }, 'Failed to fail agent session');
      return reply.status(500).send({ error: 'Failed to fail agent session' });
    }
  });

  // POST /agent-sessions/:id/activity - Record agent activity
  server.post('/agent-sessions/:id/activity', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = recordActivitySchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: result.error.errors });
    }

    const activity = result.data;
    routeLogger.debug({ agentSessionId: id, activity }, 'Recording agent activity');

    try {
      const recorded = await agentSessionService.recordActivity(id, activity);

      eventPublisher.publish(
        'agent_activity',
        {
          agentSessionId: id,
          type: activity.type,
          message: activity.message,
          metadata: activity.metadata,
        },
        { agentId: recorded.agentSessionId, priority: activity.type === 'error' ? 'high' : 'normal' }
      );

      return { data: recorded };
    } catch (error) {
      routeLogger.error({ agentSessionId: id, error }, 'Failed to record activity');
      return reply.status(500).send({ error: 'Failed to record activity' });
    }
  });

  // ===== Cost Enforcement Routes =====

  // POST /cost-policies - Register budget policy
  server.post('/cost-policies', async (request, reply) => {
    const result = budgetPolicySchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: result.error.errors });
    }

    routeLogger.info(result.data, 'Registering budget policy');

    try {
      await costEnforcementService.registerPolicy(result.data);
      return reply.status(201).send({ success: true });
    } catch (error) {
      routeLogger.error({ error }, 'Failed to register budget policy');
      return reply.status(500).send({ error: 'Failed to register budget policy' });
    }
  });

  // GET /cost-policies - List active budget policies
  server.get('/cost-policies', async (request, reply) => {
    const policies = costEnforcementService.getActivePolicies();
    return { data: policies };
  });

  // GET /:scopeType/:scopeId/costs - Get cost summary
  server.get('/:scopeType/:scopeId/costs', async (request, reply) => {
    const { scopeType, scopeId } = request.params as { scopeType: string; scopeId: string };
    const { period } = request.query as { period?: 'day' | 'week' | 'month' | 'all' };

    routeLogger.debug({ scopeType, scopeId, period }, 'Getting cost summary');

    try {
      const summary = await costEnforcementService.getCostSummary(
        scopeType,
        scopeId,
        period || 'month'
      );
      return { data: summary };
    } catch (error) {
      routeLogger.error({ scopeType, scopeId, error }, 'Failed to get cost summary');
      return reply.status(500).send({ error: 'Failed to get cost summary' });
    }
  });

  // ===== Real-time / WebSocket Routes =====

  // GET /ws/events - Get recent events (for clients that can't use WebSocket)
  server.get('/ws/events', async (request, reply) => {
    const { since, limit, types } = request.query as {
      since?: string;
      limit?: string;
      types?: string;
    };

    const events = eventPublisher.getHistory({
      since: since ? new Date(since) : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      eventTypes: types ? types.split(',') : undefined,
    });

    return { data: events };
  });

  // GET /ws/stats - Get WebSocket connection stats
  server.get('/ws/stats', async (request, reply) => {
    const clients = websocketServer.getClients();
    const subscriberStats = eventPublisher.getSubscriberCount();

    return {
      data: {
        connectedClients: clients.length,
        subscribers: subscriberStats,
        clients: clients.map((c) => ({
          id: c.id,
          metadata: c.metadata,
          subscriptions: Array.from(c.subscriptions),
        })),
      },
    };
  });

  // ===== Command Center Routes =====

  // GET /command-center/sessions - Get all active sessions overview
  server.get('/command-center/sessions', async (request, reply) => {
    routeLogger.debug('Getting command center sessions overview');

    const allSessions = await teamSessionService.findAll();
    const activeSessions = allSessions.filter((s) =>
      ['Queued', 'Launching', 'Active', 'Waiting', 'Idle'].includes(s.currentState)
    );

    const overview = await Promise.all(
      activeSessions.map(async (session) => {
        const stats = await teamSessionService.getSessionStats(session.teamSessionId);
        return {
          sessionId: session.teamSessionId,
          teamId: session.teamId,
          state: session.currentState,
          currentCost: session.currentCost,
          currentContextUsage: session.currentContextUsage,
          launchedAt: session.launchedAt,
          stats,
        };
      })
    );

    return { data: overview };
  });

  // GET /command-center/metrics - Get real-time system metrics
  server.get('/command-center/metrics', async (request, reply) => {
    routeLogger.debug('Getting command center metrics');

    const allSessions = await teamSessionService.findAll();
    const allAgentSessions = await agentSessionService.findAll();

    const activeSessions = allSessions.filter((s) =>
      ['Queued', 'Launching', 'Active', 'Waiting', 'Idle'].includes(s.currentState)
    );

    const activeAgents = allAgentSessions.filter((a) =>
      ['Assigned', 'Running', 'Waiting', 'Idle', 'Blocked'].includes(a.state)
    );

    const totalCost = allSessions.reduce((sum, s) => sum + Number(s.currentCost), 0);
    const totalContext = allSessions.reduce((sum, s) => sum + s.currentContextUsage, 0);

    return {
      data: {
        sessions: {
          total: allSessions.length,
          active: activeSessions.length,
          byState: allSessions.reduce((acc, s) => {
            acc[s.currentState] = (acc[s.currentState] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
        agents: {
          total: allAgentSessions.length,
          active: activeAgents.length,
          byState: allAgentSessions.reduce((acc, a) => {
            acc[a.state] = (acc[a.state] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
        costs: {
          totalCost,
          totalContextUsage: totalContext,
          activeSessionCost: activeSessions.reduce((sum, s) => sum + Number(s.currentCost), 0),
        },
        websocket: {
          connectedClients: websocketServer.getClientCount(),
        },
        timestamp: new Date().toISOString(),
      },
    };
  });

  // GET /command-center/agents/live - Get live agent activity
  server.get('/command-center/agents/live', async (request, reply) => {
    routeLogger.debug('Getting live agent activity');

    const activeAgents = await agentSessionService.findAll();
    const runningAgents = activeAgents.filter((a) => a.state === 'Running');

    const liveActivity = runningAgents.map((agent) => ({
      agentSessionId: agent.agentSessionId,
      agentId: agent.agentId,
      teamSessionId: agent.teamSessionId,
      assignedWorkItemId: agent.assignedWorkItemId,
      state: agent.state,
      costAccumulated: agent.costAccumulated,
      contextAccumulated: agent.contextAccumulated,
      startedAt: agent.startedAt,
      lastActiveAt: agent.lastActiveAt,
    }));

    return { data: liveActivity };
  });
}
