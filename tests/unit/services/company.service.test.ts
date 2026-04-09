import { CompanyService, CreateCompanyDTO, UpdateCompanyDTO } from '../../../src/application/services/company.service';
import { prismaMock } from '../../setup';

describe('CompanyService', () => {
  const service = new CompanyService();

  const mockCompany = {
    companyId: 'company-123',
    name: 'Test Company',
    description: 'Test Description',
    industry: 'Technology',
    primaryObjective: 'Test Objective',
    operatingMode: 'Test Mode',
    globalPrompt: 'Test Prompt',
    globalPolicies: { policy1: 'value1' },
    globalSkills: ['skill1', 'skill2'],
    globalMcps: ['mcp1'],
    globalPlugins: ['plugin1'],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  describe('findAll', () => {
    it('should return all companies ordered by createdAt desc', async () => {
      const mockCompanies = [mockCompany, { ...mockCompany, companyId: 'company-456' }];
      prismaMock.company.findMany.mockResolvedValue(mockCompanies);

      const result = await service.findAll();

      expect(result).toEqual(mockCompanies);
      expect(prismaMock.company.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no companies exist', async () => {
      prismaMock.company.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a company by id with related data', async () => {
      prismaMock.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.findById('company-123');

      expect(result).toEqual(mockCompany);
      expect(prismaMock.company.findUnique).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
        include: {
          divisions: true,
          teams: true,
          roleTemplates: true,
        },
      });
    });

    it('should return null when company not found', async () => {
      prismaMock.company.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle invalid id gracefully', async () => {
      prismaMock.company.findUnique.mockResolvedValue(null);

      const result = await service.findById('');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    const createDTO: CreateCompanyDTO = {
      name: 'New Company',
      description: 'New Description',
      industry: 'Technology',
    };

    it('should create a company with valid data', async () => {
      prismaMock.company.create.mockResolvedValue(mockCompany);

      const result = await service.create(createDTO);

      expect(result).toEqual(mockCompany);
      expect(prismaMock.company.create).toHaveBeenCalledWith({
        data: {
          name: createDTO.name,
          description: createDTO.description,
          industry: createDTO.industry,
          primaryObjective: undefined,
          operatingMode: undefined,
          globalPrompt: undefined,
          globalPolicies: {},
          globalSkills: [],
          globalMcps: [],
          globalPlugins: [],
        },
      });
    });

    it('should create a company with all optional fields', async () => {
      const fullDTO: CreateCompanyDTO = {
        ...createDTO,
        primaryObjective: 'Objective',
        operatingMode: 'Mode',
        globalPrompt: 'Prompt',
        globalPolicies: { key: 'value' },
        globalSkills: ['skill'],
        globalMcps: ['mcp'],
        globalPlugins: ['plugin'],
      };
      prismaMock.company.create.mockResolvedValue(mockCompany);

      await service.create(fullDTO);

      expect(prismaMock.company.create).toHaveBeenCalledWith({
        data: {
          name: fullDTO.name,
          description: fullDTO.description,
          industry: fullDTO.industry,
          primaryObjective: fullDTO.primaryObjective,
          operatingMode: fullDTO.operatingMode,
          globalPrompt: fullDTO.globalPrompt,
          globalPolicies: fullDTO.globalPolicies,
          globalSkills: fullDTO.globalSkills,
          globalMcps: fullDTO.globalMcps,
          globalPlugins: fullDTO.globalPlugins,
        },
      });
    });

    it('should throw error when prisma create fails', async () => {
      prismaMock.company.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDTO)).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    const updateDTO: UpdateCompanyDTO = {
      name: 'Updated Company',
      description: 'Updated Description',
    };

    it('should update a company with valid data', async () => {
      prismaMock.company.update.mockResolvedValue({ ...mockCompany, ...updateDTO });

      const result = await service.update('company-123', updateDTO);

      expect(result).toEqual({ ...mockCompany, ...updateDTO });
      expect(prismaMock.company.update).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
        data: {
          name: updateDTO.name,
          description: updateDTO.description,
          industry: undefined,
          primaryObjective: undefined,
          operatingMode: undefined,
          globalPrompt: undefined,
          globalPolicies: undefined,
          globalSkills: undefined,
          globalMcps: undefined,
          globalPlugins: undefined,
        },
      });
    });

    it('should throw error when updating non-existent company', async () => {
      prismaMock.company.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.update('non-existent-id', updateDTO)).rejects.toThrow('Record not found');
    });
  });

  describe('delete', () => {
    it('should delete a company successfully', async () => {
      prismaMock.company.delete.mockResolvedValue(mockCompany);

      await service.delete('company-123');

      expect(prismaMock.company.delete).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
      });
    });

    it('should throw error when deleting non-existent company', async () => {
      prismaMock.company.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.delete('non-existent-id')).rejects.toThrow('Record not found');
    });
  });

  describe('getHierarchy', () => {
    const mockCompanyWithHierarchy = {
      ...mockCompany,
      divisions: [
        {
          divisionId: 'div-1',
          name: 'Division 1',
          departments: [
            {
              departmentId: 'dept-1',
              name: 'Department 1',
              teams: [
                { teamId: 'team-1', name: 'Team 1' },
                { teamId: 'team-2', name: 'Team 2' },
              ],
            },
          ],
        },
      ],
    };

    it('should return company hierarchy structure', async () => {
      prismaMock.company.findUnique.mockResolvedValue(mockCompanyWithHierarchy as any);

      const result = await service.getHierarchy('company-123');

      expect(result).toEqual({
        company: {
          id: 'company-123',
          name: 'Test Company',
        },
        divisions: [
          {
            id: 'div-1',
            name: 'Division 1',
            departments: [
              {
                id: 'dept-1',
                name: 'Department 1',
                teams: [
                  { id: 'team-1', name: 'Team 1' },
                  { id: 'team-2', name: 'Team 2' },
                ],
              },
            ],
          },
        ],
      });
    });

    it('should return null when company not found', async () => {
      prismaMock.company.findUnique.mockResolvedValue(null);

      const result = await service.getHierarchy('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getOrgChart', () => {
    it('should return org chart structure with nodes and edges', async () => {
      const mockCompanyWithHierarchy = {
        ...mockCompany,
        divisions: [
          {
            divisionId: 'div-1',
            name: 'Division 1',
            departments: [
              {
                departmentId: 'dept-1',
                name: 'Department 1',
                teams: [{ teamId: 'team-1', name: 'Team 1' }],
              },
            ],
          },
        ],
      };
      prismaMock.company.findUnique.mockResolvedValue(mockCompanyWithHierarchy as any);

      const result = await service.getOrgChart('company-123');

      expect(result).toBeDefined();
      expect(result?.nodes).toHaveLength(4); // company + division + department + team
      expect(result?.edges).toHaveLength(3);
      expect(result?.nodes[0]).toEqual({
        id: 'company-123',
        type: 'company',
        name: 'Test Company',
        level: 0,
      });
    });

    it('should return null when company not found', async () => {
      prismaMock.company.findUnique.mockResolvedValue(null);

      const result = await service.getOrgChart('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle empty divisions', async () => {
      prismaMock.company.findUnique.mockResolvedValue({ ...mockCompany, divisions: [] } as any);

      const result = await service.getOrgChart('company-123');

      expect(result).toBeDefined();
      expect(result?.nodes).toHaveLength(1);
      expect(result?.edges).toHaveLength(0);
    });
  });
});
