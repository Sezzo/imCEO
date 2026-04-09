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
} from './test.setup';

describe('Work Item Routes Integration Tests', () => {
  let server: any;
  let app: supertest.SuperTest<supertest.Test>;
  let testCompany: any;
  let testDivision: any;
  let testDepartment: any;
  let testTeam: any;

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
    testCompany = await createTestCompany();
    testDivision = await createTestDivision(testCompany.companyId);
    testDepartment = await createTestDepartment(testDivision.divisionId);
    testTeam = await createTestTeam(testDepartment.departmentId);
  });

  const createWorkItem = async (data?: any) => {
    const workItemData = {
      type: 'Task',
      title: 'Test Work Item',
      description: 'A test work item',
      companyId: testCompany.companyId,
      owningTeamId: testTeam.teamId,
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
      await createWorkItem({ title: 'Item A' });
      await createWorkItem({ title: 'Item B' });

      const res = await app.get('/api/v1/work-items');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by state', async () => {
      await createWorkItem({ title: 'Draft Item', state: 'Draft' });
      await createWorkItem({ title: 'Active Item', state: 'InProgress' });

      const res = await app.get('/api/v1/work-items?state=Draft');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Draft Item');
    });

    it('should filter by type', async () => {
      await createWorkItem({ title: 'Task Item', type: 'Task' });
      await createWorkItem({ title: 'Bug Item', type: 'Bug' });

      const res = await app.get('/api/v1/work-items?type=Bug');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('Bug');
    });
  });

  describe('POST /api/v1/work-items', () => {
    it('should create a new work item', async () => {
      const workItemData = {
        type: 'Task',
        title: 'New Work Item',
        description: 'A new work item',
        companyId: testCompany.companyId,
        owningTeamId: testTeam.teamId,
        priority: 'High',
        severity: 'Medium',
        estimatedEffort: 8,
      };

      const res = await app.post('/api/v1/work-items').send(workItemData);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe(workItemData.title);
      expect(res.body.data.type).toBe('Task');
      expect(res.body.data.state).toBe('Draft');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/work-items').send({
        description: 'Missing title and type',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid work item type', async () => {
      const res = await app.post('/api/v1/work-items').send({
        type: 'InvalidType',
        title: 'Test Item',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/work-items/:id', () => {
    it('should return work item by id', async () => {
      const workItem = await createWorkItem({ title: 'Test Item' });

      const res = await app.get(`/api/v1/work-items/${workItem.workItemId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workItemId).toBe(workItem.workItemId);
      expect(res.body.data.title).toBe('Test Item');
    });

    it('should return 404 for non-existent work item', async () => {
      const res = await app.get('/api/v1/work-items/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Work item not found');
    });
  });

  describe('PUT /api/v1/work-items/:id', () => {
    it('should update work item', async () => {
      const workItem = await createWorkItem({ title: 'Original' });

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
      const workItem = await createWorkItem();

      const res = await app.delete(`/api/v1/work-items/${workItem.workItemId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/work-items/${workItem.workItemId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('POST /api/v1/work-items/:id/transition', () => {
    it('should transition work item state', async () => {
      const workItem = await createWorkItem({ state: 'Draft' });

      const res = await app.post(`/api/v1/work-items/${workItem.workItemId}/transition`).send({
        toState: 'InProgress',
        reason: 'Starting work',
      });

      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid state transition', async () => {
      const workItem = await createWorkItem();

      const res = await app.post(`/api/v1/work-items/${workItem.workItemId}/transition`).send({
        toState: 'InvalidState',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/work-items/:id/history', () => {
    it('should return work item history', async () => {
      const workItem = await createWorkItem();

      const res = await app.get(`/api/v1/work-items/${workItem.workItemId}/history`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/work-items/board', () => {
    it('should return work item board', async () => {
      await createWorkItem({ title: 'Item 1' });
      await createWorkItem({ title: 'Item 2' });

      const res = await app.get('/api/v1/work-items/board');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/work-items/:id/hierarchy-tree', () => {
    it('should return work item hierarchy tree', async () => {
      const parentItem = await createWorkItem({ title: 'Parent' });
      await createWorkItem({ title: 'Child', parentWorkItemId: parentItem.workItemId });

      const res = await app.get(`/api/v1/work-items/${parentItem.workItemId}/hierarchy-tree`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('should return 404 for non-existent work item', async () => {
      const res = await app.get('/api/v1/work-items/non-existent-id/hierarchy-tree');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/work-items/:id/ancestors', () => {
    it('should return work item ancestors', async () => {
      const grandparent = await createWorkItem({ title: 'Grandparent' });
      const parent = await createWorkItem({ title: 'Parent', parentWorkItemId: grandparent.workItemId });
      const child = await createWorkItem({ title: 'Child', parentWorkItemId: parent.workItemId });

      const res = await app.get(`/api/v1/work-items/${child.workItemId}/ancestors`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/work-items/:id/descendants', () => {
    it('should return work item descendants', async () => {
      const parent = await createWorkItem({ title: 'Parent' });
      await createWorkItem({ title: 'Child 1', parentWorkItemId: parent.workItemId });
      await createWorkItem({ title: 'Child 2', parentWorkItemId: parent.workItemId });

      const res = await app.get(`/api/v1/work-items/${parent.workItemId}/descendants`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/work-items/:id/siblings', () => {
    it('should return work item siblings', async () => {
      const parent = await createWorkItem({ title: 'Parent' });
      const child1 = await createWorkItem({ title: 'Child 1', parentWorkItemId: parent.workItemId });
      await createWorkItem({ title: 'Child 2', parentWorkItemId: parent.workItemId });

      const res = await app.get(`/api/v1/work-items/${child1.workItemId}/siblings`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/work-items/:id/move', () => {
    it('should move work item in hierarchy', async () => {
      const item = await createWorkItem({ title: 'Item' });
      const newParent = await createWorkItem({ title: 'New Parent' });

      const res = await app.post(`/api/v1/work-items/${item.workItemId}/move`).send({
        newParentId: newParent.workItemId,
      });

      expect(res.status).toBe(204);
    });

    it('should allow moving to root', async () => {
      const item = await createWorkItem({ title: 'Item' });

      const res = await app.post(`/api/v1/work-items/${item.workItemId}/move`).send({
        newParentId: null,
      });

      expect(res.status).toBe(204);
    });
  });

  describe('GET /api/v1/work-items/:id/impact-analysis', () => {
    it('should return impact analysis', async () => {
      const item = await createWorkItem({ title: 'Item' });

      const res = await app.get(`/api/v1/work-items/${item.workItemId}/impact-analysis`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/work-items/:id/rollup-progress', () => {
    it('should return rollup progress', async () => {
      const item = await createWorkItem({ title: 'Item' });

      const res = await app.get(`/api/v1/work-items/${item.workItemId}/rollup-progress`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/work-items/:id/hierarchy-path', () => {
    it('should return hierarchy path', async () => {
      const item = await createWorkItem({ title: 'Item' });

      const res = await app.get(`/api/v1/work-items/${item.workItemId}/hierarchy-path`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/companies/:companyId/work-items/orphans', () => {
    it('should return orphan work items', async () => {
      await createWorkItem({ title: 'Orphan Item', parentWorkItemId: null });

      const res = await app.get(`/api/v1/companies/${testCompany.companyId}/work-items/orphans`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/work-items/bulk-update-parent', () => {
    it('should bulk update parent', async () => {
      const newParent = await createWorkItem({ title: 'New Parent' });
      const child1 = await createWorkItem({ title: 'Child 1' });
      const child2 = await createWorkItem({ title: 'Child 2' });

      const res = await app.post('/api/v1/work-items/bulk-update-parent').send({
        childIds: [child1.workItemId, child2.workItemId],
        newParentId: newParent.workItemId,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.updatedCount).toBe(2);
    });
  });
});
