import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { PluginAssignmentScope } from '@prisma/client';

const serviceLogger = logger.child({ component: 'PluginAssignmentService' });

export interface CreatePluginAssignmentDTO {
  pluginId: string;
  scopeType: PluginAssignmentScope;
  scopeId: string;
  configuration?: Record<string, any>;
  assignedBy?: string;
}

export interface UpdatePluginAssignmentDTO {
  configuration?: Record<string, any>;
  enabled?: boolean;
}

export interface AssignmentFilters {
  pluginId?: string;
  scopeType?: string;
  scopeId?: string;
  enabled?: boolean;
}

export class PluginAssignmentService {
  async findAll(filters?: AssignmentFilters) {
    serviceLogger.debug({ filters }, 'Finding all plugin assignments');
    return prisma.pluginAssignment.findMany({
      where: {
        ...(filters?.pluginId && { pluginId: filters.pluginId }),
        ...(filters?.scopeType && { scopeType: filters.scopeType as PluginAssignmentScope }),
        ...(filters?.scopeId && { scopeId: filters.scopeId }),
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
      },
      include: {
        plugin: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ assignmentId: id }, 'Finding plugin assignment by id');
    return prisma.pluginAssignment.findUnique({
      where: { assignmentId: id },
      include: {
        plugin: true,
      },
    });
  }

  async findByScope(scopeType: PluginAssignmentScope, scopeId: string) {
    serviceLogger.debug({ scopeType, scopeId }, 'Finding plugin assignments by scope');
    return prisma.pluginAssignment.findMany({
      where: {
        scopeType,
        scopeId,
        enabled: true,
      },
      include: {
        plugin: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async create(data: CreatePluginAssignmentDTO) {
    serviceLogger.info({ pluginId: data.pluginId, scopeType: data.scopeType, scopeId: data.scopeId }, 'Creating plugin assignment');
    return prisma.pluginAssignment.create({
      data: {
        pluginId: data.pluginId,
        scopeType: data.scopeType,
        scopeId: data.scopeId,
        configuration: data.configuration ?? {},
        assignedBy: data.assignedBy,
        enabled: true,
      },
      include: {
        plugin: true,
      },
    });
  }

  async update(id: string, data: UpdatePluginAssignmentDTO) {
    serviceLogger.info({ assignmentId: id }, 'Updating plugin assignment');
    return prisma.pluginAssignment.update({
      where: { assignmentId: id },
      data: {
        configuration: data.configuration,
        enabled: data.enabled,
      },
      include: {
        plugin: true,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ assignmentId: id }, 'Deleting plugin assignment');
    await prisma.pluginAssignment.delete({
      where: { assignmentId: id },
    });
  }

  async enable(id: string) {
    serviceLogger.info({ assignmentId: id }, 'Enabling plugin assignment');
    return prisma.pluginAssignment.update({
      where: { assignmentId: id },
      data: { enabled: true },
    });
  }

  async disable(id: string) {
    serviceLogger.info({ assignmentId: id }, 'Disabling plugin assignment');
    return prisma.pluginAssignment.update({
      where: { assignmentId: id },
      data: { enabled: false },
    });
  }

  async getEffectivePlugins(scopeType: PluginAssignmentScope, scopeId: string): Promise<Array<{
    assignmentId: string;
    pluginId: string;
    name: string;
    description: string | null;
    version: string;
    pluginType: string;
    entryPoint: string;
    permissions: any;
    configuration: any;
    status: string;
    enabled: boolean;
  }>> {
    serviceLogger.debug({ scopeType, scopeId }, 'Getting effective plugins for scope');
    const assignments = await this.findByScope(scopeType, scopeId);

    return assignments.map(assignment => ({
      assignmentId: assignment.assignmentId,
      pluginId: assignment.plugin.pluginId,
      name: assignment.plugin.name,
      description: assignment.plugin.description,
      version: assignment.plugin.version,
      pluginType: assignment.plugin.pluginType,
      entryPoint: assignment.plugin.entryPoint,
      permissions: assignment.plugin.permissions,
      configuration: { ...assignment.plugin.configuration as object, ...assignment.configuration as object },
      status: assignment.plugin.status,
      enabled: assignment.enabled && assignment.plugin.enabled,
    }));
  }

  async getAgentPlugins(agentId: string) {
    serviceLogger.debug({ agentId }, 'Getting plugins for agent');
    return this.getEffectivePlugins('agent', agentId);
  }

  async getTeamPlugins(teamId: string) {
    serviceLogger.debug({ teamId }, 'Getting plugins for team');
    return this.getEffectivePlugins('team', teamId);
  }

  async getRoleTemplatePlugins(roleTemplateId: string) {
    serviceLogger.debug({ roleTemplateId }, 'Getting plugins for role template');
    return this.getEffectivePlugins('role_template', roleTemplateId);
  }

  async bulkAssign(pluginId: string, targets: Array<{ scopeType: PluginAssignmentScope; scopeId: string }>, assignedBy?: string) {
    serviceLogger.info({ pluginId, targetCount: targets.length }, 'Bulk assigning plugin');
    const assignments = [];

    for (const target of targets) {
      const assignment = await this.create({
        pluginId,
        scopeType: target.scopeType,
        scopeId: target.scopeId,
        assignedBy,
      });
      assignments.push(assignment);
    }

    return assignments;
  }

  async revokeFromScope(scopeType: PluginAssignmentScope, scopeId: string, pluginId?: string) {
    serviceLogger.info({ scopeType, scopeId, pluginId }, 'Revoking plugin assignments from scope');
    const where: any = {
      scopeType,
      scopeId,
    };

    if (pluginId) {
      where.pluginId = pluginId;
    }

    const result = await prisma.pluginAssignment.deleteMany({
      where,
    });

    return result.count;
  }

  async syncWithTeamDefaults(teamId: string, teamDefaultPluginBundleId?: string | null) {
    serviceLogger.info({ teamId }, 'Syncing team plugins with defaults');
    if (!teamDefaultPluginBundleId) {
      return { added: 0, message: 'No default bundle configured' };
    }

    const bundle = await prisma.pluginBundle.findUnique({
      where: { bundleId: teamDefaultPluginBundleId },
      include: { items: true },
    });

    if (!bundle) {
      throw new Error('Default plugin bundle not found');
    }

    const existingAssignments = await this.findByScope('team', teamId);
    const existingPluginIds = new Set(existingAssignments.map(a => a.pluginId));

    let added = 0;
    for (const item of bundle.items) {
      if (!existingPluginIds.has(item.pluginId)) {
        await this.create({
          pluginId: item.pluginId,
          scopeType: 'team',
          scopeId: teamId,
          configuration: item.configuration as Record<string, any> ?? {},
        });
        added++;
      }
    }

    return { added, message: `Added ${added} plugins from default bundle` };
  }

  async validatePluginAccess(pluginId: string, scopeType: PluginAssignmentScope, scopeId: string): Promise<{
    allowed: boolean;
    plugin?: any;
    configuration?: any;
    reason?: string;
  }> {
    serviceLogger.debug({ pluginId, scopeType, scopeId }, 'Validating plugin access');

    const plugin = await prisma.pluginDefinition.findUnique({
      where: { pluginId },
    });

    if (!plugin) {
      return { allowed: false, reason: 'Plugin not found' };
    }

    if (!plugin.enabled) {
      return { allowed: false, reason: 'Plugin is disabled' };
    }

    if (plugin.status !== 'active') {
      return { allowed: false, reason: `Plugin is not active (status: ${plugin.status})` };
    }

    const assignment = await prisma.pluginAssignment.findFirst({
      where: {
        pluginId,
        scopeType,
        scopeId,
        enabled: true,
      },
    });

    if (!assignment) {
      return { allowed: false, reason: 'Plugin not assigned to this scope' };
    }

    return {
      allowed: true,
      plugin,
      configuration: { ...plugin.configuration as object, ...assignment.configuration as object },
    };
  }
}
