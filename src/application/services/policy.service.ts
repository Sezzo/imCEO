import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { PolicyType, PolicyAction } from '@prisma/client';

const serviceLogger = logger.child({ component: 'PolicyService' });

export interface CreatePolicyDTO {
  name: string;
  description?: string;
  policyType: PolicyType;
  scopeType: string;
  scopeId: string;
  conditionExpression?: string;
  action: PolicyAction;
  severity?: string;
  enabled?: boolean;
}

export interface UpdatePolicyDTO extends Partial<CreatePolicyDTO> {}

export interface PolicyFilters {
  type?: string;
  scopeId?: string;
}

export interface PolicyTestResult {
  policyId: string;
  action: PolicyAction;
  allowed: boolean;
  message?: string;
}

export class PolicyService {
  async findAll(filters?: PolicyFilters) {
    serviceLogger.debug({ filters }, 'Finding all policies');
    return prisma.policy.findMany({
      where: {
        ...(filters?.type && { policyType: filters.type as PolicyType }),
        ...(filters?.scopeId && { scopeId: filters.scopeId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ policyId: id }, 'Finding policy by id');
    return prisma.policy.findUnique({
      where: { policyId: id },
    });
  }

  async create(data: CreatePolicyDTO) {
    serviceLogger.info({ name: data.name, type: data.policyType }, 'Creating policy');
    return prisma.policy.create({
      data: {
        name: data.name,
        description: data.description,
        policyType: data.policyType,
        scopeType: data.scopeType,
        scopeId: data.scopeId,
        conditionExpression: data.conditionExpression,
        action: data.action,
        severity: data.severity,
        enabled: data.enabled ?? true,
      },
    });
  }

  async update(id: string, data: UpdatePolicyDTO) {
    serviceLogger.info({ policyId: id }, 'Updating policy');
    return prisma.policy.update({
      where: { policyId: id },
      data: {
        name: data.name,
        description: data.description,
        policyType: data.policyType,
        action: data.action,
        conditionExpression: data.conditionExpression,
        severity: data.severity,
        enabled: data.enabled,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ policyId: id }, 'Deleting policy');
    await prisma.policy.delete({
      where: { policyId: id },
    });
  }

  async testPolicy(id: string, context: Record<string, any>): Promise<PolicyTestResult> {
    serviceLogger.debug({ policyId: id, context }, 'Testing policy');

    const policy = await prisma.policy.findUnique({
      where: { policyId: id },
    });

    if (!policy) {
      throw new Error('Policy not found');
    }

    if (!policy.enabled) {
      return {
        policyId: id,
        action: 'allow' as PolicyAction,
        allowed: true,
        message: 'Policy is disabled',
      };
    }

    // Simple condition evaluation (placeholder for real implementation)
    const conditionMet = this.evaluateCondition(policy.conditionExpression, context);

    return {
      policyId: id,
      action: conditionMet ? policy.action : ('allow' as PolicyAction),
      allowed: conditionMet ? policy.action === 'allow' || policy.action === 'allow_with_warning' : true,
      message: conditionMet ? `Policy triggered: ${policy.action}` : 'Policy not triggered',
    };
  }

  private evaluateCondition(expression: string | null, context: Record<string, any>): boolean {
    if (!expression) {
      return true; // No condition means always apply
    }

    // Simple evaluation - in production, use a proper expression evaluator
    try {
      // Example: "cost > 100" -> check if context.cost > 100
      const match = expression.match(/(\w+)\s*(>|<|=)\s*(.+)/);
      if (!match) {
        return false;
      }

      const [, field, operator, value] = match;
      const contextValue = context[field];
      const compareValue = isNaN(Number(value)) ? value : Number(value);

      switch (operator) {
        case '>':
          return contextValue > compareValue;
        case '<':
          return contextValue < compareValue;
        case '=':
          return contextValue === compareValue;
        default:
          return false;
      }
    } catch (error) {
      serviceLogger.error({ expression, error }, 'Failed to evaluate condition');
      return false;
    }
  }

  async getViolations(scopeId?: string) {
    serviceLogger.debug({ scopeId }, 'Getting policy violations');
    // This would query a violations table
    // For now, return placeholder
    return [];
  }
}
