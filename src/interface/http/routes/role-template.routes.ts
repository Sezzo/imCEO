import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RoleTemplateService } from '../../../application/services/role-template.service';

const createRoleTemplateSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  hierarchyLevel: z.enum(['CEO', 'Executive', 'Management', 'Lead', 'Specialist', 'Governance', 'Observer']),
  description: z.string().optional(),
  purpose: z.string().optional(),
  primaryResponsibilities: z.array(z.string()).optional(),
  decisionScope: z.record(z.any()).optional(),
  requiredArtifacts: z.array(z.string()).optional(),
  requiredReviews: z.array(z.string()).optional(),
  costClass: z.string().optional(),
});

const updateRoleTemplateSchema = createRoleTemplateSchema.partial().omit({ companyId: true });

export async function roleTemplateRoutes(server: FastifyInstance) {
  const roleTemplateService = new RoleTemplateService();

  server.get('/role-templates', async () => {
    const templates = await roleTemplateService.findAll();
    return { data: templates };
  });

  server.post('/role-templates', async (request, reply) => {
    const data = createRoleTemplateSchema.parse(request.body);
    const template = await roleTemplateService.create(data);
    reply.status(201);
    return { data: template };
  });

  server.get('/role-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const template = await roleTemplateService.findById(id);
    if (!template) {
      reply.status(404);
      throw new Error('Role template not found');
    }
    return { data: template };
  });

  server.put('/role-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateRoleTemplateSchema.parse(request.body);
    const template = await roleTemplateService.update(id, data);
    if (!template) {
      reply.status(404);
      throw new Error('Role template not found');
    }
    return { data: template };
  });

  server.delete('/role-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await roleTemplateService.delete(id);
    reply.status(204);
  });

  server.post('/role-templates/:id/duplicate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const duplicated = await roleTemplateService.duplicate(id);
    reply.status(201);
    return { data: duplicated };
  });

  server.get('/companies/:id/role-templates', async (request) => {
    const { id } = request.params as { id: string };
    const templates = await roleTemplateService.findByCompanyId(id);
    return { data: templates };
  });
}
