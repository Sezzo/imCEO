import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const serviceLogger = logger.child({ component: 'TeamService' });

export interface CreateTeamDTO {
  departmentId: string;
  name: string;
  description?: string;
  mission?: string;
  teamType?: string;
  leadRoleId?: string;
  defaultModelProfileId?: string;
  defaultSkillBundleId?: string;
  defaultMcpBundleId?: string;
  allowedInteractions?: any[];
}

export interface UpdateTeamDTO extends Partial<Omit<CreateTeamDTO, 'departmentId'>> {}

export class TeamService {
  async findAll() {
    serviceLogger.debug('Finding all teams');
    return prisma.team.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ teamId: id }, 'Finding team by id');
    return prisma.team.findUnique({
      where: { teamId: id },
      include: {
        agentProfiles: true,
      },
    });
  }

  async findByDepartmentId(departmentId: string) {
    serviceLogger.debug({ departmentId }, 'Finding teams by department id');
    return prisma.team.findMany({
      where: { departmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateTeamDTO) {
    serviceLogger.info({ name: data.name, departmentId: data.departmentId }, 'Creating team');
    return prisma.team.create({
      data: {
        departmentId: data.departmentId,
        name: data.name,
        description: data.description,
        mission: data.mission,
        teamType: data.teamType,
        leadRoleId: data.leadRoleId,
        defaultModelProfileId: data.defaultModelProfileId,
        defaultSkillBundleId: data.defaultSkillBundleId,
        defaultMcpBundleId: data.defaultMcpBundleId,
        allowedInteractions: data.allowedInteractions ?? [],
      },
    });
  }

  async update(id: string, data: UpdateTeamDTO) {
    serviceLogger.info({ teamId: id }, 'Updating team');
    return prisma.team.update({
      where: { teamId: id },
      data: {
        name: data.name,
        description: data.description,
        mission: data.mission,
        teamType: data.teamType,
        leadRoleId: data.leadRoleId,
        defaultModelProfileId: data.defaultModelProfileId,
        defaultSkillBundleId: data.defaultSkillBundleId,
        defaultMcpBundleId: data.defaultMcpBundleId,
        allowedInteractions: data.allowedInteractions,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ teamId: id }, 'Deleting team');
    await prisma.team.delete({
      where: { teamId: id },
    });
  }
}
