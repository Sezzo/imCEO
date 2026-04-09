import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CompanyService } from '../../../application/services/company.service';

const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  industry: z.string().optional(),
  primaryObjective: z.string().optional(),
  operatingMode: z.string().optional(),
  globalPrompt: z.string().optional(),
  globalPolicies: z.record(z.any()).optional(),
  globalSkills: z.array(z.any()).optional(),
  globalMcps: z.array(z.any()).optional(),
  globalPlugins: z.array(z.any()).optional(),
});

const updateCompanySchema = createCompanySchema.partial();

export async function companyRoutes(server: FastifyInstance) {
  const companyService = new CompanyService();

  // GET /api/v1/companies
  server.get('/companies', async (request, reply) => {
    const companies = await companyService.findAll();
    return { data: companies };
  });

  // POST /api/v1/companies
  server.post('/companies', async (request, reply) => {
    const data = createCompanySchema.parse(request.body);
    const company = await companyService.create(data);
    reply.status(201);
    return { data: company };
  });

  // GET /api/v1/companies/:id
  server.get('/companies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const company = await companyService.findById(id);

    if (!company) {
      reply.status(404);
      throw new Error('Company not found');
    }

    return { data: company };
  });

  // PUT /api/v1/companies/:id
  server.put('/companies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateCompanySchema.parse(request.body);
    const company = await companyService.update(id, data);

    if (!company) {
      reply.status(404);
      throw new Error('Company not found');
    }

    return { data: company };
  });

  // DELETE /api/v1/companies/:id
  server.delete('/companies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await companyService.delete(id);
    reply.status(204);
  });

  // GET /api/v1/companies/:id/hierarchy
  server.get('/companies/:id/hierarchy', async (request, reply) => {
    const { id } = request.params as { id: string };
    const hierarchy = await companyService.getHierarchy(id);
    return { data: hierarchy };
  });

  // GET /api/v1/companies/:id/org-chart
  server.get('/companies/:id/org-chart', async (request, reply) => {
    const { id } = request.params as { id: string };
    const orgChart = await companyService.getOrgChart(id);
    return { data: orgChart };
  });
}
