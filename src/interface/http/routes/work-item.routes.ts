import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WorkItemService } from '../../../application/services/work-item.service';
import { WorkItemType, WorkItemState } from '@prisma/client';

const createWorkItemSchema = z.object({
  type: z.nativeEnum(WorkItemType),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  parentWorkItemId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  divisionId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  owningTeamId: z.string().uuid().optional(),
  owningRoleId: z.string().optional(),
  assignedAgentId: z.string().uuid().optional(),
  priority: z.string().optional(),
  severity: z.string().optional(),
  costLimit: z.number().optional(),
  estimatedEffort: z.number().int().optional(),
  dueAt: z.string().datetime().optional(),
});

const updateWorkItemSchema = createWorkItemSchema.partial();

const transitionSchema = z.object({
  toState: z.nativeEnum(WorkItemState),
  reason: z.string().optional(),
});

export async function workItemRoutes(server: FastifyInstance) {
  const workItemService = new WorkItemService();

  server.get('/work-items', async (request) => {
    const { state, type, teamId } = request.query as { state?: string; type?: string; teamId?: string };
    const items = await workItemService.findAll({ state, type, teamId });
    return { data: items };
  });

  server.post('/work-items', async (request, reply) => {
    const data = createWorkItemSchema.parse(request.body);
    const item = await workItemService.create(data);
    reply.status(201);
    return { data: item };
  });

  server.get('/work-items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await workItemService.findById(id);
    if (!item) {
      reply.status(404);
      throw new Error('Work item not found');
    }
    return { data: item };
  });

  server.put('/work-items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateWorkItemSchema.parse(request.body);
    const item = await workItemService.update(id, data);
    if (!item) {
      reply.status(404);
      throw new Error('Work item not found');
    }
    return { data: item };
  });

  server.delete('/work-items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await workItemService.delete(id);
    reply.status(204);
  });

  server.post('/work-items/:id/transition', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { toState, reason } = transitionSchema.parse(request.body);
    const item = await workItemService.transition(id, toState, reason);
    if (!item) {
      reply.status(404);
      throw new Error('Work item not found');
    }
    return { data: item };
  });

  server.get('/work-items/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const history = await workItemService.getHistory(id);
    return { data: history };
  });

  server.get('/work-items/board', async () => {
    const board = await workItemService.getBoard();
    return { data: board };
  });
}
