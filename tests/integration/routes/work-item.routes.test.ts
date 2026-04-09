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
} from '../test.setup';

describe('Work Item Routes Integration Tests', () => {
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

  const createTestWorkItem = async (teamId: string, data?: Partial<any>) => {
    const workItemData = {
      teamId,
      title: 'Test Work Item',
      description: 'A test work item',
      workItemType: 'Feature',
      priority: 'Medium',
      ...data,
    };

    const res = await app.post('/api/v1/work-items').send(workItemData);
    return res.body.data;
  };

  describe('GET /api/v1/work-items', () => {
    it('should return empty array when no work items exist', async () => {
      const res = await app.get('/api/v1/work-items');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of work items', async () => {
      await createTestWorkItem(testTeam.teamId, { title: 'Work Item A' });
      await createTestWorkItem(testTeam.teamId, { title: 'Work Item B' });

      const res = await app.get('/api/v1/work-items');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/work-items', () => {
    it('should create a new work item', async () => {
      const workItemData = {
        teamId: testTeam.teamId,
        title: 'New Work Item',
        description: 'A new work item',
        workItemType: 'Bug',
        priority: 'High',
      };

      const res = await app.post('/api/v1/work-items').send(workItemData);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe(workItemData.title);
      expect(res.body.data.teamId).toBe(testTeam.teamId);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/work-items').send({
        description: 'Missing title',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid workItemType', async () => {
      const res = await app.post('/api/v1/work-items').send({
        teamId: testTeam.teamId,
        title: 'Test Work Item',
        workItemType: 'InvalidType',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/work-items/:id', () => {
    it('should return work item by id', async () => {
      const workItem = await createTestWorkItem(testTeam.teamId, { title: 'Test Work Item' });

      const res = await app.get(`/api/v1/work-items/${workItem.workItemId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workItemId).toBe(workItem.workItemId);
      expect(res.body.data.title).toBe('Test Work Item');
    });

    it('should return 404 for non-existent work item', async () => {
      const res = await app.get('/api/v1/work-items/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Work item not found');
    });
  });

  describe('PUT /api/v1/work-items/:id', () => {
    it('should update work item', async () => {
      const workItem = await createTestWorkItem(testTeam.teamId, { title: 'Original' });

      const res = await app.put(`/api/v1/work-items/${workItem.workItemId}`).send({
        title: 'Updated',
        description: 'Updated description',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated');
    });

    it('should return 404 for non-existent work item', async () => {
      const res = await app.put('/api/v1/work-items/non-existent-id').send({
        title: 'Updated',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/work-items/:id', () => {
    it('should delete work item', async () => {
      const workItem = await createTestWorkItem(testTeam.teamId);

      const res = await app.delete(`/api/v1/work-items/${workItem.workItemId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/work-items/${workItem.workItemId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('GET /api/v1/teams/:id/work-items', () => {
    it('should return work items for a team', async () => {
      await createTestWorkItem(testTeam.teamId, { title: 'Work Item 1' });
      await createTestWorkItem(testTeam.teamId, { title: 'Work Item 2' });

      const res = await app.get(`/api/v1/teams/${testTeam.teamId}/work-items`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for team with no work items', async () => {
      const res = await app.get(`/api/v1/teams/${testTeam.teamId}/work-items`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('PATCH /api/v1/work-items/:id/state', () => {
    it('should update work item state', async () => {
      const workItem = await createTestWorkItem(testTeam.teamId);

      const res = await app.patch(`/api/v1/work-items/${workItem.workItemId}/state`).send({
        state: 'InProgress',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.currentState).toBe('InProgress');
    });

    it('should return 400 for invalid state', async () => {
      const workItem = await createTestWorkItem(testTeam.teamId);

      const res = await app.patch(`/api/v1/work-items/${workItem.workItemId}/state`).send({
        state: 'InvalidState',
      });

      expect(res.status).toBe(400);
    });
  });
});
