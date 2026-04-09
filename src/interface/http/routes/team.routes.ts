import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TeamService } from '../../../application/services/team.service';

const createTeamSchema = z.object({
  departmentId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  mission: z.string().optional(),
  teamType: z.string().optional(),
  leadRoleId: z.string().optional(),
  defaultModelProfileId: z.string().optional(),
  defaultSkillBundleId: z.string().optional(),
  defaultMcpBundleId: z.string().optional(),
  allowedInteractions: z.array(z.any()).optional(),
});

const updateTeamSchema = createTeamSchema.partial().omit({ departmentId: true });

export async function teamRoutes(server: FastifyInstance) {
  const teamService = new TeamService();

  server.get('/teams', async () => {
    const teams = await teamService.findAll();
    return { data: teams };
  });

  server.post('/teams', async (request, reply) => {
    const data = createTeamSchema.parse(request.body);
    const team = await teamService.create(data);
    reply.status(201);
    return { data: team };
  });

  server.get('/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const team = await teamService.findById(id);
    if (!team) {
      reply.status(404);
      throw new Error('Team not found');
    }
    return { data: team };
  });

  server.put('/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateTeamSchema.parse(request.body);
    const team = await teamService.update(id, data);
    if (!team) {
      reply.status(404);
      throw new Error('Team not found');
    }
    return { data: team };
  });

  server.delete('/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await teamService.delete(id);
    reply.status(204);
  });

  server.get('/departments/:id/teams', async (request) => {
    const { id } = request.params as { id: string };
    const teams = await teamService.findByDepartmentId(id);
    return { data: teams };
  });
}
