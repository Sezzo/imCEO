import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import {
  buildTestServer,
  cleanDatabase,
  createTestCompany,
  createTestRoleTemplate,
  testPrisma,
  checkDatabaseConnection,
  isDatabaseAvailable,
} from './test.setup';

describe('Role Template Routes Integration Tests', () => {
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

  describe('GET /api/v1/role-templates', () => {
    it('should return empty array when no templates exist', async () => {
      const res = await app.get('/api/v1/role-templates');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return list of role templates', async () => {
      await createTestRoleTemplate(testCompany.companyId, { name: 'Role A' });
      await createTestRoleTemplate(testCompany.companyId, { name: 'Role B' });

      const res = await app.get('/api/v1/role-templates');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/role-templates', () => {
    it('should create a new role template', async () => {
      const templateData = {
        companyId: testCompany.companyId,
        name: 'Senior Developer',
        hierarchyLevel: 'Lead',
        description: 'Senior developer role',
        purpose: 'Lead development tasks',
        primaryResponsibilities: ['Code review', 'Architecture'],
      };

      const res = await app.post('/api/v1/role-templates').send(templateData);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe(templateData.name);
      expect(res.body.data.hierarchyLevel).toBe('Lead');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.post('/api/v1/role-templates').send({
        name: 'Test Role',
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid hierarchyLevel', async () => {
      const res = await app.post('/api/v1/role-templates').send({
        companyId: testCompany.companyId,
        name: 'Test Role',
        hierarchyLevel: 'InvalidLevel',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/role-templates/:id', () => {
    it('should return role template by id', async () => {
      const template = await createTestRoleTemplate(testCompany.companyId, { name: 'Test Role' });

      const res = await app.get(`/api/v1/role-templates/${template.roleTemplateId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.roleTemplateId).toBe(template.roleTemplateId);
      expect(res.body.data.name).toBe('Test Role');
    });

    it('should return 404 for non-existent role template', async () => {
      const res = await app.get('/api/v1/role-templates/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Role template not found');
    });
  });

  describe('PUT /api/v1/role-templates/:id', () => {
    it('should update role template', async () => {
      const template = await createTestRoleTemplate(testCompany.companyId, { name: 'Original' });

      const res = await app.put(`/api/v1/role-templates/${template.roleTemplateId}`).send({
        name: 'Updated',
        description: 'Updated description',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated');
    });

    it('should return 404 for non-existent role template', async () => {
      const res = await app.put('/api/v1/role-templates/non-existent-id').send({
        name: 'Updated',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/role-templates/:id', () => {
    it('should delete role template', async () => {
      const template = await createTestRoleTemplate(testCompany.companyId);

      const res = await app.delete(`/api/v1/role-templates/${template.roleTemplateId}`);

      expect(res.status).toBe(204);

      const checkRes = await app.get(`/api/v1/role-templates/${template.roleTemplateId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('POST /api/v1/role-templates/:id/duplicate', () => {
    it('should duplicate a role template', async () => {
      const template = await createTestRoleTemplate(testCompany.companyId, { name: 'Original' });

      const res = await app.post(`/api/v1/role-templates/${template.roleTemplateId}/duplicate`);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toContain('Copy');
      expect(res.body.data.roleTemplateId).not.toBe(template.roleTemplateId);
    });

    it('should return 404 for non-existent role template', async () => {
      const res = await app.post('/api/v1/role-templates/non-existent-id/duplicate');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/companies/:id/role-templates', () => {
    it('should return role templates for a company', async () => {
      await createTestRoleTemplate(testCompany.companyId, { name: 'Role 1' });
      await createTestRoleTemplate(testCompany.companyId, { name: 'Role 2' });

      const res = await app.get(`/api/v1/companies/${testCompany.companyId}/role-templates`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array for company with no role templates', async () => {
      const res = await app.get(`/api/v1/companies/${testCompany.companyId}/role-templates`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
