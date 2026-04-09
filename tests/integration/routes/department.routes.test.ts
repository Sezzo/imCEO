import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import {
  buildTestServer,
  cleanDatabase,
  createTestCompany,
  createTestDivision,
  createTestDepartment,
  testPrisma,
  checkDatabaseConnection,
  isDatabaseAvailable,
} from '../test.setup';

describe('Department Routes Integration Tests', () => {
  let server: any;
  let app: supertest.SuperTest<supertest.Test>;
  let testCompany: any;
  let testDivision: any;

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
    testDivision = await createTestDivision(testCompany.companyId);
  });

  describe('GET /api/v1/departments', () => {
    it('should return empty array when no departments exist', async () => {
      const res = await app.get('/api/v1/departments');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of departments', async () => {
      await createTestDepartment(testDivision.divisionId, { name: 'Department A' });
      await createTestDepartment(testDivision.divisionId, { name: 'Department B' });

      const res = await app.get('/api/v1/departments');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/departments', () => {
    it('should create a new department', async () => {
      const departmentData = {
        divisionId: testDivision.divisionId,
        name: 'New Department',
        description: 'A new department',
      };

      const res = await app.post('/api/v1/departments').send(departmentData);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(departmentData.name);
      expect(res.body.data.divisionId).toBe(testDivision.divisionId);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/departments').send({
        name: 'Test Department',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid divisionId format', async () => {
      const res = await app.post('/api/v1/departments').send({
        divisionId: 'invalid-uuid',
        name: 'Test Department',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/departments/:id', () => {
    it('should return department by id', async () => {
      const department = await createTestDepartment(testDivision.divisionId, { name: 'Test Department' });

      const res = await app.get(`/api/v1/departments/${department.departmentId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.departmentId).toBe(department.departmentId);
      expect(res.body.data.name).toBe('Test Department');
    });

    it('should return 404 for non-existent department', async () => {
      const res = await app.get('/api/v1/departments/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Department not found');
    });
  });

  describe('PUT /api/v1/departments/:id', () => {
    it('should update department', async () => {
      const department = await createTestDepartment(testDivision.divisionId, { name: 'Original' });

      const res = await app.put(`/api/v1/departments/${department.departmentId}`).send({
        name: 'Updated',
        description: 'Updated description',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('should return 404 for non-existent department', async () => {
      const res = await app.put('/api/v1/departments/non-existent-id').send({
        name: 'Updated',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/departments/:id', () => {
    it('should delete department', async () => {
      const department = await createTestDepartment(testDivision.divisionId);

      const res = await app.delete(`/api/v1/departments/${department.departmentId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/departments/${department.departmentId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('GET /api/v1/divisions/:id/departments', () => {
    it('should return departments for a division', async () => {
      await createTestDepartment(testDivision.divisionId, { name: 'Department 1' });
      await createTestDepartment(testDivision.divisionId, { name: 'Department 2' });

      const res = await app.get(`/api/v1/divisions/${testDivision.divisionId}/departments`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for division with no departments', async () => {
      const res = await app.get(`/api/v1/divisions/${testDivision.divisionId}/departments`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
