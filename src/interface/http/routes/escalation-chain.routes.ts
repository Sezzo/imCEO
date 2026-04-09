import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EscalationChainService } from '../../../application/services/escalation-chain.service';
import { EscalationTrigger, EscalationState } from '@prisma/client';

const createEscalationChainSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  triggerType: z.nativeEnum(EscalationTrigger),
  triggerCondition: z.string().min(1),
  level1RoleId: z.string().uuid(),
  level2RoleId: z.string().uuid().optional(),
  level3RoleId: z.string().uuid().optional(),
  autoEscalateTime: z.number().int().min(0).optional(),
  notifyOnTrigger: z.boolean().optional(),
});

const updateEscalationChainSchema = createEscalationChainSchema.partial().omit({ companyId: true });

const triggerSchema = z.object({
  targetType: z.string().min(1),
  targetId: z.string().uuid(),
  triggerReason: z.string().min(1),
  triggeredBy: z.string().optional(),
});

const escalateSchema = z.object({
  resolution: z.string().optional(),
});

const resolveSchema = z.object({
  resolution: z.string().min(1),
});

const evaluateSchema = z.object({
  context: z.record(z.any()),
});

export async function escalationChainRoutes(server: FastifyInstance) {
  const escalationChainService = new EscalationChainService();

  // GET /api/v1/escalation-chains
  server.get('/escalation-chains', async (request) => {
    const { companyId, triggerType, state } = request.query as {
      companyId?: string;
      triggerType?: EscalationTrigger;
      state?: EscalationState;
    };

    const filters = {
      ...(companyId && { companyId }),
      ...(triggerType && { triggerType }),
      ...(state && { state }),
    };

    const chains = await escalationChainService.findAll(
      Object.keys(filters).length > 0 ? filters : undefined
    );
    return { data: chains };
  });

  // POST /api/v1/escalation-chains
  server.post('/escalation-chains', async (request, reply) => {
    const data = createEscalationChainSchema.parse(request.body);
    const chain = await escalationChainService.create(data);
    reply.status(201);
    return { data: chain };
  });

  // GET /api/v1/escalation-chains/:id
  server.get('/escalation-chains/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const chain = await escalationChainService.findById(id);

    if (!chain) {
      reply.status(404);
      throw new Error('Escalation chain not found');
    }

    return { data: chain };
  });

  // PUT /api/v1/escalation-chains/:id
  server.put('/escalation-chains/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateEscalationChainSchema.parse(request.body);
    const chain = await escalationChainService.update(id, data);
    return { data: chain };
  });

  // DELETE /api/v1/escalation-chains/:id
  server.delete('/escalation-chains/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await escalationChainService.delete(id);
    reply.status(204);
  });

  // POST /api/v1/escalation-chains/:id/activate
  server.post('/escalation-chains/:id/activate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const chain = await escalationChainService.activate(id);
    return { data: chain };
  });

  // POST /api/v1/escalation-chains/:id/deactivate
  server.post('/escalation-chains/:id/deactivate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const chain = await escalationChainService.deactivate(id);
    return { data: chain };
  });

  // POST /api/v1/escalation-chains/:id/trigger
  server.post('/escalation-chains/:id/trigger', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = triggerSchema.parse(request.body);
    const event = await escalationChainService.trigger(id, data);
    reply.status(201);
    return { data: event };
  });

  // GET /api/v1/escalation-chains/:id/events
  server.get('/escalation-chains/:id/events', async (request) => {
    const { id } = request.params as { id: string };
    const { onlyActive } = request.query as { onlyActive?: string };
    const events = await escalationChainService.getEvents(id, onlyActive === 'true');
    return { data: events };
  });

  // POST /api/v1/escalation-events/:id/escalate
  server.post('/escalation-events/:id/escalate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { resolution } = escalateSchema.parse(request.body);
    const event = await escalationChainService.escalateLevel({
      escalationEventId: id,
      resolution,
    });
    return { data: event };
  });

  // POST /api/v1/escalation-events/:id/resolve
  server.post('/escalation-events/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { resolution } = resolveSchema.parse(request.body);
    const event = await escalationChainService.resolve(id, resolution);
    return { data: event };
  });

  // POST /api/v1/escalation-chains/:id/evaluate
  server.post('/escalation-chains/:id/evaluate', async (request) => {
    const { id } = request.params as { id: string };
    const { context } = evaluateSchema.parse(request.body);
    const result = await escalationChainService.evaluateCondition(id, context);
    return { data: result };
  });

  // POST /api/v1/escalation-chains/:id/auto-escalate-check
  server.post('/escalation-chains/:id/auto-escalate-check', async (request, reply) => {
    const { id } = request.params as { id: string };
    await escalationChainService.autoEscalateCheck(id);
    reply.status(204);
  });

  // GET /api/v1/companies/:companyId/active-escalations
  server.get('/companies/:companyId/active-escalations', async (request) => {
    const { companyId } = request.params as { companyId: string };
    const escalations = await escalationChainService.getActiveEscalations(companyId);
    return { data: escalations };
  });
}
