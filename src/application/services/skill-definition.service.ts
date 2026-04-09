import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { SkillCategory, SkillInvocationMode } from '@prisma/client';

const serviceLogger = logger.child({ component: 'SkillDefinitionService' });

export interface CreateSkillDefinitionDTO {
  companyId: string;
  name: string;
  description?: string;
  category?: SkillCategory;
  invocationMode?: SkillInvocationMode;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  requiredPermissions?: string[];
  configuration?: Record<string, any>;
  version?: string;
  isGlobal?: boolean;
}

export interface UpdateSkillDefinitionDTO extends Partial<CreateSkillDefinitionDTO> {
  enabled?: boolean;
}

export interface SkillFilters {
  companyId?: string;
  category?: string;
  enabled?: boolean;
  isGlobal?: boolean;
}

export class SkillDefinitionService {
  async findAll(filters?: SkillFilters) {
    serviceLogger.debug({ filters }, 'Finding all skill definitions');
    return prisma.skillDefinition.findMany({
      where: {
        ...(filters?.companyId && { companyId: filters.companyId }),
        ...(filters?.category && { category: filters.category as SkillCategory }),
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
        ...(filters?.isGlobal !== undefined && { isGlobal: filters.isGlobal }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ skillId: id }, 'Finding skill definition by id');
    return prisma.skillDefinition.findUnique({
      where: { skillId: id },
    });
  }

  async findByCompany(companyId: string) {
    serviceLogger.debug({ companyId }, 'Finding skills by company');
    return prisma.skillDefinition.findMany({
      where: {
        OR: [
          { companyId },
          { isGlobal: true },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: CreateSkillDefinitionDTO) {
    serviceLogger.info({ name: data.name, companyId: data.companyId }, 'Creating skill definition');
    return prisma.skillDefinition.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        description: data.description,
        category: data.category ?? 'custom',
        invocationMode: data.invocationMode ?? 'interactive',
        inputSchema: data.inputSchema ?? {},
        outputSchema: data.outputSchema ?? {},
        requiredPermissions: data.requiredPermissions ?? [],
        configuration: data.configuration ?? {},
        version: data.version ?? '1.0.0',
        isGlobal: data.isGlobal ?? false,
        enabled: true,
      },
    });
  }

  async update(id: string, data: UpdateSkillDefinitionDTO) {
    serviceLogger.info({ skillId: id }, 'Updating skill definition');
    return prisma.skillDefinition.update({
      where: { skillId: id },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        invocationMode: data.invocationMode,
        inputSchema: data.inputSchema,
        outputSchema: data.outputSchema,
        requiredPermissions: data.requiredPermissions,
        configuration: data.configuration,
        version: data.version,
        isGlobal: data.isGlobal,
        enabled: data.enabled,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ skillId: id }, 'Deleting skill definition');
    await prisma.skillDefinition.delete({
      where: { skillId: id },
    });
  }

  async enable(id: string) {
    serviceLogger.info({ skillId: id }, 'Enabling skill definition');
    return prisma.skillDefinition.update({
      where: { skillId: id },
      data: { enabled: true },
    });
  }

  async disable(id: string) {
    serviceLogger.info({ skillId: id }, 'Disabling skill definition');
    return prisma.skillDefinition.update({
      where: { skillId: id },
      data: { enabled: false },
    });
  }

  async getAssignments(skillId: string) {
    serviceLogger.debug({ skillId }, 'Getting skill assignments');
    return prisma.skillAssignment.findMany({
      where: { skillId },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async validateSkillInput(skillId: string, input: Record<string, any>): Promise<{ valid: boolean; errors?: string[] }> {
    serviceLogger.debug({ skillId }, 'Validating skill input');
    const skill = await this.findById(skillId);

    if (!skill) {
      return { valid: false, errors: ['Skill not found'] };
    }

    if (!skill.enabled) {
      return { valid: false, errors: ['Skill is disabled'] };
    }

    const inputSchema = skill.inputSchema as Record<string, any>;
    if (!inputSchema || Object.keys(inputSchema).length === 0) {
      return { valid: true };
    }

    const errors: string[] = [];
    const required = inputSchema.required as string[] ?? [];
    const properties = inputSchema.properties as Record<string, any> ?? {};

    for (const field of required) {
      if (input[field] === undefined || input[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    for (const [field, value] of Object.entries(input)) {
      const prop = properties[field];
      if (!prop) {
        errors.push(`Unknown field: ${field}`);
        continue;
      }

      if (prop.type === 'string' && typeof value !== 'string') {
        errors.push(`Field ${field} must be a string`);
      } else if (prop.type === 'number' && typeof value !== 'number') {
        errors.push(`Field ${field} must be a number`);
      } else if (prop.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Field ${field} must be a boolean`);
      } else if (prop.type === 'array' && !Array.isArray(value)) {
        errors.push(`Field ${field} must be an array`);
      } else if (prop.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
        errors.push(`Field ${field} must be an object`);
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async canInvoke(skillId: string, agentContext: Record<string, any>): Promise<{ allowed: boolean; reason?: string }> {
    serviceLogger.debug({ skillId, agentContext }, 'Checking skill invocation permission');
    const skill = await this.findById(skillId);

    if (!skill) {
      return { allowed: false, reason: 'Skill not found' };
    }

    if (!skill.enabled) {
      return { allowed: false, reason: 'Skill is disabled' };
    }

    switch (skill.invocationMode) {
      case 'autonomous':
        return { allowed: true };
      case 'interactive':
        return { allowed: true };
      case 'approval_required':
        return { allowed: false, reason: 'Skill requires approval' };
      default:
        return { allowed: false, reason: 'Unknown invocation mode' };
    }
  }
}
