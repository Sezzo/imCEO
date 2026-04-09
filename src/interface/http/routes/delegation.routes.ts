import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DelegationService } from '../../../application/services/delegation.service';
import { DelegationType, DelegationState } from '@prisma/client';

const createDelegationSchema = z.object({
  sourceWorkItemId: z.string().uuid(),
  sourceAgentId: z.string().uuid().optional(),
  sourceRoleId: z.string().uuid().optional(),
  targetTeamId: z.string().uuid(),
  targetRoleId: z.string().uuid().optional(),
  targetAgentId: z.string().uuid().optional(),
  delegationType: z.nativeEnum(DelegationType),
  objective: z.string().optional(),
  scope: z.string().optional(),
  constraints: z.record(z.any()).optional(),
  costLimit: z.number().positive().optional(),
});

const updateDelegationSchema = z.object({
  objective: z.string().optional(),
  scope: z.string().optional(),
  constraints: z.record(z.any()).optional(),
  costLimit: z.number().positive().optional(),
});

const acceptSchema = z.object({
  agentId: z.string().uuid().optional(),
});

const rejectSchema = z.object({
  reason: z.string().optional(),
});

const completeSchema = z.object({
  result: z.record(z.any()).optional(),
});

const failSchema = z.object({
  reason: z.string(),
});

const cancelSchema = z.object({
  reason: z.string().optional(),
});

const costTrackingSchema = z.object({
  costIncurred: z.number().min(0),
  contextUsed: z.number().int().min(0).optional(),
});

const recommendationsSchema = z.object({
  delegationType: z.nativeEnum(DelegationType),
  limit: z.number().int().min(1).max(20).optional(),
});

const metricsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function delegationRoutes(server: FastifyInstance) {
  const delegationService = new DelegationService();

  // GET /api/v1/delegations
  server.get('/delegations', async (request) => {
    const {
      sourceWorkItemId,
      sourceAgentId,
      targetTeamId,
      targetAgentId,
      delegationType,
      state,
    } = request.query as {
      sourceWorkItemId?: string;
      sourceAgentId?: string;
      targetTeamId?: string;
      targetAgentId?: string;
      delegationType?: DelegationType;
      state?: DelegationState;
    };

    const filters = {
      ...(sourceWorkItemId && { sourceWorkItemId }),
      ...(sourceAgentId && { sourceAgentId }),
      ...(targetTeamId && { targetTeamId }),
      ...(targetAgentId && { targetAgentId }),
      ...(delegationType && { delegationType }),
      ...(state && { state }),
    };

    const delegations = await delegationService.findAll(
      Object.keys(filters).length > 0 ? filters : undefined
    );
    return { data: delegations };
  });

  // POST /api/v1/delegations
  server.post('/delegations', async (request, reply) => {
    const data = createDelegationSchema.parse(request.body);
    const delegation = await delegationService.create(data);
    reply.status(201);
    return { data: delegation };
  });

  // GET /api/v1/delegations/:id
  server.get('/delegations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const delegation = await delegationService.findById(id);

    if (!delegation) {
      reply.status(404);
      throw new Error('Delegation not found');
    }

    return { data: delegation };
  });

  // PUT /api/v1/delegations/:id
  server.put('/delegations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateDelegationSchema.parse(request.body);
    const delegation = await delegationService.update(id, data);
    return { data: delegation };
  });

  // POST /api/v1/delegations/:id/accept
  server.post('/delegations/:id/accept', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { agentId } = acceptSchema.parse(request.body);
    await delegationService.accept(id, agentId);
    reply.status(204);
  });

  // POST /api/v1/delegations/:id/reject
  server.post('/delegations/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = rejectSchema.parse(request.body);
    await delegationService.reject(id, reason);
    reply.status(204);
  });

  // POST /api/v1/delegations/:id/start
  server.post('/delegations/:id/start', async (request, reply) => {
    const { id } = request.params as { id: string };
    await delegationService.start(id);
    reply.status(204);
  });

  // POST /api/v1/delegations/:id/complete
  server.post('/delegations/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { result } = completeSchema.parse(request.body);
    await delegationService.complete(id, result);
    reply.status(204);
  });

  // POST /api/v1/delegations/:id/fail
  server.post('/delegations/:id/fail', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = failSchema.parse(request.body);
    await delegationService.fail(id, reason);
    reply.status(204);
  });

  // POST /api/v1/delegations/:id/cancel
  server.post('/delegations/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = cancelSchema.parse(request.body);
    await delegationService.cancel(id, reason);
    reply.status(204);
  });

  // POST /api/v1/delegations/:id/cost-tracking
  server.post('/delegations/:id/cost-tracking', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = costTrackingSchema.parse(request.body);
    await delegationService.updateCostTracking(id, data);
    reply.status(204);
  });

  // GET /api/v1/work-items/:workItemId/delegations/recommendations
  server.get('/work-items/:workItemId/delegations/recommendations', async (request) => {
    const { workItemId } = request.params as { workItemId: string };
    const body = recommendationsSchema.parse(request.query);

    const recommendations = await delegationService.getRecommendations(
      workItemId,
      body.delegationType,
      body.limit
    );
    return { data: recommendations };
  });

  // GET /api/v1/work-items/:workItemId/delegations/chain
  server.get('/work-items/:workItemId/delegations/chain', async (request) => {
    const { workItemId } = request.params as { workItemId: string };
    const chain = await delegationService.getDelegationChain(workItemId);
    return { data: chain };
  });

  // GET /api/v1/agents/:agentId/active-delegations
  server.get('/agents/:agentId/active-delegations', async (request) => {
    const { agentId } = request.params as { agentId: string };
    const delegations = await delegationService.getActiveDelegationsForAgent(agentId);
    return { data: delegations };
  });

  // GET /api/v1/teams/:teamId/active-delegations
  server.get('/teams/:teamId/active-delegations', async (request) => {
    const { teamId } = request.params as { teamId: string };
    const delegations = await delegationService.getActiveDelegationsForTeam(teamId);
    return { data: delegations };
  });

  // POST /api/v1/teams/:teamId/delegations/metrics
  server.post('/teams/:teamId/delegations/metrics', async (request) => {
    const { teamId } = request.params as { teamId: string };
    const body = metricsSchema.parse(request.body);

    const dateRange = {
      ...(body.from && { from: new Date(body.from) }),
      ...(body.to && { to: new Date(body.to) }),
    };

    const metrics = await delegationService.getDelegationMetrics(
      teamId,
      undefined,
      Object.keys(dateRange).length > 0 ? dateRange : undefined
    );
    return { data: metrics };
  });

  // POST /api/v1/agents/:agentId/delegations/metrics
  server.post('/agents/:agentId/delegations/metrics', async (request) => {
    const { agentId } = request.params as { agentId: string };
    const body = metricsSchema.parse(request.body);

    const dateRange = {
      ...(body.from && { from: new Date(body.from) }),
      ...(body.to && { to: new Date(body.to) }),
    };

    const metrics = await delegationService.getDelegationMetrics(
      undefined,
      agentId,
      Object.keys(dateRange).length > 0 ? dateRange : undefined
    );
    return { data: metrics };
  });
}
