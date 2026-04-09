import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import {
  buildTestServer,
  cleanDatabase,
  createTestCompany,
  createTestDivision,
  createTestDepartment,
  createTestTeam,
  createTestAgentProfile,
  testPrisma,
  checkDatabaseConnection,
  isDatabaseAvailable,
} from '../test.setup';

describe('Agent Profile Routes Integration Tests', () => {
  let server: any;
  let app: supertest.SuperTest<supertest.Test>;
  let testCompany: any;
  let testDivision: any;
  let testDepartment: any;
  let testTeam: any;

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
  });

  describe('GET /api/v1/agents', () => {
    it('should return empty array when no agents exist', async () => {
      const res = await app.get('/api/v1/agents');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of agents', async () => {
      await createTestAgentProfile(testTeam.teamId, { displayName: 'Agent A' });
      await createTestAgentProfile(testTeam.teamId, { displayName: 'Agent B' });

      const res = await app.get('/api/v1/agents');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/agents', () => {
    it('should create a new agent profile', async () => {
      const agentData = {
        teamId: testTeam.teamId,
        displayName: 'New Agent',
        internalName: 'new-agent',
      };

      const res = await app.post('/api/v1/agents').send(agentData);

      expect(res.status).toBe(201);
      expect(res.body.data.displayName).toBe(agentData.displayName);
      expect(res.body.data.teamId).toBe(testTeam.teamId);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/agents').send({
        displayName: 'Test Agent',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid teamId format', async () => {
      const res = await app.post('/api/v1/agents').send({
        teamId: 'invalid-uuid',
        displayName: 'Test Agent',
        internalName: 'test-agent',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/agents/:id', () => {
    it('should return agent by id', async () => {
      const agent = await createTestAgentProfile(testTeam.teamId, { displayName: 'Test Agent' });

      const res = await app.get(`/api/v1/agents/${agent.agentId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.agentId).toBe(agent.agentId);
      expect(res.body.data.displayName).toBe('Test Agent');
    });

    it('should return 404 for non-existent agent', async () => {
      const res = await app.get('/api/v1/agents/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Agent not found');
    });
  });

  describe('PUT /api/v1/agents/:id', () => {
    it('should update agent', async () => {
      const agent = await createTestAgentProfile(testTeam.teamId, { displayName: 'Original' });

      const res = await app.put(`/api/v1/agents/${agent.agentId}`).send({
        displayName: 'Updated',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.displayName).toBe('Updated');
    });

    it('should return 404 for non-existent agent', async () => {
      const res = await app.put('/api/v1/agents/non-existent-id').send({
        displayName: 'Updated',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/agents/:id', () => {
    it('should delete agent', async () => {
      const agent = await createTestAgentProfile(testTeam.teamId);

      const res = await app.delete(`/api/v1/agents/${agent.agentId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/agents/${agent.agentId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('GET /api/v1/teams/:id/agents', () => {
    it('should return agents for a team', async () => {
      await createTestAgentProfile(testTeam.teamId, { displayName: 'Agent 1' });
      await createTestAgentProfile(testTeam.teamId, { displayName: 'Agent 2' });

      const res = await app.get(`/api/v1/teams/${testTeam.teamId}/agents`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for team with no agents', async () => {
      const res = await app.get(`/api/v1/teams/${testTeam.teamId}/agents`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
