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

describe('Artifact Routes Integration Tests', () => {
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

  const createArtifact = async (data?: any) => {
    const artifactData = {
      type: 'DocumentationDraft',
      title: 'Test Artifact',
      description: 'A test artifact',
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
      await createArtifact({ title: 'Artifact A' });
      await createArtifact({ title: 'Artifact B' });

      const res = await app.get('/api/v1/artifacts');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by type', async () => {
      await createArtifact({ title: 'Doc', type: 'DocumentationDraft' });
      await createArtifact({ title: 'Spec', type: 'TechnicalSpec' });

      const res = await app.get('/api/v1/artifacts?type=TechnicalSpec');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('TechnicalSpec');
    });

    it('should filter by status', async () => {
      await createArtifact({ title: 'Draft Artifact', status: 'Draft' });
      await createArtifact({ title: 'Approved Artifact', status: 'Approved' });

      const res = await app.get('/api/v1/artifacts?status=Approved');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('Approved');
    });
  });

  describe('POST /api/v1/artifacts', () => {
    it('should create a new artifact', async () => {
      const artifactData = {
        type: 'DocumentationDraft',
        title: 'New Artifact',
        description: 'A new artifact',
        content: 'Artifact content here',
        ownerTeamId: testTeam.teamId,
      };

      const res = await app.post('/api/v1/artifacts').send(artifactData);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe(artifactData.title);
      expect(res.body.data.type).toBe('DocumentationDraft');
      expect(res.body.data.status).toBe('Draft');
      expect(res.body.data.version).toBe('1.0.0');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/artifacts').send({
        description: 'Missing title and type',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid artifact type', async () => {
      const res = await app.post('/api/v1/artifacts').send({
        type: 'InvalidType',
        title: 'Test Artifact',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/artifacts/:id', () => {
    it('should return artifact by id', async () => {
      const artifact = await createArtifact({ title: 'Test Artifact' });

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
      const artifact = await createArtifact({ title: 'Original' });

      const res = await app.put(`/api/v1/artifacts/${artifact.artifactId}`).send({
        title: 'Updated',
        description: 'Updated description',
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
      const artifact = await createArtifact();

      const res = await app.delete(`/api/v1/artifacts/${artifact.artifactId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/artifacts/${artifact.artifactId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('POST /api/v1/artifacts/:id/versions', () => {
    it('should create a new version of artifact', async () => {
      const artifact = await createArtifact({ content: 'Version 1' });

      const res = await app.post(`/api/v1/artifacts/${artifact.artifactId}/versions`).send({
        content: 'Version 2 content',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 400 for missing content', async () => {
      const artifact = await createArtifact();

      const res = await app.post(`/api/v1/artifacts/${artifact.artifactId}/versions`).send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent artifact', async () => {
      const res = await app.post('/api/v1/artifacts/non-existent-id/versions').send({
        content: 'New content',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/artifacts/:id/versions', () => {
    it('should return artifact versions', async () => {
      const artifact = await createArtifact();

      // Create a version first
      await app.post(`/api/v1/artifacts/${artifact.artifactId}/versions`).send({
        content: 'Version 2',
      });

      const res = await app.get(`/api/v1/artifacts/${artifact.artifactId}/versions`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 404 for non-existent artifact', async () => {
      const res = await app.get('/api/v1/artifacts/non-existent-id/versions');

      expect(res.status).toBe(404);
    });
  });
});
