import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { MCPAssignmentScope } from '@prisma/client';

const serviceLogger = logger.child({ component: 'MCPAssignmentService' });

export interface CreateMCPAssignmentDTO {
  mcpId: string;
  scopeType: MCPAssignmentScope;
  scopeId: string;
  configuration?: Record<string, any>;
  assignedBy?: string;
}

export interface UpdateMCPAssignmentDTO {
  configuration?: Record<string, any>;
  enabled?: boolean;
}

export interface AssignmentFilters {
  mcpId?: string;
  scopeType?: string;
  scopeId?: string;
  enabled?: boolean;
}

export class MCPAssignmentService {
  async findAll(filters?: AssignmentFilters) {
    serviceLogger.debug({ filters }, 'Finding all MCP assignments');
    return prisma.mCPAssignment.findMany({
      where: {
        ...(filters?.mcpId && { mcpId: filters.mcpId }),
        ...(filters?.scopeType && { scopeType: filters.scopeType as MCPAssignmentScope }),
        ...(filters?.scopeId && { scopeId: filters.scopeId }),
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
      },
      include: {
        mcp: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ assignmentId: id }, 'Finding MCP assignment by id');
    return prisma.mCPAssignment.findUnique({
      where: { assignmentId: id },
      include: {
        mcp: true,
      },
    });
  }

  async findByScope(scopeType: MCPAssignmentScope, scopeId: string) {
    serviceLogger.debug({ scopeType, scopeId }, 'Finding MCP assignments by scope');
    return prisma.mCPAssignment.findMany({
      where: {
        scopeType,
        scopeId,
        enabled: true,
      },
      include: {
        mcp: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async create(data: CreateMCPAssignmentDTO) {
    serviceLogger.info({ mcpId: data.mcpId, scopeType: data.scopeType, scopeId: data.scopeId }, 'Creating MCP assignment');
    return prisma.mCPAssignment.create({
      data: {
        mcpId: data.mcpId,
        scopeType: data.scopeType,
        scopeId: data.scopeId,
        configuration: data.configuration ?? {},
        assignedBy: data.assignedBy,
        enabled: true,
      },
      include: {
        mcp: true,
      },
    });
  }

  async update(id: string, data: UpdateMCPAssignmentDTO) {
    serviceLogger.info({ assignmentId: id }, 'Updating MCP assignment');
    return prisma.mCPAssignment.update({
      where: { assignmentId: id },
      data: {
        configuration: data.configuration,
        enabled: data.enabled,
      },
      include: {
        mcp: true,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ assignmentId: id }, 'Deleting MCP assignment');
    await prisma.mCPAssignment.delete({
      where: { assignmentId: id },
    });
  }

  async enable(id: string) {
    serviceLogger.info({ assignmentId: id }, 'Enabling MCP assignment');
    return prisma.mCPAssignment.update({
      where: { assignmentId: id },
      data: { enabled: true },
    });
  }

  async disable(id: string) {
    serviceLogger.info({ assignmentId: id }, 'Disabling MCP assignment');
    return prisma.mCPAssignment.update({
      where: { assignmentId: id },
      data: { enabled: false },
    });
  }

  async getEffectiveMCPs(scopeType: MCPAssignmentScope, scopeId: string): Promise<Array<{
    assignmentId: string;
    mcpId: string;
    name: string;
    description: string | null;
    serverUrl: string;
    capabilities: any;
    authType: string;
    configuration: any;
    healthStatus: string;
    enabled: boolean;
  }>> {
    serviceLogger.debug({ scopeType, scopeId }, 'Getting effective MCPs for scope');
    const assignments = await this.findByScope(scopeType, scopeId);

    return assignments.map(assignment => ({
      assignmentId: assignment.assignmentId,
      mcpId: assignment.mcp.mcpId,
      name: assignment.mcp.name,
      description: assignment.mcp.description,
      serverUrl: assignment.mcp.serverUrl,
      capabilities: { ...assignment.mcp.capabilities as object, ...assignment.configuration as object },
      authType: assignment.mcp.authType,
      configuration: assignment.configuration,
      healthStatus: assignment.mcp.healthStatus,
      enabled: assignment.enabled && assignment.mcp.enabled,
    }));
  }

  async getAgentMCPs(agentId: string) {
    serviceLogger.debug({ agentId }, 'Getting MCPs for agent');
    return this.getEffectiveMCPs('agent', agentId);
  }

  async getTeamMCPs(teamId: string) {
    serviceLogger.debug({ teamId }, 'Getting MCPs for team');
    return this.getEffectiveMCPs('team', teamId);
  }

  async getRoleTemplateMCPs(roleTemplateId: string) {
    serviceLogger.debug({ roleTemplateId }, 'Getting MCPs for role template');
    return this.getEffectiveMCPs('role_template', roleTemplateId);
  }

  async bulkAssign(mcpId: string, targets: Array<{ scopeType: MCPAssignmentScope; scopeId: string }>, assignedBy?: string) {
    serviceLogger.info({ mcpId, targetCount: targets.length }, 'Bulk assigning MCP');
    const assignments = [];

    for (const target of targets) {
      const assignment = await this.create({
        mcpId,
        scopeType: target.scopeType,
        scopeId: target.scopeId,
        assignedBy,
      });
      assignments.push(assignment);
    }

    return assignments;
  }

  async revokeFromScope(scopeType: MCPAssignmentScope, scopeId: string, mcpId?: string) {
    serviceLogger.info({ scopeType, scopeId, mcpId }, 'Revoking MCP assignments from scope');
    const where: any = {
      scopeType,
      scopeId,
    };

    if (mcpId) {
      where.mcpId = mcpId;
    }

    const result = await prisma.mCPAssignment.deleteMany({
      where,
    });

    return result.count;
  }

  async syncWithTeamDefaults(teamId: string, teamDefaultMcpBundleId?: string | null) {
    serviceLogger.info({ teamId }, 'Syncing team MCPs with defaults');
    if (!teamDefaultMcpBundleId) {
      return { added: 0, message: 'No default bundle configured' };
    }

    const bundle = await prisma.mCPBundle.findUnique({
      where: { bundleId: teamDefaultMcpBundleId },
      include: { items: true },
    });

    if (!bundle) {
      throw new Error('Default MCP bundle not found');
    }

    const existingAssignments = await this.findByScope('team', teamId);
    const existingMcpIds = new Set(existingAssignments.map(a => a.mcpId));

    let added = 0;
    for (const item of bundle.items) {
      if (!existingMcpIds.has(item.mcpId)) {
        await this.create({
          mcpId: item.mcpId,
          scopeType: 'team',
          scopeId: teamId,
          configuration: item.configuration as Record<string, any> ?? {},
        });
        added++;
      }
    }

    return { added, message: `Added ${added} MCPs from default bundle` };
  }
}
