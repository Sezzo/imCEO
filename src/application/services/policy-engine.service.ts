import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { PolicyType, PolicyAction, AuditSeverity } from '@prisma/client';

const serviceLogger = logger.child({ component: 'PolicyEngineService' });

export interface PolicyContext {
  actorId?: string;
  actorType?: string;
  scopeType: string;
  scopeId: string;
  targetType: string;
  targetId: string;
  action: string;
  cost?: number;
  metadata?: Record<string, any>;
}

export interface PolicyEvaluationResult {
  policyId: string;
  policyName: string;
  policyType: PolicyType;
  action: PolicyAction;
  allowed: boolean;
  severity?: string;
  message: string;
  conditionMet: boolean;
}

export interface PolicyViolation {
  violationId: string;
  policyId: string;
  scopeType: string;
  scopeId: string;
  actorId?: string;
  actorType?: string;
  targetType: string;
  targetId: string;
  actionAttempted: string;
  severity: string;
  context?: Record<string, any>;
  createdAt: Date;
}

export class PolicyEngineService {
  async evaluatePolicies(context: PolicyContext): Promise<{
    allowed: boolean;
    action: PolicyAction;
    results: PolicyEvaluationResult[];
    violations: PolicyEvaluationResult[];
  }> {
    serviceLogger.debug({ context }, 'Evaluating policies');

    const policies = await prisma.policy.findMany({
      where: {
        enabled: true,
        scopeId: context.scopeId,
      },
      orderBy: { createdAt: 'asc' },
    });

    const results: PolicyEvaluationResult[] = [];
    let finalAction: PolicyAction = 'allow';
    let hasViolation = false;

    for (const policy of policies) {
      const conditionMet = this.evaluateCondition(policy.conditionExpression, context);
      const policyAction = conditionMet ? policy.action : 'allow';

      const result: PolicyEvaluationResult = {
        policyId: policy.policyId,
        policyName: policy.name,
        policyType: policy.policyType,
        action: policyAction,
        allowed: policyAction === 'allow' || policyAction === 'allow_with_warning',
        severity: policy.severity ?? undefined,
        message: conditionMet
          ? `Policy triggered: ${policy.action}`
          : 'Policy not triggered',
        conditionMet,
      };

      results.push(result);

      if (conditionMet) {
        if (policy.severity === 'critical' || policy.action === 'block' || policy.action === 'quarantine') {
          hasViolation = true;
        }

        if (this.isActionMoreRestrictive(policyAction, finalAction)) {
          finalAction = policyAction;
        }
      }
    }

    const violations = results.filter(r => !r.allowed && r.conditionMet);

    if (hasViolation || violations.length > 0) {
      for (const violation of violations) {
        await this.recordViolation(violation, context);
      }
    }

    return {
      allowed: finalAction === 'allow' || finalAction === 'allow_with_warning',
      action: finalAction,
      results,
      violations,
    };
  }

  async evaluateSinglePolicy(policyId: string, context: PolicyContext): Promise<PolicyEvaluationResult> {
    serviceLogger.debug({ policyId, context }, 'Evaluating single policy');

    const policy = await prisma.policy.findUnique({
      where: { policyId },
    });

    if (!policy) {
      throw new Error('Policy not found');
    }

    if (!policy.enabled) {
      return {
        policyId,
        policyName: policy.name,
        policyType: policy.policyType,
        action: 'allow',
        allowed: true,
        message: 'Policy is disabled',
        conditionMet: false,
      };
    }

    const conditionMet = this.evaluateCondition(policy.conditionExpression, context);
    const action = conditionMet ? policy.action : 'allow';

    const result: PolicyEvaluationResult = {
      policyId,
      policyName: policy.name,
      policyType: policy.policyType,
      action,
      allowed: action === 'allow' || action === 'allow_with_warning',
      severity: policy.severity ?? undefined,
      message: conditionMet ? `Policy triggered: ${action}` : 'Policy not triggered',
      conditionMet,
    };

    if (!result.allowed && conditionMet) {
      await this.recordViolation(result, context);
    }

    return result;
  }

  private evaluateCondition(expression: string | null, context: PolicyContext): boolean {
    if (!expression) {
      return true;
    }

    try {
      return this.evaluateComplexCondition(expression, context);
    } catch (error) {
      serviceLogger.error({ expression, error }, 'Failed to evaluate condition');
      return false;
    }
  }

  private evaluateComplexCondition(expression: string, context: PolicyContext): boolean {
    const andParts = expression.split(' AND ').map(p => p.trim());

    for (const part of andParts) {
      if (part.includes(' OR ')) {
        const orParts = part.split(' OR ').map(p => p.trim());
        let orResult = false;
        for (const orPart of orParts) {
          if (this.evaluateSimpleCondition(orPart, context)) {
            orResult = true;
            break;
          }
        }
        if (!orResult) {
          return false;
        }
      } else {
        if (!this.evaluateSimpleCondition(part, context)) {
          return false;
        }
      }
    }

    return true;
  }

  private evaluateSimpleCondition(expression: string, context: PolicyContext): boolean {
    expression = expression.replace(/[()]/g, '').trim();

    const match = expression.match(/(\w+)\s*(>|<|=|>=|<=|!=)\s*(.+)/);
    if (!match) {
      return false;
    }

    const [, field, operator, valueStr] = match;
    const contextValue = this.getContextValue(field, context);
    const compareValue = this.parseValue(valueStr);

    switch (operator) {
      case '>':
        return contextValue > compareValue;
      case '<':
        return contextValue < compareValue;
      case '=':
        return contextValue === compareValue;
      case '>=':
        return contextValue >= compareValue;
      case '<=':
        return contextValue <= compareValue;
      case '!=':
        return contextValue !== compareValue;
      default:
        return false;
    }
  }

  private getContextValue(field: string, context: PolicyContext): any {
    switch (field) {
      case 'cost':
        return context.cost ?? 0;
      case 'actorId':
        return context.actorId ?? '';
      case 'actorType':
        return context.actorType ?? '';
      case 'scopeType':
        return context.scopeType;
      case 'scopeId':
        return context.scopeId;
      case 'targetType':
        return context.targetType;
      case 'targetId':
        return context.targetId;
      case 'action':
        return context.action;
      default:
        return context.metadata?.[field] ?? null;
    }
  }

  private parseValue(valueStr: string): any {
    const trimmed = valueStr.trim();

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }

    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }

    if (trimmed === 'true') {
      return true;
    }
    if (trimmed === 'false') {
      return false;
    }
    if (trimmed === 'null') {
      return null;
    }

    const num = Number(trimmed);
    if (!isNaN(num)) {
      return num;
    }

    return trimmed;
  }

  private isActionMoreRestrictive(action1: PolicyAction, action2: PolicyAction): boolean {
    const severityOrder: Record<PolicyAction, number> = {
      allow: 0,
      allow_with_warning: 1,
      require_approval: 2,
      quarantine: 3,
      escalate: 4,
      block: 5,
    };

    return severityOrder[action1] > severityOrder[action2];
  }

  private async recordViolation(result: PolicyEvaluationResult, context: PolicyContext): Promise<void> {
    serviceLogger.warn({
      policyId: result.policyId,
      scopeId: context.scopeId,
      action: context.action,
    }, 'Recording policy violation');

    await prisma.policyViolation.create({
      data: {
        policyId: result.policyId,
        scopeType: context.scopeType,
        scopeId: context.scopeId,
        actorId: context.actorId,
        actorType: context.actorType,
        targetType: context.targetType,
        targetId: context.targetId,
        actionAttempted: context.action,
        severity: result.severity ?? 'medium',
        context: context.metadata ?? {},
        resolved: false,
      },
    });

    await prisma.auditEvent.create({
      data: {
        eventType: 'policy_violation',
        actorRoleId: context.actorType === 'role' ? context.actorId : undefined,
        actorAgentId: context.actorType === 'agent' ? context.actorId : undefined,
        targetType: context.targetType,
        targetId: context.targetId,
        description: `Policy violation: ${result.policyName} - ${result.message}`,
        payload: {
          policyId: result.policyId,
          policyName: result.policyName,
          action: result.action,
          context,
        },
        severity: this.mapSeverity(result.severity),
      },
    });
  }

  private mapSeverity(severity?: string): AuditSeverity {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
      case 'warning':
        return 'warning';
      case 'medium':
      case 'low':
      case 'info':
      default:
        return 'info';
    }
  }

  async getViolations(filters?: {
    scopeId?: string;
    policyId?: string;
    resolved?: boolean;
    severity?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<PolicyViolation[]> {
    serviceLogger.debug({ filters }, 'Getting policy violations');

    return prisma.policyViolation.findMany({
      where: {
        ...(filters?.scopeId && { scopeId: filters.scopeId }),
        ...(filters?.policyId && { policyId: filters.policyId }),
        ...(filters?.resolved !== undefined && { resolved: filters.resolved }),
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.fromDate && { createdAt: { gte: filters.fromDate } }),
        ...(filters?.toDate && { createdAt: { lte: filters.toDate } }),
      },
      include: {
        policy: true,
      },
      orderBy: { createdAt: 'desc' },
    }) as any;
  }

  async resolveViolation(violationId: string, resolvedBy: string, resolutionNote?: string): Promise<void> {
    serviceLogger.info({ violationId, resolvedBy }, 'Resolving policy violation');

    await prisma.policyViolation.update({
      where: { violationId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNote,
      },
    });
  }

  async getViolationStats(scopeId?: string): Promise<{
    total: number;
    unresolved: number;
    bySeverity: Record<string, number>;
    byPolicyType: Record<string, number>;
    recentTrend: Array<{ date: string; count: number }>;
  }> {
    serviceLogger.debug({ scopeId }, 'Getting violation statistics');

    const where = scopeId ? { scopeId } : {};

    const [total, unresolved, bySeverity, byPolicyType, recentViolations] = await Promise.all([
      prisma.policyViolation.count({ where }),
      prisma.policyViolation.count({ where: { ...where, resolved: false } }),
      prisma.policyViolation.groupBy({
        by: ['severity'],
        where,
        _count: { severity: true },
      }),
      prisma.$queryRaw`
        SELECT p.policy_type, COUNT(*) as count
        FROM policy_violations v
        JOIN policies p ON v.policy_id = p.policy_id
        ${scopeId ? prisma.$queryRaw`WHERE v.scope_id = ${scopeId}` : prisma.$queryRaw``}
        GROUP BY p.policy_type
      `,
      prisma.policyViolation.findMany({
        where: {
          ...where,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: { createdAt: true },
      }),
    ]);

    const severityMap: Record<string, number> = {};
    for (const s of bySeverity) {
      severityMap[s.severity] = s._count.severity;
    }

    const policyTypeMap: Record<string, number> = {};
    for (const pt of byPolicyType as any[]) {
      policyTypeMap[pt.policy_type] = Number(pt.count);
    }

    const trendMap = new Map<string, number>();
    for (const v of recentViolations) {
      const date = v.createdAt.toISOString().split('T')[0];
      trendMap.set(date, (trendMap.get(date) || 0) + 1);
    }

    const recentTrend = Array.from(trendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      total,
      unresolved,
      bySeverity: severityMap,
      byPolicyType: policyTypeMap,
      recentTrend,
    };
  }

  async checkToolUsage(actorId: string, toolName: string, scopeId: string): Promise<{
    allowed: boolean;
    requiresApproval: boolean;
    message?: string;
  }> {
    return this.checkResourceAccess('tool', toolName, actorId, scopeId);
  }

  async checkSkillUsage(actorId: string, skillId: string, scopeId: string): Promise<{
    allowed: boolean;
    requiresApproval: boolean;
    message?: string;
  }> {
    return this.checkResourceAccess('skill', skillId, actorId, scopeId);
  }

  async checkMCPUsage(actorId: string, mcpId: string, scopeId: string): Promise<{
    allowed: boolean;
    requiresApproval: boolean;
    message?: string;
  }> {
    return this.checkResourceAccess('mcp', mcpId, actorId, scopeId);
  }

  private async checkResourceAccess(
    resourceType: string,
    resourceId: string,
    actorId: string,
    scopeId: string,
  ): Promise<{ allowed: boolean; requiresApproval: boolean; message?: string }> {
    const context: PolicyContext = {
      actorId,
      actorType: 'agent',
      scopeType: 'company',
      scopeId,
      targetType: resourceType,
      targetId: resourceId,
      action: 'use',
    };

    const result = await this.evaluatePolicies(context);

    return {
      allowed: result.allowed,
      requiresApproval: result.action === 'require_approval',
      message: result.violations.length > 0
        ? result.violations.map(v => v.message).join('; ')
        : undefined,
    };
  }
}
