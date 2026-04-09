import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { MCPAuthType, MCPHealthStatus } from '@prisma/client';

const serviceLogger = logger.child({ component: 'MCPDefinitionService' });

export interface CreateMCPDefinitionDTO {
  companyId: string;
  name: string;
  description?: string;
  serverUrl: string;
  capabilities?: Record<string, any>;
  authType?: MCPAuthType;
  authConfig?: Record<string, any>;
  healthCheckConfig?: Record<string, any>;
  isGlobal?: boolean;
}

export interface UpdateMCPDefinitionDTO extends Partial<CreateMCPDefinitionDTO> {
  enabled?: boolean;
  healthStatus?: MCPHealthStatus;
}

export interface MCPFilters {
  companyId?: string;
  authType?: string;
  healthStatus?: string;
  enabled?: boolean;
  isGlobal?: boolean;
}

export interface HealthCheckResult {
  status: MCPHealthStatus;
  responseTime?: number;
  error?: string;
  lastChecked: Date;
}

export class MCPDefinitionService {
  async findAll(filters?: MCPFilters) {
    serviceLogger.debug({ filters }, 'Finding all MCP definitions');
    return prisma.mCPDefinition.findMany({
      where: {
        ...(filters?.companyId && { companyId: filters.companyId }),
        ...(filters?.authType && { authType: filters.authType as MCPAuthType }),
        ...(filters?.healthStatus && { healthStatus: filters.healthStatus as MCPHealthStatus }),
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
        ...(filters?.isGlobal !== undefined && { isGlobal: filters.isGlobal }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ mcpId: id }, 'Finding MCP definition by id');
    return prisma.mCPDefinition.findUnique({
      where: { mcpId: id },
    });
  }

  async findByCompany(companyId: string) {
    serviceLogger.debug({ companyId }, 'Finding MCPs by company');
    return prisma.mCPDefinition.findMany({
      where: {
        OR: [
          { companyId },
          { isGlobal: true },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: CreateMCPDefinitionDTO) {
    serviceLogger.info({ name: data.name, companyId: data.companyId }, 'Creating MCP definition');
    return prisma.mCPDefinition.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        description: data.description,
        serverUrl: data.serverUrl,
        capabilities: data.capabilities ?? {},
        authType: data.authType ?? 'none',
        authConfig: data.authConfig ?? {},
        healthCheckConfig: data.healthCheckConfig ?? {},
        healthStatus: 'unknown',
        isGlobal: data.isGlobal ?? false,
        enabled: true,
      },
    });
  }

  async update(id: string, data: UpdateMCPDefinitionDTO) {
    serviceLogger.info({ mcpId: id }, 'Updating MCP definition');
    return prisma.mCPDefinition.update({
      where: { mcpId: id },
      data: {
        name: data.name,
        description: data.description,
        serverUrl: data.serverUrl,
        capabilities: data.capabilities,
        authType: data.authType,
        authConfig: data.authConfig,
        healthCheckConfig: data.healthCheckConfig,
        healthStatus: data.healthStatus,
        isGlobal: data.isGlobal,
        enabled: data.enabled,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ mcpId: id }, 'Deleting MCP definition');
    await prisma.mCPDefinition.delete({
      where: { mcpId: id },
    });
  }

  async enable(id: string) {
    serviceLogger.info({ mcpId: id }, 'Enabling MCP definition');
    return prisma.mCPDefinition.update({
      where: { mcpId: id },
      data: { enabled: true },
    });
  }

  async disable(id: string) {
    serviceLogger.info({ mcpId: id }, 'Disabling MCP definition');
    return prisma.mCPDefinition.update({
      where: { mcpId: id },
      data: { enabled: false },
    });
  }

  async testConnection(id: string): Promise<HealthCheckResult> {
    serviceLogger.info({ mcpId: id }, 'Testing MCP connection');
    const mcp = await this.findById(id);

    if (!mcp) {
      return {
        status: 'unhealthy',
        error: 'MCP not found',
        lastChecked: new Date(),
      };
    }

    const startTime = Date.now();
    let status: MCPHealthStatus = 'unknown';
    let error: string | undefined;
    let responseTime: number | undefined;

    try {
      const response = await fetch(`${mcp.serverUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...(mcp.authType === 'api_key' && {
            'Authorization': `Api-Key ${(mcp.authConfig as any)?.apiKey ?? ''}`,
          }),
          ...(mcp.authType === 'bearer' && {
            'Authorization': `Bearer ${(mcp.authConfig as any)?.token ?? ''}`,
          }),
        },
      });

      responseTime = Date.now() - startTime;

      if (response.ok) {
        status = responseTime < 500 ? 'healthy' : 'degraded';
      } else {
        status = 'unhealthy';
        error = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (err) {
      status = 'unhealthy';
      error = err instanceof Error ? err.message : 'Unknown error';
      responseTime = Date.now() - startTime;
    }

    await prisma.mCPDefinition.update({
      where: { mcpId: id },
      data: {
        healthStatus: status,
        lastHealthCheck: new Date(),
      },
    });

    return {
      status,
      responseTime,
      error,
      lastChecked: new Date(),
    };
  }

  async runHealthChecks(): Promise<HealthCheckResult[]> {
    serviceLogger.info('Running health checks for all MCPs');
    const mcps = await prisma.mCPDefinition.findMany({
      where: { enabled: true },
    });

    const results: HealthCheckResult[] = [];
    for (const mcp of mcps) {
      const result = await this.testConnection(mcp.mcpId);
      results.push({
        ...result,
        mcpId: mcp.mcpId,
        mcpName: mcp.name,
      } as any);
    }

    return results;
  }

  async getHealthSummary(): Promise<{
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  }> {
    serviceLogger.debug('Getting MCP health summary');
    const stats = await prisma.mCPDefinition.groupBy({
      by: ['healthStatus'],
      _count: {
        healthStatus: true,
      },
    });

    const summary = {
      total: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      unknown: 0,
    };

    for (const stat of stats) {
      const count = stat._count.healthStatus;
      summary.total += count;
      switch (stat.healthStatus) {
        case 'healthy':
          summary.healthy = count;
          break;
        case 'degraded':
          summary.degraded = count;
          break;
        case 'unhealthy':
          summary.unhealthy = count;
          break;
        case 'unknown':
        default:
          summary.unknown = count;
          break;
      }
    }

    return summary;
  }

  async getAssignments(mcpId: string) {
    serviceLogger.debug({ mcpId }, 'Getting MCP assignments');
    return prisma.mCPAssignment.findMany({
      where: { mcpId },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async buildConnectionConfig(mcpId: string, scopeType?: string, scopeId?: string): Promise<{
    serverUrl: string;
    authHeaders: Record<string, string>;
    capabilities: Record<string, any>;
  } | null> {
    serviceLogger.debug({ mcpId, scopeType, scopeId }, 'Building MCP connection config');
    const mcp = await this.findById(mcpId);

    if (!mcp || !mcp.enabled) {
      return null;
    }

    let assignmentConfig: Record<string, any> = {};
    if (scopeType && scopeId) {
      const assignment = await prisma.mCPAssignment.findFirst({
        where: {
          mcpId,
          scopeType: scopeType as any,
          scopeId,
          enabled: true,
        },
      });
      if (assignment) {
        assignmentConfig = assignment.configuration as Record<string, any> ?? {};
      }
    }

    const authHeaders: Record<string, string> = {};
    const authConfig = { ...mcp.authConfig as Record<string, any>, ...assignmentConfig };

    switch (mcp.authType) {
      case 'api_key':
        if (authConfig.apiKey) {
          authHeaders['Authorization'] = `Api-Key ${authConfig.apiKey}`;
        }
        break;
      case 'bearer':
        if (authConfig.token) {
          authHeaders['Authorization'] = `Bearer ${authConfig.token}`;
        }
        break;
      case 'basic':
        if (authConfig.username && authConfig.password) {
          const encoded = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
          authHeaders['Authorization'] = `Basic ${encoded}`;
        }
        break;
      case 'oauth':
        if (authConfig.accessToken) {
          authHeaders['Authorization'] = `Bearer ${authConfig.accessToken}`;
        }
        break;
    }

    return {
      serverUrl: mcp.serverUrl,
      authHeaders,
      capabilities: { ...mcp.capabilities as Record<string, any>, ...assignmentConfig.capabilities },
    };
  }
}
