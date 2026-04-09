import { DepartmentService, CreateDepartmentDTO, UpdateDepartmentDTO } from '../../../src/application/services/department.service';
import { prismaMock } from '../setup';

describe('DepartmentService', () => {
  const service = new DepartmentService();

  const mockDepartment = {
    departmentId: 'dept-123',
    divisionId: 'division-123',
    name: 'Test Department',
    description: 'Test Description',
    headRoleId: null,
    scope: 'Full Scope',
    policies: { policy1: 'value1' },
    defaultWorkflows: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  describe('findAll', () => {
    it('should return all departments ordered by createdAt desc', async () => {
      const mockDepartments = [mockDepartment, { ...mockDepartment, departmentId: 'dept-456' }];
      prismaMock.department.findMany.mockResolvedValue(mockDepartments);

      const result = await service.findAll();

      expect(result).toEqual(mockDepartments);
      expect(prismaMock.department.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no departments exist', async () => {
      prismaMock.department.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a department by id with related data', async () => {
      prismaMock.department.findUnique.mockResolvedValue({
        ...mockDepartment,
        teams: [],
        division: { divisionId: 'division-123', name: 'Division Name' },
      });

      const result = await service.findById('dept-123');

      expect(result).toEqual({
        ...mockDepartment,
        teams: [],
        division: { divisionId: 'division-123', name: 'Division Name' },
      });
      expect(prismaMock.department.findUnique).toHaveBeenCalledWith({
        where: { departmentId: 'dept-123' },
        include: {
          teams: true,
          division: true,
        },
      });
    });

    it('should return null when department not found', async () => {
      prismaMock.department.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByDivisionId', () => {
    it('should return departments for a specific division', async () => {
      const mockDepartments = [mockDepartment];
      prismaMock.department.findMany.mockResolvedValue(mockDepartments);

      const result = await service.findByDivisionId('division-123');

      expect(result).toEqual(mockDepartments);
      expect(prismaMock.department.findMany).toHaveBeenCalledWith({
        where: { divisionId: 'division-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when division has no departments', async () => {
      prismaMock.department.findMany.mockResolvedValue([]);

      const result = await service.findByDivisionId('division-no-depts');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const createDTO: CreateDepartmentDTO = {
      divisionId: 'division-123',
      name: 'New Department',
      description: 'New Description',
    };

    it('should create a department with valid data', async () => {
      prismaMock.department.create.mockResolvedValue(mockDepartment);

      const result = await service.create(createDTO);

      expect(result).toEqual(mockDepartment);
      expect(prismaMock.department.create).toHaveBeenCalledWith({
        data: {
          divisionId: createDTO.divisionId,
          name: createDTO.name,
          description: createDTO.description,
          headRoleId: undefined,
          scope: undefined,
          policies: {},
        },
      });
    });

    it('should create a department with all optional fields', async () => {
      const fullDTO: CreateDepartmentDTO = {
        ...createDTO,
        headRoleId: 'role-123',
        scope: 'Limited Scope',
        policies: { key: 'value' },
      };
      prismaMock.department.create.mockResolvedValue({
        ...mockDepartment,
        headRoleId: 'role-123',
        scope: 'Limited Scope',
        policies: { key: 'value' },
      });

      await service.create(fullDTO);

      expect(prismaMock.department.create).toHaveBeenCalledWith({
        data: {
          divisionId: fullDTO.divisionId,
          name: fullDTO.name,
          description: fullDTO.description,
          headRoleId: fullDTO.headRoleId,
          scope: fullDTO.scope,
          policies: fullDTO.policies,
        },
      });
    });

    it('should throw error when prisma create fails', async () => {
      prismaMock.department.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDTO)).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    const updateDTO: UpdateDepartmentDTO = {
      name: 'Updated Department',
      description: 'Updated Description',
    };

    it('should update a department with valid data', async () => {
      prismaMock.department.update.mockResolvedValue({ ...mockDepartment, ...updateDTO });

      const result = await service.update('dept-123', updateDTO);

      expect(result).toEqual({ ...mockDepartment, ...updateDTO });
      expect(prismaMock.department.update).toHaveBeenCalledWith({
        where: { departmentId: 'dept-123' },
        data: {
          name: updateDTO.name,
          description: updateDTO.description,
          headRoleId: undefined,
          scope: undefined,
          policies: undefined,
        },
      });
    });

    it('should update department with all fields', async () => {
      const fullUpdateDTO: UpdateDepartmentDTO = {
        name: 'Updated',
        headRoleId: 'new-head-123',
        scope: 'New Scope',
        policies: { updated: 'policy' },
      };
      prismaMock.department.update.mockResolvedValue({
        ...mockDepartment,
        ...fullUpdateDTO,
      });

      await service.update('dept-123', fullUpdateDTO);

      expect(prismaMock.department.update).toHaveBeenCalledWith({
        where: { departmentId: 'dept-123' },
        data: {
          name: fullUpdateDTO.name,
          description: undefined,
          headRoleId: fullUpdateDTO.headRoleId,
          scope: fullUpdateDTO.scope,
          policies: fullUpdateDTO.policies,
        },
      });
    });

    it('should throw error when updating non-existent department', async () => {
      prismaMock.department.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.update('non-existent-id', updateDTO)).rejects.toThrow('Record not found');
    });
  });

  describe('delete', () => {
    it('should delete a department successfully', async () => {
      prismaMock.department.delete.mockResolvedValue(mockDepartment);

      await service.delete('dept-123');

      expect(prismaMock.department.delete).toHaveBeenCalledWith({
        where: { departmentId: 'dept-123' },
      });
    });

    it('should throw error when deleting non-existent department', async () => {
      prismaMock.department.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.delete('non-existent-id')).rejects.toThrow('Record not found');
    });
  });
});
