import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const serviceLogger = logger.child({ component: 'AgentProfileService' });

export interface CreateAgentProfileDTO {
  teamId: string;
  roleTemplateId?: string;
  displayName: string;
  internalName: string;
  seniority?: string;
  customPromptOverride?: string;
  maxParallelTasks?: number;
  maxContextBudget?: number;
  maxCostPerTask?: number;
}

export interface UpdateAgentProfileDTO extends Partial<Omit<CreateAgentProfileDTO, 'teamId'>> {}

export class AgentProfileService {
  async findAll() {
    serviceLogger.debug('Finding all agent profiles');
    return prisma.agentProfile.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ agentId: id }, 'Finding agent profile by id');
    return prisma.agentProfile.findUnique({
      where: { agentId: id },
      include: {
        team: true,
        roleTemplate: true,
      },
    });
  }

  async findByTeamId(teamId: string) {
    serviceLogger.debug({ teamId }, 'Finding agent profiles by team id');
    return prisma.agentProfile.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateAgentProfileDTO) {
    serviceLogger.info({ displayName: data.displayName, teamId: data.teamId }, 'Creating agent profile');
    return prisma.agentProfile.create({
      data: {
        teamId: data.teamId,
        roleTemplateId: data.roleTemplateId,
        displayName: data.displayName,
        internalName: data.internalName,
        seniority: data.seniority,
        customPromptOverride: data.customPromptOverride,
        maxParallelTasks: data.maxParallelTasks ?? 1,
        maxContextBudget: data.maxContextBudget,
        maxCostPerTask: data.maxCostPerTask,
      },
    });
  }

  async update(id: string, data: UpdateAgentProfileDTO) {
    serviceLogger.info({ agentId: id }, 'Updating agent profile');
    return prisma.agentProfile.update({
      where: { agentId: id },
      data: {
        roleTemplateId: data.roleTemplateId,
        displayName: data.displayName,
        internalName: data.internalName,
        seniority: data.seniority,
        customPromptOverride: data.customPromptOverride,
        maxParallelTasks: data.maxParallelTasks,
        maxContextBudget: data.maxContextBudget,
        maxCostPerTask: data.maxCostPerTask,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ agentId: id }, 'Deleting agent profile');
    await prisma.agentProfile.delete({
      where: { agentId: id },
    });
  }

  async activate(id: string) {
    serviceLogger.info({ agentId: id }, 'Activating agent profile');
    return prisma.agentProfile.update({
      where: { agentId: id },
      data: { status: 'active' },
    });
  }

  async deactivate(id: string) {
    serviceLogger.info({ agentId: id }, 'Deactivating agent profile');
    return prisma.agentProfile.update({
      where: { agentId: id },
      data: { status: 'inactive' },
    });
  }
}
