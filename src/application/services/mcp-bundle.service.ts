import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const serviceLogger = logger.child({ component: 'MCPBundleService' });

export interface CreateMCPBundleDTO {
  companyId: string;
  name: string;
  description?: string;
  category?: string;
  isGlobal?: boolean;
}

export interface UpdateMCPBundleDTO extends Partial<CreateMCPBundleDTO> {
  enabled?: boolean;
}

export interface AddMCPToBundleDTO {
  mcpId: string;
  configuration?: Record<string, any>;
  priority?: number;
}

export interface BundleFilters {
  companyId?: string;
  category?: string;
  enabled?: boolean;
}

export class MCPBundleService {
  async findAll(filters?: BundleFilters) {
    serviceLogger.debug({ filters }, 'Finding all MCP bundles');
    return prisma.mCPBundle.findMany({
      where: {
        ...(filters?.companyId && { companyId: filters.companyId }),
        ...(filters?.category && { category: filters.category }),
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
      },
      include: {
        items: {
          include: {
            mcp: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ bundleId: id }, 'Finding MCP bundle by id');
    return prisma.mCPBundle.findUnique({
      where: { bundleId: id },
      include: {
        items: {
          include: {
            mcp: true,
          },
          orderBy: { priority: 'desc' },
        },
      },
    });
  }

  async create(data: CreateMCPBundleDTO) {
    serviceLogger.info({ name: data.name, companyId: data.companyId }, 'Creating MCP bundle');
    return prisma.mCPBundle.create({
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

  async update(id: string, data: UpdateMCPBundleDTO) {
    serviceLogger.info({ bundleId: id }, 'Updating MCP bundle');
    return prisma.mCPBundle.update({
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
    serviceLogger.info({ bundleId: id }, 'Deleting MCP bundle');
    await prisma.mCPBundle.delete({
      where: { bundleId: id },
    });
  }

  async addMCP(bundleId: string, data: AddMCPToBundleDTO) {
    serviceLogger.info({ bundleId, mcpId: data.mcpId }, 'Adding MCP to bundle');
    return prisma.mCPBundleItem.create({
      data: {
        bundleId,
        mcpId: data.mcpId,
        configuration: data.configuration ?? {},
        priority: data.priority ?? 0,
      },
      include: {
        mcp: true,
      },
    });
  }

  async removeMCP(bundleId: string, mcpId: string) {
    serviceLogger.info({ bundleId, mcpId }, 'Removing MCP from bundle');
    await prisma.mCPBundleItem.deleteMany({
      where: {
        bundleId,
        mcpId,
      },
    });
  }

  async updateMCPPriority(bundleId: string, mcpId: string, priority: number) {
    serviceLogger.info({ bundleId, mcpId, priority }, 'Updating MCP priority in bundle');
    return prisma.mCPBundleItem.updateMany({
      where: {
        bundleId,
        mcpId,
      },
      data: { priority },
    });
  }

  async getBundleMCPs(bundleId: string) {
    serviceLogger.debug({ bundleId }, 'Getting MCPs in bundle');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      return null;
    }
    return bundle.items.map(item => ({
      ...item.mcp,
      bundleConfiguration: item.configuration,
      priority: item.priority,
    }));
  }

  async assignBundleToTeam(bundleId: string, teamId: string, assignedBy?: string) {
    serviceLogger.info({ bundleId, teamId }, 'Assigning MCP bundle to team');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      throw new Error('MCP bundle not found');
    }

    const assignments = [];
    for (const item of bundle.items) {
      const assignment = await prisma.mCPAssignment.create({
        data: {
          mcpId: item.mcpId,
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
    serviceLogger.info({ bundleId, agentId }, 'Assigning MCP bundle to agent');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      throw new Error('MCP bundle not found');
    }

    const assignments = [];
    for (const item of bundle.items) {
      const assignment = await prisma.mCPAssignment.create({
        data: {
          mcpId: item.mcpId,
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
    serviceLogger.info({ sourceBundleId: bundleId, newName }, 'Cloning MCP bundle');
    const source = await this.findById(bundleId);
    if (!source) {
      throw new Error('Source bundle not found');
    }

    const newBundle = await prisma.mCPBundle.create({
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
      await prisma.mCPBundleItem.create({
        data: {
          bundleId: newBundle.bundleId,
          mcpId: item.mcpId,
          configuration: item.configuration ?? {},
          priority: item.priority,
        },
      });
    }

    return this.findById(newBundle.bundleId);
  }

  async getBundleHealthStatus(bundleId: string): Promise<{
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    total: number;
  }> {
    serviceLogger.debug({ bundleId }, 'Getting bundle health status');
    const bundle = await this.findById(bundleId);
    if (!bundle) {
      throw new Error('Bundle not found');
    }

    const status = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
      total: bundle.items.length,
    };

    for (const item of bundle.items) {
      switch (item.mcp.healthStatus) {
        case 'healthy':
          status.healthy++;
          break;
        case 'degraded':
          status.degraded++;
          break;
        case 'unhealthy':
          status.unhealthy++;
          break;
        case 'unknown':
        default:
          status.unknown++;
          break;
      }
    }

    return status;
  }
}
