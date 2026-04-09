import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DivisionService } from '../../../application/services/division.service';

const createDivisionSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  parentDivisionId: z.string().uuid().optional(),
  headRoleId: z.string().optional(),
  policies: z.record(z.any()).optional(),
});

const updateDivisionSchema = createDivisionSchema.partial().omit({ companyId: true });

export async function divisionRoutes(server: FastifyInstance) {
  const divisionService = new DivisionService();

  server.get('/divisions', async () => {
    const divisions = await divisionService.findAll();
    return { data: divisions };
  });

  server.post('/divisions', async (request, reply) => {
    const data = createDivisionSchema.parse(request.body);
    const division = await divisionService.create(data);
    reply.status(201);
    return { data: division };
  });

  server.get('/divisions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const division = await divisionService.findById(id);
    if (!division) {
      reply.status(404);
      throw new Error('Division not found');
    }
    return { data: division };
  });

  server.put('/divisions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateDivisionSchema.parse(request.body);
    const division = await divisionService.update(id, data);
    if (!division) {
      reply.status(404);
      throw new Error('Division not found');
    }
    return { data: division };
  });

  server.delete('/divisions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await divisionService.delete(id);
    reply.status(204);
  });

  server.get('/companies/:id/divisions', async (request) => {
    const { id } = request.params as { id: string };
    const divisions = await divisionService.findByCompanyId(id);
    return { data: divisions };
  });
}
