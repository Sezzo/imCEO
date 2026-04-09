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

describe('Session Routes Integration Tests', () => {
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

  const createTeamSession = async (data?: any) => {
    const sessionData = {
      teamId: testTeam.teamId,
      sessionPurpose: 'Test session',
      ...data,
    };

    const res = await app.post('/api/v1/sessions').send(sessionData);
    return res.body.data;
  };

  // Team Session Routes
  describe('GET /api/v1/sessions', () => {
    it('should return list of sessions', async () => {
      const res = await app.get('/api/v1/sessions');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/sessions', () => {
    it('should create a new team session', async () => {
      const sessionData = {
        teamId: testTeam.teamId,
        sessionPurpose: 'New test session',
        initiatingWorkItemId: null,
      };

      const res = await app.post('/api/v1/sessions').send(sessionData);

      expect(res.status).toBe(201);
      expect(res.body.data.teamId).toBe(testTeam.teamId);
      expect(res.body.data.sessionPurpose).toBe(sessionData.sessionPurpose);
      expect(res.body.data.currentState).toBe('Queued');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/sessions').send({
        sessionPurpose: 'Test',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid teamId format', async () => {
      const res = await app.post('/api/v1/sessions').send({
        teamId: 'invalid-uuid',
        sessionPurpose: 'Test',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/sessions/:id', () => {
    it('should return session by id', async () => {
      const session = await createTeamSession();

      const res = await app.get(`/api/v1/sessions/${session.teamSessionId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.teamSessionId).toBe(session.teamSessionId);
    });

    it('should return 404 for non-existent session', async () => {
      const res = await app.get('/api/v1/sessions/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Session not found');
    });
  });

  describe('GET /api/v1/teams/:teamId/sessions', () => {
    it('should return sessions for a team', async () => {
      await createTeamSession();
      await createTeamSession({ sessionPurpose: 'Second session' });

      const res = await app.get(`/api/v1/teams/${testTeam.teamId}/sessions`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/teams/:teamId/sessions/active', () => {
    it('should return active sessions for a team', async () => {
      const res = await app.get(`/api/v1/teams/${testTeam.teamId}/sessions/active`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/sessions/:id/launch', () => {
    it('should launch a session', async () => {
      const session = await createTeamSession();
      const agent = await createTestAgentProfile(testTeam.teamId);

      const res = await app.post(`/api/v1/sessions/${session.teamSessionId}/launch`).send({
        agentIds: [agent.agentId],
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 for missing agentIds', async () => {
      const session = await createTeamSession();

      const res = await app.post(`/api/v1/sessions/${session.teamSessionId}/launch`).send({});

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/sessions/:id/state', () => {
    it('should update session state', async () => {
      const session = await createTeamSession();

      const res = await app.patch(`/api/v1/sessions/${session.teamSessionId}/state`).send({
        state: 'Active',
        reason: 'Starting session',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 for invalid state', async () => {
      const session = await createTeamSession();

      const res = await app.patch(`/api/v1/sessions/${session.teamSessionId}/state`).send({
        state: 'InvalidState',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/sessions/:id/terminate', () => {
    it('should terminate a session', async () => {
      const session = await createTeamSession();

      const res = await app.post(`/api/v1/sessions/${session.teamSessionId}/terminate`).send({
        reason: 'Test complete',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/sessions/:id/stats', () => {
    it('should return session stats', async () => {
      const session = await createTeamSession();

      const res = await app.get(`/api/v1/sessions/${session.teamSessionId}/stats`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 404 for non-existent session', async () => {
      const res = await app.get('/api/v1/sessions/non-existent-id/stats');

      expect(res.status).toBe(404);
    });
  });

  // Agent Session Routes
  describe('GET /api/v1/sessions/:id/agents', () => {
    it('should return agent sessions for team session', async () => {
      const session = await createTeamSession();

      const res = await app.get(`/api/v1/sessions/${session.teamSessionId}/agents`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/agents/:agentId/sessions', () => {
    it('should return sessions by agent', async () => {
      const agent = await createTestAgentProfile(testTeam.teamId);

      const res = await app.get(`/api/v1/agents/${agent.agentId}/sessions`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/agent-sessions/:id', () => {
    it('should return agent session by id', async () => {
      const agent = await createTestAgentProfile(testTeam.teamId);
      const session = await createTeamSession();

      // First launch to create agent sessions
      await app.post(`/api/v1/sessions/${session.teamSessionId}/launch`).send({
        agentIds: [agent.agentId],
      });

      // Get agent sessions
      const agentsRes = await app.get(`/api/v1/sessions/${session.teamSessionId}/agents`);
      const agentSessions = agentsRes.body.data;

      if (agentSessions && agentSessions.length > 0) {
        const res = await app.get(`/api/v1/agent-sessions/${agentSessions[0].agentSessionId}`);
        expect(res.status).toBe(200);
      }
    });

    it('should return 404 for non-existent agent session', async () => {
      const res = await app.get('/api/v1/agent-sessions/non-existent-id');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/agent-sessions/:id/metrics', () => {
    it('should return agent session metrics', async () => {
      // Create and launch a session to get agent sessions
      const session = await createTeamSession();
      const agent = await createTestAgentProfile(testTeam.teamId);

      await app.post(`/api/v1/sessions/${session.teamSessionId}/launch`).send({
        agentIds: [agent.agentId],
      });

      // Get the created agent session
      const agentsRes = await app.get(`/api/v1/sessions/${session.teamSessionId}/agents`);
      const agentSessions = agentsRes.body.data;

      if (agentSessions && agentSessions.length > 0) {
        const res = await app.get(`/api/v1/agent-sessions/${agentSessions[0].agentSessionId}/metrics`);
        expect(res.status).toBe(200);
      }
    });
  });

  describe('PATCH /api/v1/agent-sessions/:id/state', () => {
    it('should update agent session state', async () => {
      const session = await createTeamSession();
      const agent = await createTestAgentProfile(testTeam.teamId);

      await app.post(`/api/v1/sessions/${session.teamSessionId}/launch`).send({
        agentIds: [agent.agentId],
      });

      const agentsRes = await app.get(`/api/v1/sessions/${session.teamSessionId}/agents`);
      const agentSessions = agentsRes.body.data;

      if (agentSessions && agentSessions.length > 0) {
        const res = await app.patch(`/api/v1/agent-sessions/${agentSessions[0].agentSessionId}/state`).send({
          state: 'Running',
        });
        expect(res.status).toBe(200);
      }
    });

    it('should return 400 for invalid state', async () => {
      const res = await app.patch('/api/v1/agent-sessions/some-id/state').send({
        state: 'InvalidState',
      });

      expect(res.status).toBe(400);
    });
  });

  // Cost Enforcement Routes
  describe('POST /api/v1/cost-policies', () => {
    it('should register budget policy', async () => {
      const policyData = {
        scopeType: 'team',
        scopeId: testTeam.teamId,
        dailyLimit: 100,
        monthlyLimit: 1000,
        alertThresholds: [50, 75, 90, 100],
      };

      const res = await app.post('/api/v1/cost-policies').send(policyData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid scope type', async () => {
      const res = await app.post('/api/v1/cost-policies').send({
        scopeType: 'invalid',
        scopeId: testTeam.teamId,
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/cost-policies', () => {
    it('should return active budget policies', async () => {
      const res = await app.get('/api/v1/cost-policies');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/:scopeType/:scopeId/costs', () => {
    it('should return cost summary', async () => {
      const res = await app.get(`/api/v1/team/${testTeam.teamId}/costs`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should filter by period', async () => {
      const res = await app.get(`/api/v1/team/${testTeam.teamId}/costs?period=day`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // WebSocket Routes
  describe('GET /api/v1/ws/events', () => {
    it('should return recent events', async () => {
      const res = await app.get('/api/v1/ws/events');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should filter events with query params', async () => {
      const res = await app.get('/api/v1/ws/events?limit=10&types=session_created');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/ws/stats', () => {
    it('should return WebSocket stats', async () => {
      const res = await app.get('/api/v1/ws/stats');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.connectedClients).toBeDefined();
      expect(res.body.data.subscribers).toBeDefined();
    });
  });

  // Command Center Routes
  describe('GET /api/v1/command-center/sessions', () => {
    it('should return command center sessions overview', async () => {
      const res = await app.get('/api/v1/command-center/sessions');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/command-center/metrics', () => {
    it('should return command center metrics', async () => {
      const res = await app.get('/api/v1/command-center/metrics');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.sessions).toBeDefined();
      expect(res.body.data.agents).toBeDefined();
      expect(res.body.data.costs).toBeDefined();
      expect(res.body.data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v1/command-center/agents/live', () => {
    it('should return live agent activity', async () => {
      const res = await app.get('/api/v1/command-center/agents/live');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });
});
