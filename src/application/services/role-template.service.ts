import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { HierarchyLevel } from '@prisma/client';

const serviceLogger = logger.child({ component: 'RoleTemplateService' });

export interface CreateRoleTemplateDTO {
  companyId: string;
  name: string;
  hierarchyLevel: HierarchyLevel;
  description?: string;
  purpose?: string;
  primaryResponsibilities?: string[];
  decisionScope?: Record<string, any>;
  requiredArtifacts?: string[];
  requiredReviews?: string[];
  costClass?: string;
}

export interface UpdateRoleTemplateDTO extends Partial<Omit<CreateRoleTemplateDTO, 'companyId'>> {}

export class RoleTemplateService {
  async findAll() {
    serviceLogger.debug('Finding all role templates');
    return prisma.roleTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ roleTemplateId: id }, 'Finding role template by id');
    return prisma.roleTemplate.findUnique({
      where: { roleTemplateId: id },
      include: {
        agentProfiles: true,
      },
    });
  }

  async findByCompanyId(companyId: string) {
    serviceLogger.debug({ companyId }, 'Finding role templates by company id');
    return prisma.roleTemplate.findMany({
      where: { companyId },
      orderBy: { hierarchyLevel: 'asc', name: 'asc' },
    });
  }

  async create(data: CreateRoleTemplateDTO) {
    serviceLogger.info({ name: data.name, companyId: data.companyId }, 'Creating role template');
    return prisma.roleTemplate.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        hierarchyLevel: data.hierarchyLevel,
        description: data.description,
        purpose: data.purpose,
        primaryResponsibilities: data.primaryResponsibilities ?? [],
        decisionScope: data.decisionScope ?? {},
        requiredArtifacts: data.requiredArtifacts ?? [],
        requiredReviews: data.requiredReviews ?? [],
        costClass: data.costClass,
      },
    });
  }

  async update(id: string, data: UpdateRoleTemplateDTO) {
    serviceLogger.info({ roleTemplateId: id }, 'Updating role template');
    return prisma.roleTemplate.update({
      where: { roleTemplateId: id },
      data: {
        name: data.name,
        hierarchyLevel: data.hierarchyLevel,
        description: data.description,
        purpose: data.purpose,
        primaryResponsibilities: data.primaryResponsibilities,
        decisionScope: data.decisionScope,
        requiredArtifacts: data.requiredArtifacts,
        requiredReviews: data.requiredReviews,
        costClass: data.costClass,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ roleTemplateId: id }, 'Deleting role template');
    await prisma.roleTemplate.delete({
      where: { roleTemplateId: id },
    });
  }

  async duplicate(id: string) {
    serviceLogger.info({ roleTemplateId: id }, 'Duplicating role template');
    const original = await prisma.roleTemplate.findUnique({
      where: { roleTemplateId: id },
    });

    if (!original) {
      throw new Error('Role template not found');
    }

    return prisma.roleTemplate.create({
      data: {
        companyId: original.companyId,
        name: `${original.name} (Copy)`,
        hierarchyLevel: original.hierarchyLevel,
        description: original.description,
        purpose: original.purpose,
        primaryResponsibilities: original.primaryResponsibilities,
        decisionScope: original.decisionScope,
        requiredArtifacts: original.requiredArtifacts,
        requiredReviews: original.requiredReviews,
        costClass: original.costClass,
      },
    });
  }
}
