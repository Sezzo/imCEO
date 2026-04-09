import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import {
  buildTestServer,
  cleanDatabase,
  createTestCompany,
  testPrisma,
  checkDatabaseConnection,
  isDatabaseAvailable,
} from '../test.setup';

describe('Policy Routes Integration Tests', () => {
  let server: any;
  let app: supertest.SuperTest<supertest.Test>;
  let testCompany: any;

  beforeAll(async () => {
    const dbAvailable = await checkDatabaseConnection();
    if (!dbAvailable) {
      console.warn('Skipping integration tests - database not available');
      return;
    }
    server = await buildTestServer();
    app = supertest(server.server);
  });

  afterAll(async () => {
    if (!isDatabaseAvailable()) return;
    await server.close();
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    if (!isDatabaseAvailable()) return;
    await cleanDatabase();
    testCompany = await createTestCompany();
  });

  const createTestPolicy = async (companyId: string, data?: Partial<any>) => {
    const policyData = {
      companyId,
      policyType: 'Security',
      name: 'Test Policy',
      description: 'A test policy',
      content: { rules: [] },
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
      await createTestPolicy(testCompany.companyId, { name: 'Policy A' });
      await createTestPolicy(testCompany.companyId, { name: 'Policy B' });

      const res = await app.get('/api/v1/policies');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/policies', () => {
    it('should create a new policy', async () => {
      const policyData = {
        companyId: testCompany.companyId,
        policyType: 'Security',
        name: 'New Policy',
        description: 'A new policy',
        content: { rules: [{ name: 'rule1' }] },
      };

      const res = await app.post('/api/v1/policies').send(policyData);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(policyData.name);
      expect(res.body.data.companyId).toBe(testCompany.companyId);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/policies').send({
        name: 'Test Policy',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid policyType', async () => {
      const res = await app.post('/api/v1/policies').send({
        companyId: testCompany.companyId,
        policyType: 'InvalidType',
        name: 'Test Policy',
        content: {},
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/policies/:id', () => {
    it('should return policy by id', async () => {
      const policy = await createTestPolicy(testCompany.companyId, { name: 'Test Policy' });

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
      const policy = await createTestPolicy(testCompany.companyId, { name: 'Original' });

      const res = await app.put(`/api/v1/policies/${policy.policyId}`).send({
        name: 'Updated',
        description: 'Updated description',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
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
      const policy = await createTestPolicy(testCompany.companyId);

      const res = await app.delete(`/api/v1/policies/${policy.policyId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/policies/${policy.policyId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('GET /api/v1/companies/:id/policies', () => {
    it('should return policies for a company', async () => {
      await createTestPolicy(testCompany.companyId, { name: 'Policy 1' });
      await createTestPolicy(testCompany.companyId, { name: 'Policy 2' });

      const res = await app.get(`/api/v1/companies/${testCompany.companyId}/policies`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for company with no policies', async () => {
      const res = await app.get(`/api/v1/companies/${testCompany.companyId}/policies`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('PATCH /api/v1/policies/:id/enforce', () => {
    it('should enforce a policy', async () => {
      const policy = await createTestPolicy(testCompany.companyId);

      const res = await app.patch(`/api/v1/policies/${policy.policyId}/enforce`).send({
        enforce: true,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.isEnforced).toBe(true);
    });

    it('should return 404 for non-existent policy', async () => {
      const res = await app.patch('/api/v1/policies/non-existent-id/enforce').send({
        enforce: true,
      });

      expect(res.status).toBe(404);
    });
  });
});
