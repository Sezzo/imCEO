import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DepartmentService } from '../../../application/services/department.service';

const createDepartmentSchema = z.object({
  divisionId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  headRoleId: z.string().optional(),
  scope: z.string().optional(),
  policies: z.record(z.any()).optional(),
});

const updateDepartmentSchema = createDepartmentSchema.partial().omit({ divisionId: true });

export async function departmentRoutes(server: FastifyInstance) {
  const departmentService = new DepartmentService();

  server.get('/departments', async () => {
    const departments = await departmentService.findAll();
    return { data: departments };
  });

  server.post('/departments', async (request, reply) => {
    const data = createDepartmentSchema.parse(request.body);
    const department = await departmentService.create(data);
    reply.status(201);
    return { data: department };
  });

  server.get('/departments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const department = await departmentService.findById(id);
    if (!department) {
      reply.status(404);
      throw new Error('Department not found');
    }
    return { data: department };
  });

  server.put('/departments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateDepartmentSchema.parse(request.body);
    const department = await departmentService.update(id, data);
    if (!department) {
      reply.status(404);
      throw new Error('Department not found');
    }
    return { data: department };
  });

  server.delete('/departments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await departmentService.delete(id);
    reply.status(204);
  });

  server.get('/divisions/:id/departments', async (request) => {
    const { id } = request.params as { id: string };
    const departments = await departmentService.findByDivisionId(id);
    return { data: departments };
  });
}
