import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import {
  buildTestServer,
  cleanDatabase,
  createTestCompany,
  createTestDivision,
  testPrisma,
  checkDatabaseConnection,
  isDatabaseAvailable,
} from './test.setup';

describe('Division Routes Integration Tests', () => {
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

  describe('GET /api/v1/divisions', () => {
    it('should return empty array when no divisions exist', async () => {
      const res = await app.get('/api/v1/divisions');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of divisions', async () => {
      await createTestDivision(testCompany.companyId, { name: 'Division A' });
      await createTestDivision(testCompany.companyId, { name: 'Division B' });

      const res = await app.get('/api/v1/divisions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/divisions', () => {
    it('should create a new division', async () => {
      const divisionData = {
        companyId: testCompany.companyId,
        name: 'New Division',
        description: 'A new division',
      };

      const res = await app.post('/api/v1/divisions').send(divisionData);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(divisionData.name);
      expect(res.body.data.companyId).toBe(testCompany.companyId);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/divisions').send({
        name: 'Test Division',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid companyId format', async () => {
      const res = await app.post('/api/v1/divisions').send({
        companyId: 'invalid-uuid',
        name: 'Test Division',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/divisions/:id', () => {
    it('should return division by id', async () => {
      const division = await createTestDivision(testCompany.companyId, { name: 'Test Division' });

      const res = await app.get(`/api/v1/divisions/${division.divisionId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.divisionId).toBe(division.divisionId);
      expect(res.body.data.name).toBe('Test Division');
    });

    it('should return 404 for non-existent division', async () => {
      const res = await app.get('/api/v1/divisions/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Division not found');
    });
  });

  describe('PUT /api/v1/divisions/:id', () => {
    it('should update division', async () => {
      const division = await createTestDivision(testCompany.companyId, { name: 'Original' });

      const res = await app.put(`/api/v1/divisions/${division.divisionId}`).send({
        name: 'Updated',
        description: 'Updated description',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('should return 404 for non-existent division', async () => {
      const res = await app.put('/api/v1/divisions/non-existent-id').send({
        name: 'Updated',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/divisions/:id', () => {
    it('should delete division', async () => {
      const division = await createTestDivision(testCompany.companyId);

      const res = await app.delete(`/api/v1/divisions/${division.divisionId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/divisions/${division.divisionId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('GET /api/v1/companies/:id/divisions', () => {
    it('should return divisions for a company', async () => {
      await createTestDivision(testCompany.companyId, { name: 'Division 1' });
      await createTestDivision(testCompany.companyId, { name: 'Division 2' });

      const res = await app.get(`/api/v1/companies/${testCompany.companyId}/divisions`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for company with no divisions', async () => {
      const res = await app.get(`/api/v1/companies/${testCompany.companyId}/divisions`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
