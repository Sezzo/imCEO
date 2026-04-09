import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const serviceLogger = logger.child({ component: 'SkillBundleService' });

export interface CreateSkillBundleDTO {
  companyId: string;
  name: string;
  description?: string;
  category?: string;
  isGlobal?: boolean;
}

export interface UpdateSkillBundleDTO extends Partial<CreateSkillBundleDTO> {
  enabled?: boolean;
}

export interface AddSkillToBundleDTO {
  skillId: string;
  configuration?: Record<string, any>;
  priority?: number;
}

export interface BundleFilters {
  companyId?: string;
  category?: string;
  enabled?: boolean;
}

export class SkillBundleService {
  async findAll(filters?: BundleFilters) {
    serviceLogger.debug({ filters }, 'Finding all skill bundles');
    return prisma.skillBundle.findMany({
      where: {
        ...(filters?.companyId && { companyId: filters.companyId }),
        ...(filters?.category && { category: filters.category }),
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
      },
      include: {
        items: {
          include: {
            skill: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ bundleId: id }, 'Finding skill bundle by id');
    return prisma.skillBundle.findUnique({
      where: { bundleId: id },
      include: {
        items: {
          include: {
            skill: true,
          },
          orderBy: { priority: 'desc' },
        },
      },
    });
  }

  async create(data: CreateSkillBundleDTO) {
    serviceLogger.info({ name: data.name, companyId: data.companyId }, 'Creating skill bundle');
    return prisma.skillBundle.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        description: data.description,
        category: data.category,
        isGlobal: data.isGlobal ?? false,
        enabled: true,
      },
    });
  }

  async update(id: string, data: UpdateSkillBundleDTO) {
    serviceLogger.info({ bundleId: id }, 'Updating skill bundle');
    return prisma.skillBundle.update({
      where: { bundleId: id },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        isGlobal: data.isGlobal,
        enabled: data.enabled,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ bundleId: id }, 'Deleting skill bundle');
    await prisma.skillBundle.delete({
      where: { bundleId: id },
    });
  }

  async addSkill(bundleId: string, data: AddSkillToBundleDTO) {
    serviceLogger.info({ bundleId, skillId: data.skillId }, 'Adding skill to bundle');
    return prisma.skillBundleItem.create({
      data: {
        bundleId,
        skillId: data.skillId,
        configuration: data.configuration ?? {},
        priority: data.priority ?? 0,
      },
      include: {
        skill: true,
      },
    });
  }

  async removeSkill(bundleId: string, skillId: string) {
    serviceLogger.info({ bundleId, skillId }, 'Removing skill from bundle');
    await prisma.skillBundleItem.deleteMany({
      where: {
        bundleId,
        skillId,
      },
    });
  }

  async updateSkillPriority(bundleId: string, skillId: string, priority: number) {
    serviceLogger.info({ bundleId, skillId, priority }, 'Updating skill priority in bundle');
    return prisma.skillBundleItem.updateMany({
      where: {
        bundleId,
        skillId,
      },
      data: { priority },
    });
  }

  async getBundleSkills(bundleId: string) {
    serviceLogger.debug({ bundleId }, 'Getting skills in bundle');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      return null;
    }
    return bundle.items.map(item => ({
      ...item.skill,
      bundleConfiguration: item.configuration,
      priority: item.priority,
    }));
  }

  async assignBundleToTeam(bundleId: string, teamId: string, assignedBy?: string) {
    serviceLogger.info({ bundleId, teamId }, 'Assigning skill bundle to team');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      throw new Error('Skill bundle not found');
    }

    const assignments = [];
    for (const item of bundle.items) {
      const assignment = await prisma.skillAssignment.create({
        data: {
          skillId: item.skillId,
          scopeType: 'team',
          scopeId: teamId,
          configuration: item.configuration ?? {},
          assignedBy,
        },
      });
      assignments.push(assignment);
    }

    return assignments;
  }

  async assignBundleToAgent(bundleId: string, agentId: string, assignedBy?: string) {
    serviceLogger.info({ bundleId, agentId }, 'Assigning skill bundle to agent');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      throw new Error('Skill bundle not found');
    }

    const assignments = [];
    for (const item of bundle.items) {
      const assignment = await prisma.skillAssignment.create({
        data: {
          skillId: item.skillId,
          scopeType: 'agent',
          scopeId: agentId,
          configuration: item.configuration ?? {},
          assignedBy,
        },
      });
      assignments.push(assignment);
    }

    return assignments;
  }

  async cloneBundle(bundleId: string, newName: string, companyId: string) {
    serviceLogger.info({ sourceBundleId: bundleId, newName }, 'Cloning skill bundle');
    const source = await this.findById(bundleId);
    if (!source) {
      throw new Error('Source bundle not found');
    }

    const newBundle = await prisma.skillBundle.create({
      data: {
        companyId,
        name: newName,
        description: source.description,
        category: source.category,
        isGlobal: false,
        enabled: true,
      },
    });

    for (const item of source.items) {
      await prisma.skillBundleItem.create({
        data: {
          bundleId: newBundle.bundleId,
          skillId: item.skillId,
          configuration: item.configuration ?? {},
          priority: item.priority,
        },
      });
    }

    return this.findById(newBundle.bundleId);
  }
}
