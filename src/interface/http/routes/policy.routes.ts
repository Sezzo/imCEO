import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PolicyService } from '../../../application/services/policy.service';
import { PolicyType, PolicyAction } from '@prisma/client';

const createPolicySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  policyType: z.nativeEnum(PolicyType),
  scopeType: z.string(),
  scopeId: z.string().uuid(),
  conditionExpression: z.string().optional(),
  action: z.nativeEnum(PolicyAction),
  severity: z.string().optional(),
  enabled: z.boolean().default(true),
});

const updatePolicySchema = createPolicySchema.partial();

const testPolicySchema = z.object({
  context: z.record(z.any()),
});

export async function policyRoutes(server: FastifyInstance) {
  const policyService = new PolicyService();

  server.get('/policies', async (request) => {
    const { type, scopeId } = request.query as { type?: string; scopeId?: string };
    const policies = await policyService.findAll({ type, scopeId });
    return { data: policies };
  });

  server.post('/policies', async (request, reply) => {
    const data = createPolicySchema.parse(request.body);
    const policy = await policyService.create(data);
    reply.status(201);
    return { data: policy };
  });

  server.get('/policies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const policy = await policyService.findById(id);
    if (!policy) {
      reply.status(404);
      throw new Error('Policy not found');
    }
    return { data: policy };
  });

  server.put('/policies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updatePolicySchema.parse(request.body);
    const policy = await policyService.update(id, data);
    if (!policy) {
      reply.status(404);
      throw new Error('Policy not found');
    }
    return { data: policy };
  });

  server.delete('/policies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await policyService.delete(id);
    reply.status(204);
  });

  server.post('/policies/:id/test', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { context } = testPolicySchema.parse(request.body);
    const result = await policyService.testPolicy(id, context);
    return { data: result };
  });

  server.get('/policies/violations', async (request) => {
    const { scopeId } = request.query as { scopeId?: string };
    const violations = await policyService.getViolations(scopeId);
    return { data: violations };
  });
}
