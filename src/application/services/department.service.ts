import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const serviceLogger = logger.child({ component: 'DepartmentService' });

export interface CreateDepartmentDTO {
  divisionId: string;
  name: string;
  description?: string;
  headRoleId?: string;
  scope?: string;
  policies?: Record<string, any>;
}

export interface UpdateDepartmentDTO extends Partial<Omit<CreateDepartmentDTO, 'divisionId'>> {}

export class DepartmentService {
  async findAll() {
    serviceLogger.debug('Finding all departments');
    return prisma.department.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ departmentId: id }, 'Finding department by id');
    return prisma.department.findUnique({
      where: { departmentId: id },
      include: {
        teams: true,
        division: true,
      },
    });
  }

  async findByDivisionId(divisionId: string) {
    serviceLogger.debug({ divisionId }, 'Finding departments by division id');
    return prisma.department.findMany({
      where: { divisionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateDepartmentDTO) {
    serviceLogger.info({ name: data.name, divisionId: data.divisionId }, 'Creating department');
    return prisma.department.create({
      data: {
        divisionId: data.divisionId,
        name: data.name,
        description: data.description,
        headRoleId: data.headRoleId,
        scope: data.scope,
        policies: data.policies ?? {},
      },
    });
  }

  async update(id: string, data: UpdateDepartmentDTO) {
    serviceLogger.info({ departmentId: id }, 'Updating department');
    return prisma.department.update({
      where: { departmentId: id },
      data: {
        name: data.name,
        description: data.description,
        headRoleId: data.headRoleId,
        scope: data.scope,
        policies: data.policies,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ departmentId: id }, 'Deleting department');
    await prisma.department.delete({
      where: { departmentId: id },
    });
  }
}
