import { DivisionService, CreateDivisionDTO, UpdateDivisionDTO } from './division.service';
import { prismaMock } from '../../test/singleton';

describe('DivisionService', () => {
  const service = new DivisionService();

  const mockDivision = {
    divisionId: 'division-123',
    companyId: 'company-123',
    name: 'Test Division',
    description: 'Test Description',
    parentDivisionId: null,
    headRoleId: null,
    policies: { policy1: 'value1' },
    defaultWorkflows: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  describe('findAll', () => {
    it('should return all divisions ordered by createdAt desc', async () => {
      const mockDivisions = [mockDivision, { ...mockDivision, divisionId: 'division-456' }];
      prismaMock.division.findMany.mockResolvedValue(mockDivisions);

      const result = await service.findAll();

      expect(result).toEqual(mockDivisions);
      expect(prismaMock.division.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no divisions exist', async () => {
      prismaMock.division.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a division by id with related data', async () => {
      prismaMock.division.findUnique.mockResolvedValue({
        ...mockDivision,
        departments: [],
        childDivisions: [],
      });

      const result = await service.findById('division-123');

      expect(result).toEqual({
        ...mockDivision,
        departments: [],
        childDivisions: [],
      });
      expect(prismaMock.division.findUnique).toHaveBeenCalledWith({
        where: { divisionId: 'division-123' },
        include: {
          departments: true,
          childDivisions: true,
        },
      });
    });

    it('should return null when division not found', async () => {
      prismaMock.division.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByCompanyId', () => {
    it('should return divisions for a specific company', async () => {
      const mockDivisions = [mockDivision];
      prismaMock.division.findMany.mockResolvedValue(mockDivisions);

      const result = await service.findByCompanyId('company-123');

      expect(result).toEqual(mockDivisions);
      expect(prismaMock.division.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when company has no divisions', async () => {
      prismaMock.division.findMany.mockResolvedValue([]);

      const result = await service.findByCompanyId('company-no-divisions');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const createDTO: CreateDivisionDTO = {
      companyId: 'company-123',
      name: 'New Division',
      description: 'New Description',
    };

    it('should create a division with valid data', async () => {
      prismaMock.division.create.mockResolvedValue(mockDivision);

      const result = await service.create(createDTO);

      expect(result).toEqual(mockDivision);
      expect(prismaMock.division.create).toHaveBeenCalledWith({
        data: {
          companyId: createDTO.companyId,
          name: createDTO.name,
          description: createDTO.description,
          parentDivisionId: undefined,
          headRoleId: undefined,
          policies: {},
        },
      });
    });

    it('should create a division with all optional fields including parent', async () => {
      const fullDTO: CreateDivisionDTO = {
        ...createDTO,
        parentDivisionId: 'parent-division-123',
        headRoleId: 'role-123',
        policies: { key: 'value' },
      };
      prismaMock.division.create.mockResolvedValue({
        ...mockDivision,
        parentDivisionId: 'parent-division-123',
        headRoleId: 'role-123',
        policies: { key: 'value' },
      });

      await service.create(fullDTO);

      expect(prismaMock.division.create).toHaveBeenCalledWith({
        data: {
          companyId: fullDTO.companyId,
          name: fullDTO.name,
          description: fullDTO.description,
          parentDivisionId: fullDTO.parentDivisionId,
          headRoleId: fullDTO.headRoleId,
          policies: fullDTO.policies,
        },
      });
    });

    it('should throw error when prisma create fails', async () => {
      prismaMock.division.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDTO)).rejects.toThrow('Database error');
    });

    it('should throw error when creating with invalid companyId', async () => {
      prismaMock.division.create.mockRejectedValue(new Error('Foreign key constraint'));

      await expect(service.create({ ...createDTO, companyId: 'invalid' })).rejects.toThrow('Foreign key constraint');
    });
  });

  describe('update', () => {
    const updateDTO: UpdateDivisionDTO = {
      name: 'Updated Division',
      description: 'Updated Description',
    };

    it('should update a division with valid data', async () => {
      prismaMock.division.update.mockResolvedValue({ ...mockDivision, ...updateDTO });

      const result = await service.update('division-123', updateDTO);

      expect(result).toEqual({ ...mockDivision, ...updateDTO });
      expect(prismaMock.division.update).toHaveBeenCalledWith({
        where: { divisionId: 'division-123' },
        data: {
          name: updateDTO.name,
          description: updateDTO.description,
          parentDivisionId: undefined,
          headRoleId: undefined,
          policies: undefined,
        },
      });
    });

    it('should update division with parent and head role', async () => {
      const fullUpdateDTO: UpdateDivisionDTO = {
        name: 'Updated',
        parentDivisionId: 'new-parent-123',
        headRoleId: 'new-head-123',
        policies: { updated: 'policy' },
      };
      prismaMock.division.update.mockResolvedValue({
        ...mockDivision,
        ...fullUpdateDTO,
      });

      await service.update('division-123', fullUpdateDTO);

      expect(prismaMock.division.update).toHaveBeenCalledWith({
        where: { divisionId: 'division-123' },
        data: {
          name: fullUpdateDTO.name,
          description: undefined,
          parentDivisionId: fullUpdateDTO.parentDivisionId,
          headRoleId: fullUpdateDTO.headRoleId,
          policies: fullUpdateDTO.policies,
        },
      });
    });

    it('should throw error when updating non-existent division', async () => {
      prismaMock.division.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.update('non-existent-id', updateDTO)).rejects.toThrow('Record not found');
    });
  });

  describe('delete', () => {
    it('should delete a division successfully', async () => {
      prismaMock.division.delete.mockResolvedValue(mockDivision);

      await service.delete('division-123');

      expect(prismaMock.division.delete).toHaveBeenCalledWith({
        where: { divisionId: 'division-123' },
      });
    });

    it('should throw error when deleting non-existent division', async () => {
      prismaMock.division.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.delete('non-existent-id')).rejects.toThrow('Record not found');
    });

    it('should throw error when deleting division with children', async () => {
      prismaMock.division.delete.mockRejectedValue(new Error('Foreign key constraint'));

      await expect(service.delete('division-with-children')).rejects.toThrow('Foreign key constraint');
    });
  });
});
