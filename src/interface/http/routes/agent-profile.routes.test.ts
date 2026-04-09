import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import {
  buildTestServer,
  cleanDatabase,
  createTestCompany,
  createTestDivision,
  createTestDepartment,
  createTestTeam,
  createTestRoleTemplate,
  createTestAgentProfile,
  testPrisma,
  checkDatabaseConnection,
  isDatabaseAvailable,
} from './test.setup';

describe('Agent Profile Routes Integration Tests', () => {
  let server: any;
  let app: supertest.SuperTest<supertest.Test>;
  let testCompany: any;
  let testDivision: any;
  let testDepartment: any;
  let testTeam: any;
  let testRoleTemplate: any;

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
    testTeam = await createTestTeam(testDepartment.departmentId);
    testRoleTemplate = await createTestRoleTemplate(testCompany.companyId);
  });

  describe('GET /api/v1/agent-profiles', () => {
    it('should return empty array when no profiles exist', async () => {
      const res = await app.get('/api/v1/agent-profiles');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of agent profiles', async () => {
      await createTestAgentProfile(testTeam.teamId, { displayName: 'Agent A' });
      await createTestAgentProfile(testTeam.teamId, { displayName: 'Agent B' });

      const res = await app.get('/api/v1/agent-profiles');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/agent-profiles', () => {
    it('should create a new agent profile', async () => {
      const profileData = {
        teamId: testTeam.teamId,
        roleTemplateId: testRoleTemplate.roleTemplateId,
        displayName: 'New Agent',
        internalName: 'new-agent',
        seniority: 'Senior',
        maxParallelTasks: 3,
      };

      const res = await app.post('/api/v1/agent-profiles').send(profileData);

      expect(res.status).toBe(201);
      expect(res.body.data.displayName).toBe(profileData.displayName);
      expect(res.body.data.internalName).toBe(profileData.internalName);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/agent-profiles').send({
        displayName: 'Test Agent',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid maxParallelTasks', async () => {
      const res = await app.post('/api/v1/agent-profiles').send({
        teamId: testTeam.teamId,
        displayName: 'Test Agent',
        internalName: 'test-agent',
        maxParallelTasks: 0,
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/agent-profiles/:id', () => {
    it('should return agent profile by id', async () => {
      const profile = await createTestAgentProfile(testTeam.teamId, { displayName: 'Test Agent' });

      const res = await app.get(`/api/v1/agent-profiles/${profile.agentId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.agentId).toBe(profile.agentId);
      expect(res.body.data.displayName).toBe('Test Agent');
    });

    it('should return 404 for non-existent agent profile', async () => {
      const res = await app.get('/api/v1/agent-profiles/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Agent profile not found');
    });
  });

  describe('PUT /api/v1/agent-profiles/:id', () => {
    it('should update agent profile', async () => {
      const profile = await createTestAgentProfile(testTeam.teamId, { displayName: 'Original' });

      const res = await app.put(`/api/v1/agent-profiles/${profile.agentId}`).send({
        displayName: 'Updated',
        maxParallelTasks: 5,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.displayName).toBe('Updated');
      expect(res.body.data.maxParallelTasks).toBe(5);
    });

    it('should return 404 for non-existent agent profile', async () => {
      const res = await app.put('/api/v1/agent-profiles/non-existent-id').send({
        displayName: 'Updated',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/agent-profiles/:id', () => {
    it('should delete agent profile', async () => {
      const profile = await createTestAgentProfile(testTeam.teamId);

      const res = await app.delete(`/api/v1/agent-profiles/${profile.agentId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/agent-profiles/${profile.agentId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('POST /api/v1/agent-profiles/:id/activate', () => {
    it('should activate agent profile', async () => {
      const profile = await createTestAgentProfile(testTeam.teamId, { status: 'inactive' });

      const res = await app.post(`/api/v1/agent-profiles/${profile.agentId}/activate`);

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent agent profile', async () => {
      const res = await app.post('/api/v1/agent-profiles/non-existent-id/activate');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/agent-profiles/:id/deactivate', () => {
    it('should deactivate agent profile', async () => {
      const profile = await createTestAgentProfile(testTeam.teamId);

      const res = await app.post(`/api/v1/agent-profiles/${profile.agentId}/deactivate`);

      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent agent profile', async () => {
      const res = await app.post('/api/v1/agent-profiles/non-existent-id/deactivate');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/teams/:id/agent-profiles', () => {
    it('should return agent profiles for a team', async () => {
      await createTestAgentProfile(testTeam.teamId, { displayName: 'Agent 1' });
      await createTestAgentProfile(testTeam.teamId, { displayName: 'Agent 2' });

      const res = await app.get(`/api/v1/teams/${testTeam.teamId}/agent-profiles`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for team with no agent profiles', async () => {
      const res = await app.get(`/api/v1/teams/${testTeam.teamId}/agent-profiles`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
