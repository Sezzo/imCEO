import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const serviceLogger = logger.child({ component: 'PluginBundleService' });

export interface CreatePluginBundleDTO {
  companyId: string;
  name: string;
  description?: string;
  category?: string;
  isGlobal?: boolean;
}

export interface UpdatePluginBundleDTO extends Partial<CreatePluginBundleDTO> {
  enabled?: boolean;
}

export interface AddPluginToBundleDTO {
  pluginId: string;
  configuration?: Record<string, any>;
  priority?: number;
}

export interface BundleFilters {
  companyId?: string;
  category?: string;
  enabled?: boolean;
}

export class PluginBundleService {
  async findAll(filters?: BundleFilters) {
    serviceLogger.debug({ filters }, 'Finding all plugin bundles');
    return prisma.pluginBundle.findMany({
      where: {
        ...(filters?.companyId && { companyId: filters.companyId }),
        ...(filters?.category && { category: filters.category }),
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
      },
      include: {
        items: {
          include: {
            plugin: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ bundleId: id }, 'Finding plugin bundle by id');
    return prisma.pluginBundle.findUnique({
      where: { bundleId: id },
      include: {
        items: {
          include: {
            plugin: true,
          },
          orderBy: { priority: 'desc' },
        },
      },
    });
  }

  async create(data: CreatePluginBundleDTO) {
    serviceLogger.info({ name: data.name, companyId: data.companyId }, 'Creating plugin bundle');
    return prisma.pluginBundle.create({
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

  async update(id: string, data: UpdatePluginBundleDTO) {
    serviceLogger.info({ bundleId: id }, 'Updating plugin bundle');
    return prisma.pluginBundle.update({
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
    serviceLogger.info({ bundleId: id }, 'Deleting plugin bundle');
    await prisma.pluginBundle.delete({
      where: { bundleId: id },
    });
  }

  async addPlugin(bundleId: string, data: AddPluginToBundleDTO) {
    serviceLogger.info({ bundleId, pluginId: data.pluginId }, 'Adding plugin to bundle');
    return prisma.pluginBundleItem.create({
      data: {
        bundleId,
        pluginId: data.pluginId,
        configuration: data.configuration ?? {},
        priority: data.priority ?? 0,
      },
      include: {
        plugin: true,
      },
    });
  }

  async removePlugin(bundleId: string, pluginId: string) {
    serviceLogger.info({ bundleId, pluginId }, 'Removing plugin from bundle');
    await prisma.pluginBundleItem.deleteMany({
      where: {
        bundleId,
        pluginId,
      },
    });
  }

  async updatePluginPriority(bundleId: string, pluginId: string, priority: number) {
    serviceLogger.info({ bundleId, pluginId, priority }, 'Updating plugin priority in bundle');
    return prisma.pluginBundleItem.updateMany({
      where: {
        bundleId,
        pluginId,
      },
      data: { priority },
    });
  }

  async getBundlePlugins(bundleId: string) {
    serviceLogger.debug({ bundleId }, 'Getting plugins in bundle');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      return null;
    }
    return bundle.items.map(item => ({
      ...item.plugin,
      bundleConfiguration: item.configuration,
      priority: item.priority,
    }));
  }

  async assignBundleToTeam(bundleId: string, teamId: string, assignedBy?: string) {
    serviceLogger.info({ bundleId, teamId }, 'Assigning plugin bundle to team');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      throw new Error('Plugin bundle not found');
    }

    const assignments = [];
    for (const item of bundle.items) {
      const assignment = await prisma.pluginAssignment.create({
        data: {
          pluginId: item.pluginId,
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
    serviceLogger.info({ bundleId, agentId }, 'Assigning plugin bundle to agent');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      throw new Error('Plugin bundle not found');
    }

    const assignments = [];
    for (const item of bundle.items) {
      const assignment = await prisma.pluginAssignment.create({
        data: {
          pluginId: item.pluginId,
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
    serviceLogger.info({ sourceBundleId: bundleId, newName }, 'Cloning plugin bundle');
    const source = await this.findById(bundleId);
    if (!source) {
      throw new Error('Source bundle not found');
    }

    const newBundle = await prisma.pluginBundle.create({
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
      await prisma.pluginBundleItem.create({
        data: {
          bundleId: newBundle.bundleId,
          pluginId: item.pluginId,
          configuration: item.configuration ?? {},
          priority: item.priority,
        },
      });
    }

    return this.findById(newBundle.bundleId);
  }

  async getBundleInstallationStatus(bundleId: string): Promise<{
    total: number;
    active: number;
    installing: number;
    pending: number;
    error: number;
    disabled: number;
  }> {
    serviceLogger.debug({ bundleId }, 'Getting bundle installation status');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      throw new Error('Bundle not found');
    }

    const status = {
      total: bundle.items.length,
      active: 0,
      installing: 0,
      pending: 0,
      error: 0,
      disabled: 0,
    };

    for (const item of bundle.items) {
      switch (item.plugin.status) {
        case 'active':
          status.active++;
          break;
        case 'installing':
        case 'updating':
          status.installing++;
          break;
        case 'pending':
          status.pending++;
          break;
        case 'error':
          status.error++;
          break;
        case 'disabled':
          status.disabled++;
          break;
      }
    }

    return status;
  }

  async installAllPlugins(bundleId: string): Promise<{
    bundleId: string;
    results: Array<{
      pluginId: string;
      name: string;
      success: boolean;
      message: string;
    }>;
  }> {
    serviceLogger.info({ bundleId }, 'Installing all plugins in bundle');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      throw new Error('Bundle not found');
    }

    const results = [];
    for (const item of bundle.items) {
      try {
        const updated = await prisma.pluginDefinition.update({
          where: { pluginId: item.pluginId },
          data: {
            status: 'active',
            installedAt: new Date(),
          },
        });
        results.push({
          pluginId: item.pluginId,
          name: item.plugin.name,
          success: true,
          message: 'Plugin installed',
        });
      } catch (error) {
        results.push({
          pluginId: item.pluginId,
          name: item.plugin.name,
          success: false,
          message: error instanceof Error ? error.message : 'Installation failed',
        });
      }
    }

    return { bundleId, results };
  }
}
