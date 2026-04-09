import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { PluginType, PluginStatus } from '@prisma/client';

const serviceLogger = logger.child({ component: 'PluginDefinitionService' });

export interface CreatePluginDefinitionDTO {
  companyId: string;
  name: string;
  description?: string;
  version?: string;
  pluginType?: PluginType;
  sourceUrl?: string;
  entryPoint: string;
  permissions?: string[];
  configuration?: Record<string, any>;
  dependencies?: string[];
  isGlobal?: boolean;
}

export interface UpdatePluginDefinitionDTO extends Partial<CreatePluginDefinitionDTO> {
  enabled?: boolean;
  status?: PluginStatus;
}

export interface PluginFilters {
  companyId?: string;
  pluginType?: string;
  status?: string;
  enabled?: boolean;
  isGlobal?: boolean;
}

export interface InstallationResult {
  success: boolean;
  pluginId?: string;
  message: string;
  error?: string;
}

export class PluginDefinitionService {
  async findAll(filters?: PluginFilters) {
    serviceLogger.debug({ filters }, 'Finding all plugin definitions');
    return prisma.pluginDefinition.findMany({
      where: {
        ...(filters?.companyId && { companyId: filters.companyId }),
        ...(filters?.pluginType && { pluginType: filters.pluginType as PluginType }),
        ...(filters?.status && { status: filters.status as PluginStatus }),
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
        ...(filters?.isGlobal !== undefined && { isGlobal: filters.isGlobal }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ pluginId: id }, 'Finding plugin definition by id');
    return prisma.pluginDefinition.findUnique({
      where: { pluginId: id },
    });
  }

  async findByCompany(companyId: string) {
    serviceLogger.debug({ companyId }, 'Finding plugins by company');
    return prisma.pluginDefinition.findMany({
      where: {
        OR: [
          { companyId },
          { isGlobal: true },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: CreatePluginDefinitionDTO) {
    serviceLogger.info({ name: data.name, companyId: data.companyId }, 'Creating plugin definition');
    return prisma.pluginDefinition.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        description: data.description,
        version: data.version ?? '1.0.0',
        pluginType: data.pluginType ?? 'extension',
        sourceUrl: data.sourceUrl,
        entryPoint: data.entryPoint,
        permissions: data.permissions ?? [],
        configuration: data.configuration ?? {},
        dependencies: data.dependencies ?? [],
        isGlobal: data.isGlobal ?? false,
        status: 'pending',
        enabled: true,
      },
    });
  }

  async update(id: string, data: UpdatePluginDefinitionDTO) {
    serviceLogger.info({ pluginId: id }, 'Updating plugin definition');
    return prisma.pluginDefinition.update({
      where: { pluginId: id },
      data: {
        name: data.name,
        description: data.description,
        version: data.version,
        pluginType: data.pluginType,
        sourceUrl: data.sourceUrl,
        entryPoint: data.entryPoint,
        permissions: data.permissions,
        configuration: data.configuration,
        dependencies: data.dependencies,
        isGlobal: data.isGlobal,
        status: data.status,
        enabled: data.enabled,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ pluginId: id }, 'Deleting plugin definition');
    await prisma.pluginDefinition.delete({
      where: { pluginId: id },
    });
  }

  async enable(id: string) {
    serviceLogger.info({ pluginId: id }, 'Enabling plugin definition');
    return prisma.pluginDefinition.update({
      where: { pluginId: id },
      data: { enabled: true },
    });
  }

  async disable(id: string) {
    serviceLogger.info({ pluginId: id }, 'Disabling plugin definition');
    return prisma.pluginDefinition.update({
      where: { pluginId: id },
      data: { enabled: false },
    });
  }

  async install(id: string): Promise<InstallationResult> {
    serviceLogger.info({ pluginId: id }, 'Installing plugin');
    const plugin = await this.findById(id);

    if (!plugin) {
      return { success: false, message: 'Plugin not found' };
    }

    await prisma.pluginDefinition.update({
      where: { pluginId: id },
      data: {
        status: 'installing',
      },
    });

    try {
      if (plugin.sourceUrl) {
        const response = await fetch(plugin.sourceUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch plugin: ${response.statusText}`);
        }
      }

      const updated = await prisma.pluginDefinition.update({
        where: { pluginId: id },
        data: {
          status: 'active',
          installedAt: new Date(),
        },
      });

      return {
        success: true,
        pluginId: updated.pluginId,
        message: 'Plugin installed successfully',
      };
    } catch (error) {
      await prisma.pluginDefinition.update({
        where: { pluginId: id },
        data: {
          status: 'error',
        },
      });

      return {
        success: false,
        pluginId: id,
        message: 'Plugin installation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async uninstall(id: string): Promise<InstallationResult> {
    serviceLogger.info({ pluginId: id }, 'Uninstalling plugin');
    const plugin = await this.findById(id);

    if (!plugin) {
      return { success: false, message: 'Plugin not found' };
    }

    await prisma.pluginDefinition.update({
      where: { pluginId: id },
      data: {
        status: 'disabled',
        installedAt: null,
      },
    });

    return {
      success: true,
      pluginId: id,
      message: 'Plugin uninstalled successfully',
    };
  }

  async updateVersion(id: string, newVersion: string): Promise<InstallationResult> {
    serviceLogger.info({ pluginId: id, newVersion }, 'Updating plugin version');
    const plugin = await this.findById(id);

    if (!plugin) {
      return { success: false, message: 'Plugin not found' };
    }

    await prisma.pluginDefinition.update({
      where: { pluginId: id },
      data: {
        status: 'updating',
      },
    });

    try {
      await prisma.pluginDefinition.update({
        where: { pluginId: id },
        data: {
          version: newVersion,
          status: 'active',
        },
      });

      return {
        success: true,
        pluginId: id,
        message: `Plugin updated to version ${newVersion}`,
      };
    } catch (error) {
      await prisma.pluginDefinition.update({
        where: { pluginId: id },
        data: {
          status: 'error',
        },
      });

      return {
        success: false,
        pluginId: id,
        message: 'Version update failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkDependencies(id: string): Promise<{
    satisfied: boolean;
    missing: string[];
    installed: string[];
  }> {
    serviceLogger.debug({ pluginId: id }, 'Checking plugin dependencies');
    const plugin = await this.findById(id);

    if (!plugin) {
      return { satisfied: false, missing: [], installed: [] };
    }

    const dependencies = plugin.dependencies as string[] ?? [];
    if (dependencies.length === 0) {
      return { satisfied: true, missing: [], installed: [] };
    }

    const installedPlugins = await prisma.pluginDefinition.findMany({
      where: {
        name: { in: dependencies },
        status: 'active',
      },
    });

    const installedNames = installedPlugins.map(p => p.name);
    const missing = dependencies.filter(dep => !installedNames.includes(dep));

    return {
      satisfied: missing.length === 0,
      missing,
      installed: installedNames,
    };
  }

  async getInstallationStatus(id: string): Promise<{
    pluginId: string;
    name: string;
    status: PluginStatus;
    version: string;
    enabled: boolean;
    installedAt: Date | null;
    dependenciesSatisfied: boolean;
    missingDependencies: string[];
  } | null> {
    serviceLogger.debug({ pluginId: id }, 'Getting plugin installation status');
    const plugin = await this.findById(id);

    if (!plugin) {
      return null;
    }

    const deps = await this.checkDependencies(id);

    return {
      pluginId: plugin.pluginId,
      name: plugin.name,
      status: plugin.status,
      version: plugin.version,
      enabled: plugin.enabled,
      installedAt: plugin.installedAt,
      dependenciesSatisfied: deps.satisfied,
      missingDependencies: deps.missing,
    };
  }

  async getAssignments(pluginId: string) {
    serviceLogger.debug({ pluginId }, 'Getting plugin assignments');
    return prisma.pluginAssignment.findMany({
      where: { pluginId },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async validatePermissions(id: string, requestedPermissions: string[]): Promise<{
    valid: boolean;
    granted: string[];
    denied: string[];
  }> {
    serviceLogger.debug({ pluginId: id, requestedPermissions }, 'Validating plugin permissions');
    const plugin = await this.findById(id);

    if (!plugin) {
      return { valid: false, granted: [], denied: requestedPermissions };
    }

    const allowedPermissions = plugin.permissions as string[] ?? [];
    const granted: string[] = [];
    const denied: string[] = [];

    for (const perm of requestedPermissions) {
      if (allowedPermissions.includes(perm)) {
        granted.push(perm);
      } else {
        denied.push(perm);
      }
    }

    return {
      valid: denied.length === 0,
      granted,
      denied,
    };
  }

  async getActivePluginsForScope(scopeType: string, scopeId: string) {
    serviceLogger.debug({ scopeType, scopeId }, 'Getting active plugins for scope');
    const assignments = await prisma.pluginAssignment.findMany({
      where: {
        scopeType: scopeType as any,
        scopeId,
        enabled: true,
      },
      include: {
        plugin: true,
      },
    });

    return assignments
      .filter(a => a.plugin.status === 'active' && a.plugin.enabled)
      .map(a => ({
        assignmentId: a.assignmentId,
        ...a.plugin,
        configuration: { ...a.plugin.configuration as object, ...a.configuration as object },
      }));
  }
}
