import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { buildTestServer, cleanDatabase, createTestCompany, testPrisma } from './test.setup';

describe('Company Routes Integration Tests', () => {
  let server: any;
  let app: supertest.SuperTest<supertest.Test>;

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
  });

  describe('GET /api/v1/companies', () => {
    it('should return empty array when no companies exist', async () => {
      const res = await app.get('/api/v1/companies');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of companies', async () => {
      await createTestCompany({ name: 'Company A' });
      await createTestCompany({ name: 'Company B' });

      const res = await app.get('/api/v1/companies');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.map((c: any) => c.name)).toContain('Company A');
      expect(res.body.data.map((c: any) => c.name)).toContain('Company B');
    });
  });

  describe('POST /api/v1/companies', () => {
    it('should create a new company', async () => {
      const companyData = {
        name: 'New Company',
        description: 'A new test company',
        industry: 'Technology',
      };

      const res = await app.post('/api/v1/companies').send(companyData);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(companyData.name);
      expect(res.body.data.description).toBe(companyData.description);
      expect(res.body.data.industry).toBe(companyData.industry);
      expect(res.body.data.companyId).toBeDefined();
    });

    it('should return 400 for invalid data', async () => {
      const res = await app.post('/api/v1/companies').send({
        description: 'Missing name',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for empty name', async () => {
      const res = await app.post('/api/v1/companies').send({
        name: '',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/companies/:id', () => {
    it('should return company by id', async () => {
      const company = await createTestCompany({ name: 'Test Company' });

      const res = await app.get(`/api/v1/companies/${company.companyId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.companyId).toBe(company.companyId);
      expect(res.body.data.name).toBe('Test Company');
    });

    it('should return 404 for non-existent company', async () => {
      const res = await app.get('/api/v1/companies/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Company not found');
    });

    it('should return 404 for invalid uuid format', async () => {
      const res = await app.get('/api/v1/companies/invalid-uuid');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/companies/:id', () => {
    it('should update company', async () => {
      const company = await createTestCompany({ name: 'Original Name' });

      const res = await app.put(`/api/v1/companies/${company.companyId}`).send({
        name: 'Updated Name',
        description: 'Updated description',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.description).toBe('Updated description');
    });

    it('should return 404 for non-existent company', async () => {
      const res = await app.put('/api/v1/companies/non-existent-id').send({
        name: 'Updated Name',
      });

      expect(res.status).toBe(404);
    });

    it('should allow partial updates', async () => {
      const company = await createTestCompany({ name: 'Test', description: 'Original' });

      const res = await app.put(`/api/v1/companies/${company.companyId}`).send({
        description: 'Only description updated',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Test');
      expect(res.body.data.description).toBe('Only description updated');
    });
  });

  describe('DELETE /api/v1/companies/:id', () => {
    it('should delete company', async () => {
      const company = await createTestCompany();

      const res = await app.delete(`/api/v1/companies/${company.companyId}`);

      expect(res.status).toBe(204);

      // Verify deletion
      const checkRes = await app.get(`/api/v1/companies/${company.companyId}`);
      expect(checkRes.status).toBe(404);
    });

    it('should return 204 even for non-existent company', async () => {
      const res = await app.delete('/api/v1/companies/non-existent-id');

      expect(res.status).toBe(204);
    });
  });

  describe('GET /api/v1/companies/:id/hierarchy', () => {
    it('should return company hierarchy', async () => {
      const company = await createTestCompany();

      const res = await app.get(`/api/v1/companies/${company.companyId}/hierarchy`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 404 for non-existent company hierarchy', async () => {
      const res = await app.get('/api/v1/companies/non-existent-id/hierarchy');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/companies/:id/org-chart', () => {
    it('should return org chart', async () => {
      const company = await createTestCompany();

      const res = await app.get(`/api/v1/companies/${company.companyId}/org-chart`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 404 for non-existent company org chart', async () => {
      const res = await app.get('/api/v1/companies/non-existent-id/org-chart');

      expect(res.status).toBe(404);
    });
  });
});
