import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AgentProfileService } from '../../../application/services/agent-profile.service';

const createAgentProfileSchema = z.object({
  teamId: z.string().uuid(),
  roleTemplateId: z.string().uuid().optional(),
  displayName: z.string().min(1).max(255),
  internalName: z.string().min(1).max(255),
  seniority: z.string().optional(),
  customPromptOverride: z.string().optional(),
  maxParallelTasks: z.number().int().min(1).default(1),
  maxContextBudget: z.number().int().optional(),
  maxCostPerTask: z.number().optional(),
});

const updateAgentProfileSchema = createAgentProfileSchema.partial().omit({ teamId: true });

export async function agentProfileRoutes(server: FastifyInstance) {
  const agentProfileService = new AgentProfileService();

  server.get('/agent-profiles', async () => {
    const profiles = await agentProfileService.findAll();
    return { data: profiles };
  });

  server.post('/agent-profiles', async (request, reply) => {
    const data = createAgentProfileSchema.parse(request.body);
    const profile = await agentProfileService.create(data);
    reply.status(201);
    return { data: profile };
  });

  server.get('/agent-profiles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const profile = await agentProfileService.findById(id);
    if (!profile) {
      reply.status(404);
      throw new Error('Agent profile not found');
    }
    return { data: profile };
  });

  server.put('/agent-profiles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateAgentProfileSchema.parse(request.body);
    const profile = await agentProfileService.update(id, data);
    if (!profile) {
      reply.status(404);
      throw new Error('Agent profile not found');
    }
    return { data: profile };
  });

  server.delete('/agent-profiles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await agentProfileService.delete(id);
    reply.status(204);
  });

  server.post('/agent-profiles/:id/activate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const profile = await agentProfileService.activate(id);
    return { data: profile };
  });

  server.post('/agent-profiles/:id/deactivate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const profile = await agentProfileService.deactivate(id);
    return { data: profile };
  });

  server.get('/teams/:id/agent-profiles', async (request) => {
    const { id } = request.params as { id: string };
    const profiles = await agentProfileService.findByTeamId(id);
    return { data: profiles };
  });
}
