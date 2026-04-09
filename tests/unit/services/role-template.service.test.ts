import { RoleTemplateService, CreateRoleTemplateDTO, UpdateRoleTemplateDTO } from '../../../src/application/services/role-template.service';
import { prismaMock } from '../setup';
import { HierarchyLevel } from '@prisma/client';

describe('RoleTemplateService', () => {
  const service = new RoleTemplateService();

  const mockRoleTemplate = {
    roleTemplateId: 'role-123',
    companyId: 'company-123',
    name: 'Test Role',
    hierarchyLevel: HierarchyLevel.Specialist,
    description: 'Test Description',
    purpose: 'Test Purpose',
    primaryResponsibilities: ['Responsibility 1', 'Responsibility 2'],
    decisionScope: { scope1: 'value1' },
    requiredArtifacts: ['Artifact 1'],
    requiredReviews: ['Review 1'],
    costClass: 'Standard',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  describe('findAll', () => {
    it('should return all role templates ordered by createdAt desc', async () => {
      const mockTemplates = [mockRoleTemplate, { ...mockRoleTemplate, roleTemplateId: 'role-456' }];
      prismaMock.roleTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await service.findAll();

      expect(result).toEqual(mockTemplates);
      expect(prismaMock.roleTemplate.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no role templates exist', async () => {
      prismaMock.roleTemplate.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a role template by id with related data', async () => {
      prismaMock.roleTemplate.findUnique.mockResolvedValue({
        ...mockRoleTemplate,
        agentProfiles: [],
      });

      const result = await service.findById('role-123');

      expect(result).toEqual({
        ...mockRoleTemplate,
        agentProfiles: [],
      });
      expect(prismaMock.roleTemplate.findUnique).toHaveBeenCalledWith({
        where: { roleTemplateId: 'role-123' },
        include: {
          agentProfiles: true,
        },
      });
    });

    it('should return null when role template not found', async () => {
      prismaMock.roleTemplate.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByCompanyId', () => {
    it('should return role templates for a specific company', async () => {
      const mockTemplates = [mockRoleTemplate];
      prismaMock.roleTemplate.findMany.mockResolvedValue(mockTemplates);

      const result = await service.findByCompanyId('company-123');

      expect(result).toEqual(mockTemplates);
      expect(prismaMock.roleTemplate.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
        orderBy: { hierarchyLevel: 'asc', name: 'asc' },
      });
    });

    it('should return empty array when company has no role templates', async () => {
      prismaMock.roleTemplate.findMany.mockResolvedValue([]);

      const result = await service.findByCompanyId('company-no-roles');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const createDTO: CreateRoleTemplateDTO = {
      companyId: 'company-123',
      name: 'New Role',
      hierarchyLevel: HierarchyLevel.Specialist,
      description: 'New Description',
    };

    it('should create a role template with valid data', async () => {
      prismaMock.roleTemplate.create.mockResolvedValue(mockRoleTemplate);

      const result = await service.create(createDTO);

      expect(result).toEqual(mockRoleTemplate);
      expect(prismaMock.roleTemplate.create).toHaveBeenCalledWith({
        data: {
          companyId: createDTO.companyId,
          name: createDTO.name,
          hierarchyLevel: createDTO.hierarchyLevel,
          description: createDTO.description,
          purpose: undefined,
          primaryResponsibilities: [],
          decisionScope: {},
          requiredArtifacts: [],
          requiredReviews: [],
          costClass: undefined,
        },
      });
    });

    it('should create a role template with all optional fields', async () => {
      const fullDTO: CreateRoleTemplateDTO = {
        ...createDTO,
        purpose: 'New Purpose',
        primaryResponsibilities: ['Resp 1', 'Resp 2'],
        decisionScope: { key: 'value' },
        requiredArtifacts: ['Artifact 1'],
        requiredReviews: ['Review 1'],
        costClass: 'Premium',
      };
      prismaMock.roleTemplate.create.mockResolvedValue({
        ...mockRoleTemplate,
        ...fullDTO,
      });

      await service.create(fullDTO);

      expect(prismaMock.roleTemplate.create).toHaveBeenCalledWith({
        data: {
          companyId: fullDTO.companyId,
          name: fullDTO.name,
          hierarchyLevel: fullDTO.hierarchyLevel,
          description: fullDTO.description,
          purpose: fullDTO.purpose,
          primaryResponsibilities: fullDTO.primaryResponsibilities,
          decisionScope: fullDTO.decisionScope,
          requiredArtifacts: fullDTO.requiredArtifacts,
          requiredReviews: fullDTO.requiredReviews,
          costClass: fullDTO.costClass,
        },
      });
    });

    it('should throw error when prisma create fails', async () => {
      prismaMock.roleTemplate.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDTO)).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    const updateDTO: UpdateRoleTemplateDTO = {
      name: 'Updated Role',
      description: 'Updated Description',
    };

    it('should update a role template with valid data', async () => {
      prismaMock.roleTemplate.update.mockResolvedValue({ ...mockRoleTemplate, ...updateDTO });

      const result = await service.update('role-123', updateDTO);

      expect(result).toEqual({ ...mockRoleTemplate, ...updateDTO });
      expect(prismaMock.roleTemplate.update).toHaveBeenCalledWith({
        where: { roleTemplateId: 'role-123' },
        data: {
          name: updateDTO.name,
          hierarchyLevel: undefined,
          description: updateDTO.description,
          purpose: undefined,
          primaryResponsibilities: undefined,
          decisionScope: undefined,
          requiredArtifacts: undefined,
          requiredReviews: undefined,
          costClass: undefined,
        },
      });
    });

    it('should update role template hierarchy level', async () => {
      const levelUpdateDTO: UpdateRoleTemplateDTO = {
        hierarchyLevel: HierarchyLevel.Management,
      };
      prismaMock.roleTemplate.update.mockResolvedValue({
        ...mockRoleTemplate,
        hierarchyLevel: HierarchyLevel.Management,
      });

      await service.update('role-123', levelUpdateDTO);

      expect(prismaMock.roleTemplate.update).toHaveBeenCalledWith({
        where: { roleTemplateId: 'role-123' },
        data: {
          name: undefined,
          hierarchyLevel: HierarchyLevel.Management,
          description: undefined,
          purpose: undefined,
          primaryResponsibilities: undefined,
          decisionScope: undefined,
          requiredArtifacts: undefined,
          requiredReviews: undefined,
          costClass: undefined,
        },
      });
    });

    it('should throw error when updating non-existent role template', async () => {
      prismaMock.roleTemplate.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.update('non-existent-id', updateDTO)).rejects.toThrow('Record not found');
    });
  });

  describe('delete', () => {
    it('should delete a role template successfully', async () => {
      prismaMock.roleTemplate.delete.mockResolvedValue(mockRoleTemplate);

      await service.delete('role-123');

      expect(prismaMock.roleTemplate.delete).toHaveBeenCalledWith({
        where: { roleTemplateId: 'role-123' },
      });
    });

    it('should throw error when deleting non-existent role template', async () => {
      prismaMock.roleTemplate.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.delete('non-existent-id')).rejects.toThrow('Record not found');
    });
  });

  describe('duplicate', () => {
    it('should duplicate a role template', async () => {
      const originalTemplate = {
        ...mockRoleTemplate,
        primaryResponsibilities: ['Resp 1'],
        decisionScope: { key: 'value' },
        requiredArtifacts: ['Artifact'],
        requiredReviews: ['Review'],
      };
      const duplicatedTemplate = {
        ...originalTemplate,
        roleTemplateId: 'role-duplicated',
        name: 'Test Role (Copy)',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.roleTemplate.findUnique.mockResolvedValue(originalTemplate);
      prismaMock.roleTemplate.create.mockResolvedValue(duplicatedTemplate);

      const result = await service.duplicate('role-123');

      expect(result).toEqual(duplicatedTemplate);
      expect(prismaMock.roleTemplate.create).toHaveBeenCalledWith({
        data: {
          companyId: originalTemplate.companyId,
          name: 'Test Role (Copy)',
          hierarchyLevel: originalTemplate.hierarchyLevel,
          description: originalTemplate.description,
          purpose: originalTemplate.purpose,
          primaryResponsibilities: originalTemplate.primaryResponsibilities,
          decisionScope: originalTemplate.decisionScope,
          requiredArtifacts: originalTemplate.requiredArtifacts,
          requiredReviews: originalTemplate.requiredReviews,
          costClass: originalTemplate.costClass,
        },
      });
    });

    it('should throw error when duplicating non-existent role template', async () => {
      prismaMock.roleTemplate.findUnique.mockResolvedValue(null);

      await expect(service.duplicate('non-existent-id')).rejects.toThrow('Role template not found');
    });
  });
});
