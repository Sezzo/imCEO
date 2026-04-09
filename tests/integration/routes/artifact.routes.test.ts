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

describe('Artifact Routes Integration Tests', () => {
  let server: any;
  let app: supertest.SuperTest<supertest.Test>;
  let testCompany: any;
  let testDivision: any;
  let testDepartment: any;
  let testTeam: any;
  let testAgent: any;

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
    testAgent = await createTestAgentProfile(testTeam.teamId);
  });

  const createTestArtifact = async (agentId: string, data?: Partial<any>) => {
    const artifactData = {
      agentId,
      artifactType: 'Document',
      title: 'Test Artifact',
      content: { text: 'Test content' },
      ...data,
    };

    const res = await app.post('/api/v1/artifacts').send(artifactData);
    return res.body.data;
  };

  describe('GET /api/v1/artifacts', () => {
    it('should return empty array when no artifacts exist', async () => {
      const res = await app.get('/api/v1/artifacts');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of artifacts', async () => {
      await createTestArtifact(testAgent.agentId, { title: 'Artifact A' });
      await createTestArtifact(testAgent.agentId, { title: 'Artifact B' });

      const res = await app.get('/api/v1/artifacts');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/artifacts', () => {
    it('should create a new artifact', async () => {
      const artifactData = {
        agentId: testAgent.agentId,
        artifactType: 'Document',
        title: 'New Artifact',
        content: { text: 'New content' },
      };

      const res = await app.post('/api/v1/artifacts').send(artifactData);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe(artifactData.title);
      expect(res.body.data.agentId).toBe(testAgent.agentId);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/artifacts').send({
        title: 'Test Artifact',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid artifactType', async () => {
      const res = await app.post('/api/v1/artifacts').send({
        agentId: testAgent.agentId,
        artifactType: 'InvalidType',
        title: 'Test Artifact',
        content: {},
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/artifacts/:id', () => {
    it('should return artifact by id', async () => {
      const artifact = await createTestArtifact(testAgent.agentId, { title: 'Test Artifact' });

      const res = await app.get(`/api/v1/artifacts/${artifact.artifactId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.artifactId).toBe(artifact.artifactId);
      expect(res.body.data.title).toBe('Test Artifact');
    });

    it('should return 404 for non-existent artifact', async () => {
      const res = await app.get('/api/v1/artifacts/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Artifact not found');
    });
  });

  describe('PUT /api/v1/artifacts/:id', () => {
    it('should update artifact', async () => {
      const artifact = await createTestArtifact(testAgent.agentId, { title: 'Original' });

      const res = await app.put(`/api/v1/artifacts/${artifact.artifactId}`).send({
        title: 'Updated',
        content: { text: 'Updated content' },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated');
    });

    it('should return 404 for non-existent artifact', async () => {
      const res = await app.put('/api/v1/artifacts/non-existent-id').send({
        title: 'Updated',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/artifacts/:id', () => {
    it('should delete artifact', async () => {
      const artifact = await createTestArtifact(testAgent.agentId);

      const res = await app.delete(`/api/v1/artifacts/${artifact.artifactId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/artifacts/${artifact.artifactId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('GET /api/v1/agents/:id/artifacts', () => {
    it('should return artifacts for an agent', async () => {
      await createTestArtifact(testAgent.agentId, { title: 'Artifact 1' });
      await createTestArtifact(testAgent.agentId, { title: 'Artifact 2' });

      const res = await app.get(`/api/v1/agents/${testAgent.agentId}/artifacts`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for agent with no artifacts', async () => {
      const res = await app.get(`/api/v1/agents/${testAgent.agentId}/artifacts`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/artifacts/:id/content', () => {
    it('should return artifact content', async () => {
      const artifact = await createTestArtifact(testAgent.agentId, {
        title: 'Test Artifact',
        content: { text: 'Test content data' },
      });

      const res = await app.get(`/api/v1/artifacts/${artifact.artifactId}/content`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 404 for non-existent artifact', async () => {
      const res = await app.get('/api/v1/artifacts/non-existent-id/content');

      expect(res.status).toBe(404);
    });
  });
});
