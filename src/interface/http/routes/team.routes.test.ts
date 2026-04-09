import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import {
  buildTestServer,
  cleanDatabase,
  createTestCompany,
  createTestDivision,
  createTestDepartment,
  createTestTeam,
  testPrisma,
  checkDatabaseConnection,
  isDatabaseAvailable,
} from './test.setup';

describe('Team Routes Integration Tests', () => {
  let server: any;
  let app: supertest.SuperTest<supertest.Test>;
  let testCompany: any;
  let testDivision: any;
  let testDepartment: any;

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
    testDepartment = await createTestDepartment(testDivision.divisionId);
  });

  describe('GET /api/v1/teams', () => {
    it('should return empty array when no teams exist', async () => {
      const res = await app.get('/api/v1/teams');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of teams', async () => {
      await createTestTeam(testDepartment.departmentId, { name: 'Team A' });
      await createTestTeam(testDepartment.departmentId, { name: 'Team B' });

      const res = await app.get('/api/v1/teams');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/teams', () => {
    it('should create a new team', async () => {
      const teamData = {
        departmentId: testDepartment.departmentId,
        name: 'New Team',
        description: 'A new team',
        mission: 'Test mission',
      };

      const res = await app.post('/api/v1/teams').send(teamData);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(teamData.name);
      expect(res.body.data.mission).toBe(teamData.mission);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/teams').send({
        name: 'Test Team',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid departmentId format', async () => {
      const res = await app.post('/api/v1/teams').send({
        departmentId: 'invalid-uuid',
        name: 'Test Team',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/teams/:id', () => {
    it('should return team by id', async () => {
      const team = await createTestTeam(testDepartment.departmentId, { name: 'Test Team' });

      const res = await app.get(`/api/v1/teams/${team.teamId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.teamId).toBe(team.teamId);
      expect(res.body.data.name).toBe('Test Team');
    });

    it('should return 404 for non-existent team', async () => {
      const res = await app.get('/api/v1/teams/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Team not found');
    });
  });

  describe('PUT /api/v1/teams/:id', () => {
    it('should update team', async () => {
      const team = await createTestTeam(testDepartment.departmentId, { name: 'Original' });

      const res = await app.put(`/api/v1/teams/${team.teamId}`).send({
        name: 'Updated',
        description: 'Updated description',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('should return 404 for non-existent team', async () => {
      const res = await app.put('/api/v1/teams/non-existent-id').send({
        name: 'Updated',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/teams/:id', () => {
    it('should delete team', async () => {
      const team = await createTestTeam(testDepartment.departmentId);

      const res = await app.delete(`/api/v1/teams/${team.teamId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/teams/${team.teamId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('GET /api/v1/departments/:id/teams', () => {
    it('should return teams for a department', async () => {
      await createTestTeam(testDepartment.departmentId, { name: 'Team 1' });
      await createTestTeam(testDepartment.departmentId, { name: 'Team 2' });

      const res = await app.get(`/api/v1/departments/${testDepartment.departmentId}/teams`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for department with no teams', async () => {
      const res = await app.get(`/api/v1/departments/${testDepartment.departmentId}/teams`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
