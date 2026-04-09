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
  approvalRequirement: z.string().optional(),
  enabled: z.boolean().default(true),
});

const updatePolicySchema = createPolicySchema.partial();

const testPolicySchema = z.object({
  context: z.record(z.any()),
});

const evaluatePolicySchema = z.object({
  actorId: z.string().optional(),
  actorType: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  action: z.string().optional(),
  cost: z.number().optional(),
  timeElapsed: z.number().optional(),
  failureCount: z.number().optional(),
  data: z.record(z.any()).optional(),
});

const evaluateMultipleSchema = z.object({
  policyIds: z.array(z.string().uuid()),
  context: evaluatePolicySchema,
});

const evaluateAllSchema = z.object({
  policyType: z.nativeEnum(PolicyType),
  context: evaluatePolicySchema,
});

const testScenariosSchema = z.object({
  scenarios: z.array(evaluatePolicySchema),
});

const validateExpressionSchema = z.object({
  expression: z.string(),
});

const checkPermissionSchema = z.object({
  policyType: z.nativeEnum(PolicyType),
  context: evaluatePolicySchema,
});

const effectivePoliciesSchema = z.object({
  scopeIds: z.array(z.string().uuid()),
  policyType: z.nativeEnum(PolicyType),
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

  // POST /api/v1/policies/:id/evaluate - Evaluate policy with advanced context
  server.post('/policies/:id/evaluate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const context = evaluatePolicySchema.parse(request.body);
    const result = await policyService.evaluatePolicy(id, context);
    return { data: result };
  });

  // POST /api/v1/policies/evaluate-multiple - Evaluate multiple policies
  server.post('/policies/evaluate-multiple', async (request) => {
    const { policyIds, context } = evaluateMultipleSchema.parse(request.body);
    const results = await policyService.evaluateMultiplePolicies(policyIds, context);
    return { data: results };
  });

  // POST /api/v1/scopes/:scopeId/policies/evaluate-all - Evaluate all applicable policies
  server.post('/scopes/:scopeId/policies/evaluate-all', async (request) => {
    const { scopeId } = request.params as { scopeId: string };
    const { policyType, context } = evaluateAllSchema.parse(request.body);
    const results = await policyService.evaluateAllApplicablePolicies(scopeId, policyType, context);
    return { data: results };
  });

  // POST /api/v1/policies/:id/test-scenarios - Test policy with multiple scenarios
  server.post('/policies/:id/test-scenarios', async (request) => {
    const { id } = request.params as { id: string };
    const { scenarios } = testScenariosSchema.parse(request.body);
    const results = await policyService.testPolicyWithScenarios(id, scenarios);
    return { data: results };
  });

  // POST /api/v1/policies/validate-expression - Validate condition expression
  server.post('/policies/validate-expression', async (request) => {
    const { expression } = validateExpressionSchema.parse(request.body);
    const result = policyService.validateConditionExpression(expression);
    return { data: result };
  });

  // POST /api/v1/scopes/:scopeId/check-permission - Check permission
  server.post('/scopes/:scopeId/check-permission', async (request) => {
    const { scopeId } = request.params as { scopeId: string };
    const { policyType, context } = checkPermissionSchema.parse(request.body);
    const result = await policyService.checkPermission(scopeId, policyType, context);
    return { data: result };
  });

  // POST /api/v1/companies/:companyId/effective-policies - Get effective policies
  server.post('/companies/:companyId/effective-policies', async (request) => {
    const { companyId } = request.params as { companyId: string };
    const { scopeIds, policyType } = effectivePoliciesSchema.parse(request.body);
    const results = await policyService.getEffectivePolicies(companyId, scopeIds, policyType);
    return { data: results };
  });
}
