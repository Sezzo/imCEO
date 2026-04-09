import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const serviceLogger = logger.child({ component: 'DivisionService' });

export interface CreateDivisionDTO {
  companyId: string;
  name: string;
  description?: string;
  parentDivisionId?: string;
  headRoleId?: string;
  policies?: Record<string, any>;
}

export interface UpdateDivisionDTO extends Partial<Omit<CreateDivisionDTO, 'companyId'>> {}

export class DivisionService {
  async findAll() {
    serviceLogger.debug('Finding all divisions');
    return prisma.division.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ divisionId: id }, 'Finding division by id');
    return prisma.division.findUnique({
      where: { divisionId: id },
      include: {
        departments: true,
        childDivisions: true,
      },
    });
  }

  async findByCompanyId(companyId: string) {
    serviceLogger.debug({ companyId }, 'Finding divisions by company id');
    return prisma.division.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateDivisionDTO) {
    serviceLogger.info({ name: data.name, companyId: data.companyId }, 'Creating division');
    return prisma.division.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        description: data.description,
        parentDivisionId: data.parentDivisionId,
        headRoleId: data.headRoleId,
        policies: data.policies ?? {},
      },
    });
  }

  async update(id: string, data: UpdateDivisionDTO) {
    serviceLogger.info({ divisionId: id }, 'Updating division');
    return prisma.division.update({
      where: { divisionId: id },
      data: {
        name: data.name,
        description: data.description,
        parentDivisionId: data.parentDivisionId,
        headRoleId: data.headRoleId,
        policies: data.policies,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ divisionId: id }, 'Deleting division');
    await prisma.division.delete({
      where: { divisionId: id },
    });
  }
}
