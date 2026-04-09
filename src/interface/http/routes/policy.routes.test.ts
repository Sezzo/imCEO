import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import {
  buildTestServer,
  cleanDatabase,
  createTestCompany,
  testPrisma,
} from './test.setup';

describe('Policy Routes Integration Tests', () => {
  let server: any;
  let app: supertest.SuperTest<supertest.Test>;
  let testCompany: any;

  beforeAll(async () => {
    server = await buildTestServer();
    app = supertest(server.server);
  });

  afterAll(async () => {
    await server.close();
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase();
    testCompany = await createTestCompany();
  });

  const createPolicy = async (data?: any) => {
    const policyData = {
      name: 'Test Policy',
      description: 'A test policy',
      policyType: 'tool_policy',
      scopeType: 'company',
      scopeId: testCompany.companyId,
      action: 'allow',
      ...data,
    };

    const res = await app.post('/api/v1/policies').send(policyData);
    return res.body.data;
  };

  describe('GET /api/v1/policies', () => {
    it('should return empty array when no policies exist', async () => {
      const res = await app.get('/api/v1/policies');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of policies', async () => {
      await createPolicy({ name: 'Policy A' });
      await createPolicy({ name: 'Policy B' });

      const res = await app.get('/api/v1/policies');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by type', async () => {
      await createPolicy({ name: 'Tool Policy', policyType: 'tool_policy' });
      await createPolicy({ name: 'Review Policy', policyType: 'review_policy' });

      const res = await app.get('/api/v1/policies?type=review_policy');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].policyType).toBe('review_policy');
    });

    it('should filter by scopeId', async () => {
      const policy = await createPolicy({ name: 'Company Policy' });

      const res = await app.get(`/api/v1/policies?scopeId=${testCompany.companyId}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].scopeId).toBe(testCompany.companyId);
    });
  });

  describe('POST /api/v1/policies', () => {
    it('should create a new policy', async () => {
      const policyData = {
        name: 'New Policy',
        description: 'A new policy',
        policyType: 'tool_policy',
        scopeType: 'company',
        scopeId: testCompany.companyId,
        conditionExpression: 'cost < 100',
        action: 'require_approval',
        severity: 'medium',
        enabled: true,
      };

      const res = await app.post('/api/v1/policies').send(policyData);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(policyData.name);
      expect(res.body.data.policyType).toBe('tool_policy');
      expect(res.body.data.action).toBe('require_approval');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/policies').send({
        name: 'Test Policy',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid policy type', async () => {
      const res = await app.post('/api/v1/policies').send({
        name: 'Test Policy',
        policyType: 'InvalidType',
        scopeType: 'company',
        scopeId: testCompany.companyId,
        action: 'allow',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid action', async () => {
      const res = await app.post('/api/v1/policies').send({
        name: 'Test Policy',
        policyType: 'tool_policy',
        scopeType: 'company',
        scopeId: testCompany.companyId,
        action: 'invalid_action',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/policies/:id', () => {
    it('should return policy by id', async () => {
      const policy = await createPolicy({ name: 'Test Policy' });

      const res = await app.get(`/api/v1/policies/${policy.policyId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.policyId).toBe(policy.policyId);
      expect(res.body.data.name).toBe('Test Policy');
    });

    it('should return 404 for non-existent policy', async () => {
      const res = await app.get('/api/v1/policies/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Policy not found');
    });
  });

  describe('PUT /api/v1/policies/:id', () => {
    it('should update policy', async () => {
      const policy = await createPolicy({ name: 'Original' });

      const res = await app.put(`/api/v1/policies/${policy.policyId}`).send({
        name: 'Updated',
        description: 'Updated description',
        enabled: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
      expect(res.body.data.enabled).toBe(false);
    });

    it('should return 404 for non-existent policy', async () => {
      const res = await app.put('/api/v1/policies/non-existent-id').send({
        name: 'Updated',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/policies/:id', () => {
    it('should delete policy', async () => {
      const policy = await createPolicy();

      const res = await app.delete(`/api/v1/policies/${policy.policyId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/policies/${policy.policyId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('POST /api/v1/policies/:id/test', () => {
    it('should test policy with context', async () => {
      const policy = await createPolicy({
        conditionExpression: 'cost < 100',
        action: 'allow',
      });

      const res = await app.post(`/api/v1/policies/${policy.policyId}/test`).send({
        context: {
          cost: 50,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 for missing context', async () => {
      const policy = await createPolicy();

      const res = await app.post(`/api/v1/policies/${policy.policyId}/test`).send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent policy', async () => {
      const res = await app.post('/api/v1/policies/non-existent-id/test').send({
        context: { cost: 50 },
      });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/policies/violations', () => {
    it('should return policy violations', async () => {
      const res = await app.get('/api/v1/policies/violations');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should filter violations by scopeId', async () => {
      const res = await app.get(`/api/v1/policies/violations?scopeId=${testCompany.companyId}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/policies/:id/evaluate', () => {
    it('should evaluate policy with advanced context', async () => {
      const policy = await createPolicy();

      const res = await app.post(`/api/v1/policies/${policy.policyId}/evaluate`).send({
        actorId: 'actor-1',
        action: 'create',
        targetType: 'workItem',
        cost: 50,
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/policies/evaluate-multiple', () => {
    it('should evaluate multiple policies', async () => {
      const policy1 = await createPolicy({ name: 'Policy 1' });
      const policy2 = await createPolicy({ name: 'Policy 2' });

      const res = await app.post('/api/v1/policies/evaluate-multiple').send({
        policyIds: [policy1.policyId, policy2.policyId],
        context: {
          action: 'create',
          cost: 50,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 for invalid request', async () => {
      const res = await app.post('/api/v1/policies/evaluate-multiple').send({
        policyIds: 'not-an-array',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/scopes/:scopeId/policies/evaluate-all', () => {
    it('should evaluate all applicable policies', async () => {
      await createPolicy({ policyType: 'tool_policy' });

      const res = await app.post(`/api/v1/scopes/${testCompany.companyId}/policies/evaluate-all`).send({
        policyType: 'tool_policy',
        context: {
          action: 'create',
          cost: 50,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/policies/:id/test-scenarios', () => {
    it('should test policy with multiple scenarios', async () => {
      const policy = await createPolicy();

      const res = await app.post(`/api/v1/policies/${policy.policyId}/test-scenarios`).send({
        scenarios: [
          { cost: 50 },
          { cost: 150 },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/policies/validate-expression', () => {
    it('should validate condition expression', async () => {
      const res = await app.post('/api/v1/policies/validate-expression').send({
        expression: 'cost < 100 AND priority == "high"',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 for missing expression', async () => {
      const res = await app.post('/api/v1/policies/validate-expression').send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/scopes/:scopeId/check-permission', () => {
    it('should check permission', async () => {
      await createPolicy({ policyType: 'tool_policy' });

      const res = await app.post(`/api/v1/scopes/${testCompany.companyId}/check-permission`).send({
        policyType: 'tool_policy',
        context: {
          action: 'read',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/companies/:companyId/effective-policies', () => {
    it('should get effective policies', async () => {
      await createPolicy({ policyType: 'tool_policy' });

      const res = await app.post(`/api/v1/companies/${testCompany.companyId}/effective-policies`).send({
        scopeIds: [testCompany.companyId],
        policyType: 'tool_policy',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });
});
