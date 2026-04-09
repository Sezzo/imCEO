import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { SkillAssignmentScope, SkillInvocationMode } from '@prisma/client';

const serviceLogger = logger.child({ component: 'SkillAssignmentService' });

export interface CreateSkillAssignmentDTO {
  skillId: string;
  scopeType: SkillAssignmentScope;
  scopeId: string;
  configuration?: Record<string, any>;
  overrideMode?: SkillInvocationMode;
  assignedBy?: string;
}

export interface UpdateSkillAssignmentDTO {
  configuration?: Record<string, any>;
  overrideMode?: SkillInvocationMode;
  enabled?: boolean;
}

export interface AssignmentFilters {
  skillId?: string;
  scopeType?: string;
  scopeId?: string;
  enabled?: boolean;
}

export class SkillAssignmentService {
  async findAll(filters?: AssignmentFilters) {
    serviceLogger.debug({ filters }, 'Finding all skill assignments');
    return prisma.skillAssignment.findMany({
      where: {
        ...(filters?.skillId && { skillId: filters.skillId }),
        ...(filters?.scopeType && { scopeType: filters.scopeType as SkillAssignmentScope }),
        ...(filters?.scopeId && { scopeId: filters.scopeId }),
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
      },
      include: {
        skill: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ assignmentId: id }, 'Finding skill assignment by id');
    return prisma.skillAssignment.findUnique({
      where: { assignmentId: id },
      include: {
        skill: true,
      },
    });
  }

  async findByScope(scopeType: SkillAssignmentScope, scopeId: string) {
    serviceLogger.debug({ scopeType, scopeId }, 'Finding skill assignments by scope');
    return prisma.skillAssignment.findMany({
      where: {
        scopeType,
        scopeId,
        enabled: true,
      },
      include: {
        skill: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async create(data: CreateSkillAssignmentDTO) {
    serviceLogger.info({ skillId: data.skillId, scopeType: data.scopeType, scopeId: data.scopeId }, 'Creating skill assignment');
    return prisma.skillAssignment.create({
      data: {
        skillId: data.skillId,
        scopeType: data.scopeType,
        scopeId: data.scopeId,
        configuration: data.configuration ?? {},
        overrideMode: data.overrideMode,
        assignedBy: data.assignedBy,
        enabled: true,
      },
      include: {
        skill: true,
      },
    });
  }

  async update(id: string, data: UpdateSkillAssignmentDTO) {
    serviceLogger.info({ assignmentId: id }, 'Updating skill assignment');
    return prisma.skillAssignment.update({
      where: { assignmentId: id },
      data: {
        configuration: data.configuration,
        overrideMode: data.overrideMode,
        enabled: data.enabled,
      },
      include: {
        skill: true,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ assignmentId: id }, 'Deleting skill assignment');
    await prisma.skillAssignment.delete({
      where: { assignmentId: id },
    });
  }

  async enable(id: string) {
    serviceLogger.info({ assignmentId: id }, 'Enabling skill assignment');
    return prisma.skillAssignment.update({
      where: { assignmentId: id },
      data: { enabled: true },
    });
  }

  async disable(id: string) {
    serviceLogger.info({ assignmentId: id }, 'Disabling skill assignment');
    return prisma.skillAssignment.update({
      where: { assignmentId: id },
      data: { enabled: false },
    });
  }

  async getEffectiveSkills(scopeType: SkillAssignmentScope, scopeId: string): Promise<Array<{
    assignmentId: string;
    skillId: string;
    name: string;
    description: string | null;
    category: string;
    invocationMode: string;
    inputSchema: any;
    outputSchema: any;
    configuration: any;
    enabled: boolean;
  }>> {
    serviceLogger.debug({ scopeType, scopeId }, 'Getting effective skills for scope');
    const assignments = await this.findByScope(scopeType, scopeId);

    return assignments.map(assignment => ({
      assignmentId: assignment.assignmentId,
      skillId: assignment.skill.skillId,
      name: assignment.skill.name,
      description: assignment.skill.description,
      category: assignment.skill.category,
      invocationMode: assignment.overrideMode ?? assignment.skill.invocationMode,
      inputSchema: assignment.skill.inputSchema,
      outputSchema: assignment.skill.outputSchema,
      configuration: { ...assignment.skill.configuration as object, ...assignment.configuration as object },
      enabled: assignment.enabled && assignment.skill.enabled,
    }));
  }

  async getAgentSkills(agentId: string) {
    serviceLogger.debug({ agentId }, 'Getting skills for agent');
    return this.getEffectiveSkills('agent', agentId);
  }

  async getTeamSkills(teamId: string) {
    serviceLogger.debug({ teamId }, 'Getting skills for team');
    return this.getEffectiveSkills('team', teamId);
  }

  async getRoleTemplateSkills(roleTemplateId: string) {
    serviceLogger.debug({ roleTemplateId }, 'Getting skills for role template');
    return this.getEffectiveSkills('role_template', roleTemplateId);
  }

  async bulkAssign(skillId: string, targets: Array<{ scopeType: SkillAssignmentScope; scopeId: string }>, assignedBy?: string) {
    serviceLogger.info({ skillId, targetCount: targets.length }, 'Bulk assigning skill');
    const assignments = [];

    for (const target of targets) {
      const assignment = await this.create({
        skillId,
        scopeType: target.scopeType,
        scopeId: target.scopeId,
        assignedBy,
      });
      assignments.push(assignment);
    }

    return assignments;
  }

  async revokeFromScope(scopeType: SkillAssignmentScope, scopeId: string, skillId?: string) {
    serviceLogger.info({ scopeType, scopeId, skillId }, 'Revoking skill assignments from scope');
    const where: any = {
      scopeType,
      scopeId,
    };

    if (skillId) {
      where.skillId = skillId;
    }

    const result = await prisma.skillAssignment.deleteMany({
      where,
    });

    return result.count;
  }
}
