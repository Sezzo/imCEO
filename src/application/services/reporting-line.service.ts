import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { ReportingLineType } from '@prisma/client';

const serviceLogger = logger.child({ component: 'ReportingLineService' });

export interface CreateReportingLineDTO {
  companyId: string;
  reporterRoleId?: string;
  reporterAgentId?: string;
  reportsToRoleId?: string;
  reportsToAgentId?: string;
  reportingLineType: ReportingLineType;
  isPrimary?: boolean;
  scope?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateReportingLineDTO extends Partial<CreateReportingLineDTO> {}

export interface ReportingLineFilters {
  companyId?: string;
  reporterRoleId?: string;
  reporterAgentId?: string;
  reportsToRoleId?: string;
  reportsToAgentId?: string;
  reportingLineType?: ReportingLineType;
}

export interface ReportingChain {
  roleId?: string;
  agentId?: string;
  hierarchy: Array<{
    level: number;
    roleId?: string;
    agentId?: string;
    reportingLineType: ReportingLineType;
  }>;
}

export interface DirectReport {
  roleId?: string;
  agentId?: string;
  reportingLineType: ReportingLineType;
  isPrimary: boolean;
}

export class ReportingLineService {
  async findAll(filters?: ReportingLineFilters) {
    serviceLogger.debug({ filters }, 'Finding all reporting lines');
    return prisma.reportingLine.findMany({
      where: {
        ...(filters?.companyId && { companyId: filters.companyId }),
        ...(filters?.reporterRoleId && { reporterRoleId: filters.reporterRoleId }),
        ...(filters?.reporterAgentId && { reporterAgentId: filters.reporterAgentId }),
        ...(filters?.reportsToRoleId && { reportsToRoleId: filters.reportsToRoleId }),
        ...(filters?.reportsToAgentId && { reportsToAgentId: filters.reportsToAgentId }),
        ...(filters?.reportingLineType && { reportingLineType: filters.reportingLineType }),
        endDate: null, // Only active reporting lines
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ reportingLineId: id }, 'Finding reporting line by id');
    return prisma.reportingLine.findUnique({
      where: { reportingLineId: id },
    });
  }
  async create(data: CreateReportingLineDTO) {
    serviceLogger.info({
      reporterRoleId: data.reporterRoleId,
      reporterAgentId: data.reporterAgentId,
      reportsToRoleId: data.reportsToRoleId,
      reportsToAgentId: data.reportsToAgentId,
    }, 'Creating reporting line');

    // Validate that at least one reporter and one reports-to is specified
    if (!data.reporterRoleId && !data.reporterAgentId) {
      throw new Error('Either reporterRoleId or reporterAgentId must be specified');
    }
    if (!data.reportsToRoleId && !data.reportsToAgentId) {
      throw new Error('Either reportsToRoleId or reportsToAgentId must be specified');
    }

    // If setting as primary, unset any existing primary for this reporter
    if (data.isPrimary !== false) {
      const whereClause: any = {
        companyId: data.companyId,
        isPrimary: true,
        endDate: null,
      };

      if (data.reporterRoleId) {
        whereClause.reporterRoleId = data.reporterRoleId;
      }
      if (data.reporterAgentId) {
        whereClause.reporterAgentId = data.reporterAgentId;
      }

      await prisma.reportingLine.updateMany({
        where: whereClause,
        data: { isPrimary: false },
      });
    }

    return prisma.reportingLine.create({
      data: {
        companyId: data.companyId,
        reporterRoleId: data.reporterRoleId,
        reporterAgentId: data.reporterAgentId,
        reportsToRoleId: data.reportsToRoleId,
        reportsToAgentId: data.reportsToAgentId,
        reportingLineType: data.reportingLineType,
        isPrimary: data.isPrimary ?? true,
        scope: data.scope,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });
  }

  async update(id: string, data: UpdateReportingLineDTO) {
    serviceLogger.info({ reportingLineId: id }, 'Updating reporting line');

    const existing = await prisma.reportingLine.findUnique({
      where: { reportingLineId: id },
    });

    if (!existing) {
      throw new Error('Reporting line not found');
    }

    return prisma.reportingLine.update({
      where: { reportingLineId: id },
      data: {
        reporterRoleId: data.reporterRoleId,
        reporterAgentId: data.reporterAgentId,
        reportsToRoleId: data.reportsToRoleId,
        reportsToAgentId: data.reportsToAgentId,
        reportingLineType: data.reportingLineType,
        isPrimary: data.isPrimary,
        scope: data.scope,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ reportingLineId: id }, 'Deleting reporting line');
    // Soft delete by setting end date
    return prisma.reportingLine.update({
      where: { reportingLineId: id },
      data: { endDate: new Date() },
    });
  }

  async getReportingChain(
    companyId: string,
    roleId?: string,
    agentId?: string,
    maxDepth: number = 5
  ): Promise<ReportingChain> {
    serviceLogger.debug({ companyId, roleId, agentId, maxDepth }, 'Getting reporting chain');

    if (!roleId && !agentId) {
      throw new Error('Either roleId or agentId must be specified');
    }

    const hierarchy: ReportingChain['hierarchy'] = [];
    const visited = new Set<string>(); // Prevent cycles

    let currentRoleId = roleId;
    let currentAgentId = agentId;
    let level = 0;

    while ((currentRoleId || currentAgentId) && level < maxDepth) {
      const key = currentRoleId || currentAgentId || '';
      if (visited.has(key)) {
        serviceLogger.warn('Cycle detected in reporting chain');
        break;
      }
      visited.add(key);

      const whereClause: any = {
        companyId,
        endDate: null,
      };

      if (currentRoleId) {
        whereClause.reporterRoleId = currentRoleId;
      }
      if (currentAgentId) {
        whereClause.reporterAgentId = currentAgentId;
      }

      const reportingLine = await prisma.reportingLine.findFirst({
        where: whereClause,
        orderBy: { isPrimary: 'desc' }, // Prefer primary reporting lines
      });

      if (!reportingLine) {
        break;
      }

      hierarchy.push({
        level,
        roleId: reportingLine.reportsToRoleId || undefined,
        agentId: reportingLine.reportsToAgentId || undefined,
        reportingLineType: reportingLine.reportingLineType,
      });

      currentRoleId = reportingLine.reportsToRoleId || undefined;
      currentAgentId = reportingLine.reportsToAgentId || undefined;
      level++;
    }

    return {
      roleId,
      agentId,
      hierarchy,
    };
  }

  async getDirectReports(
    companyId: string,
    roleId?: string,
    agentId?: string
  ): Promise<DirectReport[]> {
    serviceLogger.debug({ companyId, roleId, agentId }, 'Getting direct reports');

    if (!roleId && !agentId) {
      throw new Error('Either roleId or agentId must be specified');
    }

    const whereClause: any = {
      companyId,
      endDate: null,
    };

    if (roleId) {
      whereClause.reportsToRoleId = roleId;
    }
    if (agentId) {
      whereClause.reportsToAgentId = agentId;
    }

    const reportingLines = await prisma.reportingLine.findMany({
      where: whereClause,
    });

    return reportingLines.map((line) => ({
      roleId: line.reporterRoleId || undefined,
      agentId: line.reporterAgentId || undefined,
      reportingLineType: line.reportingLineType,
      isPrimary: line.isPrimary,
    }));
  }

  async getAllReports(
    companyId: string,
    roleId?: string,
    agentId?: string,
    maxDepth: number = 5
  ): Promise<DirectReport[]> {
    serviceLogger.debug({ companyId, roleId, agentId, maxDepth }, 'Getting all reports');

    const allReports: DirectReport[] = [];
    const visited = new Set<string>();

    const collectReports = async (currentRoleId: string | undefined, currentAgentId: string | undefined, depth: number) => {
      if (depth >= maxDepth) return;

      const reports = await this.getDirectReports(companyId, currentRoleId, currentAgentId);

      for (const report of reports) {
        const key = report.roleId || report.agentId || '';
        if (visited.has(key)) continue;
        visited.add(key);

        allReports.push(report);

        await collectReports(report.roleId, report.agentId, depth + 1);
      }
    };

    await collectReports(roleId, agentId, 0);

    return allReports;
  }

  async getSkipLevelReports(
    companyId: string,
    roleId?: string,
    agentId?: string,
    skipLevels: number = 1
  ): Promise<DirectReport[]> {
    serviceLogger.debug({ companyId, roleId, agentId, skipLevels }, 'Getting skip-level reports');

    // First get the reporting chain up to skipLevels
    const chain = await this.getReportingChain(companyId, roleId, agentId, skipLevels);

    if (chain.hierarchy.length < skipLevels) {
      return [];
    }

    const targetLevel = chain.hierarchy[skipLevels - 1];

    // Get direct reports of the manager at the skip level
    return this.getDirectReports(companyId, targetLevel.roleId, targetLevel.agentId);
  }

  async getMatrixReports(
    companyId: string,
    roleId?: string,
    agentId?: string
  ): Promise<DirectReport[]> {
    serviceLogger.debug({ companyId, roleId, agentId }, 'Getting matrix reports');

    if (!roleId && !agentId) {
      throw new Error('Either roleId or agentId must be specified');
    }

    const whereClause: any = {
      companyId,
      endDate: null,
      reportingLineType: { in: ['dotted', 'functional', 'matrix'] },
    };

    if (roleId) {
      whereClause.reportsToRoleId = roleId;
    }
    if (agentId) {
      whereClause.reportsToAgentId = agentId;
    }

    const reportingLines = await prisma.reportingLine.findMany({
      where: whereClause,
    });

    return reportingLines.map((line) => ({
      roleId: line.reporterRoleId || undefined,
      agentId: line.reporterAgentId || undefined,
      reportingLineType: line.reportingLineType,
      isPrimary: line.isPrimary,
    }));
  }

  async setPrimaryReportingLine(id: string): Promise<void> {
    serviceLogger.info({ reportingLineId: id }, 'Setting primary reporting line');

    const reportingLine = await prisma.reportingLine.findUnique({
      where: { reportingLineId: id },
    });

    if (!reportingLine) {
      throw new Error('Reporting line not found');
    }

    // Unset existing primary for this reporter
    const whereClause: any = {
      companyId: reportingLine.companyId,
      isPrimary: true,
      endDate: null,
    };

    if (reportingLine.reporterRoleId) {
      whereClause.reporterRoleId = reportingLine.reporterRoleId;
    }
    if (reportingLine.reporterAgentId) {
      whereClause.reporterAgentId = reportingLine.reporterAgentId;
    }

    await prisma.reportingLine.updateMany({
      where: whereClause,
      data: { isPrimary: false },
    });

    // Set new primary
    await prisma.reportingLine.update({
      where: { reportingLineId: id },
      data: { isPrimary: true },
    });
  }

  async getOrganizationTree(companyId: string): Promise<Record<string, any>> {
    serviceLogger.debug({ companyId }, 'Getting organization tree');

    // Get all active reporting lines for the company
    const reportingLines = await prisma.reportingLine.findMany({
      where: {
        companyId,
        endDate: null,
        isPrimary: true,
      },
    });

    // Build a tree structure
    const nodes: Record<string, any> = {};
    const roots: string[] = [];

    // Initialize nodes
    reportingLines.forEach((line) => {
      if (line.reporterRoleId) {
        nodes[line.reporterRoleId] = {
          id: line.reporterRoleId,
          type: 'role',
          reportsTo: line.reportsToRoleId,
          reports: [],
        };
      }
    });

    // Build relationships
    reportingLines.forEach((line) => {
      if (line.reporterRoleId && line.reportsToRoleId && nodes[line.reportsToRoleId]) {
        nodes[line.reportsToRoleId].reports.push(line.reporterRoleId);
      } else if (line.reporterRoleId && !line.reportsToRoleId) {
        roots.push(line.reporterRoleId);
      }
    });

    return {
      nodes,
      roots,
    };
  }
}
