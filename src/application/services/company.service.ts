import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const serviceLogger = logger.child({ component: 'CompanyService' });

export interface CreateCompanyDTO {
  name: string;
  description?: string;
  industry?: string;
  primaryObjective?: string;
  operatingMode?: string;
  globalPrompt?: string;
  globalPolicies?: Record<string, any>;
  globalSkills?: any[];
  globalMcps?: any[];
  globalPlugins?: any[];
}

export interface UpdateCompanyDTO extends Partial<CreateCompanyDTO> {}

export class CompanyService {
  async findAll() {
    serviceLogger.debug('Finding all companies');
    return prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ companyId: id }, 'Finding company by id');
    return prisma.company.findUnique({
      where: { companyId: id },
      include: {
        divisions: true,
        teams: true,
        roleTemplates: true,
      },
    });
  }

  async create(data: CreateCompanyDTO) {
    serviceLogger.info({ name: data.name }, 'Creating company');
    return prisma.company.create({
      data: {
        name: data.name,
        description: data.description,
        industry: data.industry,
        primaryObjective: data.primaryObjective,
        operatingMode: data.operatingMode,
        globalPrompt: data.globalPrompt,
        globalPolicies: data.globalPolicies ?? {},
        globalSkills: data.globalSkills ?? [],
        globalMcps: data.globalMcps ?? [],
        globalPlugins: data.globalPlugins ?? [],
      },
    });
  }

  async update(id: string, data: UpdateCompanyDTO) {
    serviceLogger.info({ companyId: id }, 'Updating company');
    return prisma.company.update({
      where: { companyId: id },
      data: {
        name: data.name,
        description: data.description,
        industry: data.industry,
        primaryObjective: data.primaryObjective,
        operatingMode: data.operatingMode,
        globalPrompt: data.globalPrompt,
        globalPolicies: data.globalPolicies,
        globalSkills: data.globalSkills,
        globalMcps: data.globalMcps,
        globalPlugins: data.globalPlugins,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ companyId: id }, 'Deleting company');
    await prisma.company.delete({
      where: { companyId: id },
    });
  }

  async getHierarchy(id: string) {
    serviceLogger.debug({ companyId: id }, 'Getting company hierarchy');
    const company = await prisma.company.findUnique({
      where: { companyId: id },
      include: {
        divisions: {
          include: {
            departments: {
              include: {
                teams: true,
              },
            },
          },
        },
      },
    });

    if (!company) {
      return null;
    }

    return {
      company: {
        id: company.companyId,
        name: company.name,
      },
      divisions: company.divisions.map((division) => ({
        id: division.divisionId,
        name: division.name,
        departments: division.departments.map((dept) => ({
          id: dept.departmentId,
          name: dept.name,
          teams: dept.teams.map((team) => ({
            id: team.teamId,
            name: team.name,
          })),
        })),
      })),
    };
  }

  async getOrgChart(id: string) {
    serviceLogger.debug({ companyId: id }, 'Getting org chart');
    const hierarchy = await this.getHierarchy(id);

    if (!hierarchy) {
      return null;
    }

    // Convert to org chart format for frontend
    const nodes: any[] = [
      {
        id: hierarchy.company.id,
        type: 'company',
        name: hierarchy.company.name,
        level: 0,
      },
    ];

    const edges: any[] = [];

    hierarchy.divisions.forEach((division) => {
      nodes.push({
        id: division.id,
        type: 'division',
        name: division.name,
        level: 1,
      });
      edges.push({
        source: hierarchy.company.id,
        target: division.id,
        type: 'division',
      });

      division.departments.forEach((dept) => {
        nodes.push({
          id: dept.id,
          type: 'department',
          name: dept.name,
          level: 2,
        });
        edges.push({
          source: division.id,
          target: dept.id,
          type: 'department',
        });

        dept.teams.forEach((team) => {
          nodes.push({
            id: team.id,
            type: 'team',
            name: team.name,
            level: 3,
          });
          edges.push({
            source: dept.id,
            target: team.id,
            type: 'team',
          });
        });
      });
    });

    return { nodes, edges };
  }
}
