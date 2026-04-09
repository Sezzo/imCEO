import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ModelProfileService } from '../../../application/services/model-profile.service';

const createModelProfileSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  modelVariant: z.string().min(1).max(100),
  description: z.string().optional(),
  contextWindow: z.number().int().min(1),
  maxOutputTokens: z.number().int().min(1),
  capabilities: z.record(z.any()).optional(),
  inputCostPer1k: z.number().min(0),
  outputCostPer1k: z.number().min(0),
  cachingEnabled: z.boolean().optional(),
  cachingCostPer1k: z.number().min(0).optional(),
  batchingEnabled: z.boolean().optional(),
  batchingDiscount: z.number().min(0).max(1).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const updateModelProfileSchema = createModelProfileSchema.partial().omit({ companyId: true });

const costEstimateSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  useCaching: z.boolean().optional(),
  useBatching: z.boolean().optional(),
});

const compareSchema = z.object({
  profileIds: z.array(z.string().uuid()).min(2),
});

export async function modelProfileRoutes(server: FastifyInstance) {
  const modelProfileService = new ModelProfileService();

  // GET /api/v1/model-profiles
  server.get('/model-profiles', async (request) => {
    const { companyId, isActive, isDefault, modelVariant } = request.query as {
      companyId?: string;
      isActive?: string;
      isDefault?: string;
      modelVariant?: string;
    };

    const filters = {
      ...(companyId && { companyId }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(isDefault !== undefined && { isDefault: isDefault === 'true' }),
      ...(modelVariant && { modelVariant }),
    };

    const profiles = await modelProfileService.findAll(
      Object.keys(filters).length > 0 ? filters : undefined
    );
    return { data: profiles };
  });

  // POST /api/v1/model-profiles
  server.post('/model-profiles', async (request, reply) => {
    const data = createModelProfileSchema.parse(request.body);
    const profile = await modelProfileService.create(data);
    reply.status(201);
    return { data: profile };
  });

  // GET /api/v1/model-profiles/:id
  server.get('/model-profiles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const profile = await modelProfileService.findById(id);

    if (!profile) {
      reply.status(404);
      throw new Error('Model profile not found');
    }

    return { data: profile };
  });

  // PUT /api/v1/model-profiles/:id
  server.put('/model-profiles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateModelProfileSchema.parse(request.body);
    const profile = await modelProfileService.update(id, data);
    return { data: profile };
  });

  // DELETE /api/v1/model-profiles/:id
  server.delete('/model-profiles/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await modelProfileService.delete(id);
    reply.status(204);
  });

  // GET /api/v1/companies/:companyId/model-profiles/default
  server.get('/companies/:companyId/model-profiles/default', async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const profile = await modelProfileService.findDefaultForCompany(companyId);

    if (!profile) {
      reply.status(404);
      throw new Error('No default model profile found for this company');
    }

    return { data: profile };
  });

  // POST /api/v1/model-profiles/:id/estimate-cost
  server.post('/model-profiles/:id/estimate-cost', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { inputTokens, outputTokens, useCaching, useBatching } = costEstimateSchema.parse(request.body);

    const estimate = await modelProfileService.estimateCost(
      id,
      inputTokens,
      outputTokens,
      useCaching,
      useBatching
    );

    return { data: estimate };
  });

  // GET /api/v1/model-profiles/:id/capabilities
  server.get('/model-profiles/:id/capabilities', async (request, reply) => {
    const { id } = request.params as { id: string };
    const capabilities = await modelProfileService.getCapabilities(id);

    if (capabilities === null) {
      reply.status(404);
      throw new Error('Model profile not found');
    }

    return { data: capabilities };
  });

  // POST /api/v1/model-profiles/compare
  server.post('/model-profiles/compare', async (request) => {
    const { profileIds } = compareSchema.parse(request.body);
    const comparison = await modelProfileService.compareProfiles(profileIds);
    return { data: comparison };
  });

  // POST /api/v1/model-profiles/:id/set-default
  server.post('/model-profiles/:id/set-default', async (request, reply) => {
    const { id } = request.params as { id: string };
    await modelProfileService.setDefault(id);
    reply.status(204);
  });
}
