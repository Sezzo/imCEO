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
  approvalRequirement?: string;
  enabled?: boolean;
}

export interface UpdatePolicyDTO extends Partial<CreatePolicyDTO> {}

export interface PolicyFilters {
  type?: string;
  scopeId?: string;
  enabled?: boolean;
  policyType?: PolicyType;
}

export interface PolicyTestResult {
  policyId: string;
  policyName: string;
  action: PolicyAction;
  allowed: boolean;
  message?: string;
  conditionMet: boolean;
  evaluatedAt: Date;
}

export interface PolicyEvaluationContext {
  actorId?: string;
  actorType?: string;
  targetType?: string;
  targetId?: string;
  action?: string;
  cost?: number;
  timeElapsed?: number;
  failureCount?: number;
  data?: Record<string, any>;
}

export interface PolicySet {
  allow: PolicyTestResult[];
  warn: PolicyTestResult[];
  block: PolicyTestResult[];
  escalate: PolicyTestResult[];
  requireApproval: PolicyTestResult[];
}

export interface ComplexCondition {
  and?: Array<ComplexCondition | string>;
  or?: Array<ComplexCondition | string>;
  not?: ComplexCondition | string;
  expression?: string;
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

  // ============================================================================
  // Advanced Rule Evaluation
  // ============================================================================

  async evaluatePolicy(
    id: string,
    context: PolicyEvaluationContext
  ): Promise<PolicyTestResult> {
    serviceLogger.debug({ policyId: id, context }, 'Evaluating policy with context');

    const policy = await prisma.policy.findUnique({
      where: { policyId: id },
    });

    if (!policy) {
      throw new Error('Policy not found');
    }

    if (!policy.enabled) {
      return {
        policyId: id,
        policyName: policy.name,
        action: 'allow' as PolicyAction,
        allowed: true,
        message: 'Policy is disabled',
        conditionMet: false,
        evaluatedAt: new Date(),
      };
    }

    // Parse and evaluate the condition
    const conditionMet = await this.evaluateComplexCondition(
      policy.conditionExpression,
      context
    );

    const effectiveAction = conditionMet ? policy.action : ('allow' as PolicyAction);

    return {
      policyId: id,
      policyName: policy.name,
      action: effectiveAction,
      allowed: this.isActionAllowed(effectiveAction),
      message: conditionMet
        ? `Policy triggered: ${policy.action}`
        : 'Policy condition not met',
      conditionMet,
      evaluatedAt: new Date(),
    };
  }

  async evaluateMultiplePolicies(
    policyIds: string[],
    context: PolicyEvaluationContext
  ): Promise<PolicyTestResult[]> {
    serviceLogger.debug({ policyCount: policyIds.length }, 'Evaluating multiple policies');

    const results: PolicyTestResult[] = [];
    for (const id of policyIds) {
      try {
        const result = await this.evaluatePolicy(id, context);
        results.push(result);
      } catch (error) {
        serviceLogger.warn({ policyId: id, error }, 'Failed to evaluate policy');
      }
    }

    return results;
  }

  async evaluateAllApplicablePolicies(
    scopeId: string,
    policyType: PolicyType,
    context: PolicyEvaluationContext
  ): Promise<PolicySet> {
    serviceLogger.debug({ scopeId, policyType }, 'Evaluating all applicable policies');

    // Find all applicable policies
    const policies = await prisma.policy.findMany({
      where: {
        scopeId,
        policyType,
        enabled: true,
      },
    });

    const results = await this.evaluateMultiplePolicies(
      policies.map((p) => p.policyId),
      context
    );

    // Group by action
    const policySet: PolicySet = {
      allow: [],
      warn: [],
      block: [],
      escalate: [],
      requireApproval: [],
    };

    for (const result of results) {
      switch (result.action) {
        case 'allow':
        case 'allow_with_warning':
          policySet.allow.push(result);
          if (result.action === 'allow_with_warning') {
            policySet.warn.push(result);
          }
          break;
        case 'block':
        case 'quarantine':
          policySet.block.push(result);
          break;
        case 'escalate':
          policySet.escalate.push(result);
          break;
        case 'require_approval':
          policySet.requireApproval.push(result);
          break;
      }
    }

    return policySet;
  }

  async checkPermission(
    scopeId: string,
    policyType: PolicyType,
    context: PolicyEvaluationContext
  ): Promise<{ allowed: boolean; blockingPolicies: string[]; warnings: string[] }> {
    serviceLogger.debug({ scopeId, policyType }, 'Checking permission');

    const policySet = await this.evaluateAllApplicablePolicies(
      scopeId,
      policyType,
      context
    );

    const blockingPolicies = policySet.block.map((p) => p.policyName);
    const warnings = policySet.warn.map((p) => p.message || p.policyName);

    return {
      allowed: policySet.block.length === 0,
      blockingPolicies,
      warnings,
    };
  }

  // ============================================================================
  // Complex Condition Evaluation
  // ============================================================================

  private async evaluateComplexCondition(
    expression: string | null,
    context: PolicyEvaluationContext
  ): Promise<boolean> {
    if (!expression) {
      return true; // No condition means always apply
    }

    // Check if it's a simple expression or complex JSON
    const trimmed = expression.trim();
    if (trimmed.startsWith('{')) {
      try {
        const complex = JSON.parse(trimmed) as ComplexCondition;
        return this.evaluateComplexNode(complex, context);
      } catch {
        // Fall back to simple evaluation if JSON parsing fails
      }
    }

    return this.evaluateSimpleCondition(expression, context);
  }

  private evaluateComplexNode(
    node: ComplexCondition,
    context: PolicyEvaluationContext
  ): boolean {
    // Handle AND
    if (node.and) {
      for (const condition of node.and) {
        const result =
          typeof condition === 'string'
            ? this.evaluateSimpleCondition(condition, context)
            : this.evaluateComplexNode(condition, context);
        if (!result) return false;
      }
      return true;
    }

    // Handle OR
    if (node.or) {
      for (const condition of node.or) {
        const result =
          typeof condition === 'string'
            ? this.evaluateSimpleCondition(condition, context)
            : this.evaluateComplexNode(condition, context);
        if (result) return true;
      }
      return false;
    }

    // Handle NOT
    if (node.not) {
      const result =
        typeof node.not === 'string'
          ? this.evaluateSimpleCondition(node.not, context)
          : this.evaluateComplexNode(node.not, context);
      return !result;
    }

    // Handle simple expression
    if (node.expression) {
      return this.evaluateSimpleCondition(node.expression, context);
    }

    return true;
  }

  private evaluateSimpleCondition(
    expression: string,
    context: PolicyEvaluationContext
  ): boolean {
    try {
      // Support patterns like:
      // - "cost > 100"
      // - "actorType == 'agent'"
      // - "timeElapsed >= 3600"
      // - "failureCount > 3"
      // - "action matches 'delete.*'"

      const match = expression.match(
        /^(\w+)\s*(>|>=|<|<=|=|==|!=|matches)\s*(.+)$/
      );
      if (!match) {
        serviceLogger.warn({ expression }, 'Invalid condition format');
        return false;
      }

      const [, field, operator, rawValue] = match;
      const contextValue = this.getFieldValue(context, field);

      // Parse value
      let compareValue: string | number | boolean;
      const trimmedValue = rawValue.trim();
      if (trimmedValue.startsWith("'") || trimmedValue.startsWith('"')) {
        compareValue = trimmedValue.slice(1, -1);
      } else if (trimmedValue === 'true') {
        compareValue = true;
      } else if (trimmedValue === 'false') {
        compareValue = false;
      } else if (!isNaN(Number(trimmedValue))) {
        compareValue = Number(trimmedValue);
      } else {
        compareValue = trimmedValue;
      }

      if (contextValue === undefined) {
        return false;
      }

      switch (operator) {
        case '>':
          return Number(contextValue) > Number(compareValue);
        case '>=':
          return Number(contextValue) >= Number(compareValue);
        case '<':
          return Number(contextValue) < Number(compareValue);
        case '<=':
          return Number(contextValue) <= Number(compareValue);
        case '=':
        case '==':
          return contextValue === compareValue;
        case '!=':
          return contextValue !== compareValue;
        case 'matches':
          if (typeof compareValue !== 'string') return false;
          const regex = new RegExp(compareValue);
          return regex.test(String(contextValue));
        default:
          return false;
      }
    } catch (error) {
      serviceLogger.error({ expression, error }, 'Failed to evaluate condition');
      return false;
    }
  }

  private getFieldValue(
    context: PolicyEvaluationContext,
    field: string
  ): any {
    // Direct context fields
    if (field in context) {
      return (context as any)[field];
    }

    // Nested data fields
    if (context.data && field in context.data) {
      return context.data[field];
    }

    return undefined;
  }

  private isActionAllowed(action: PolicyAction): boolean {
    return action === 'allow' || action === 'allow_with_warning';
  }

  // ============================================================================
  // Policy Testing & Validation
  // ============================================================================

  async testPolicyWithScenarios(
    policyId: string,
    scenarios: PolicyEvaluationContext[]
  ): Promise<{ scenario: number; result: PolicyTestResult }[]> {
    serviceLogger.debug({ policyId, scenarioCount: scenarios.length }, 'Testing policy with scenarios');

    const results: { scenario: number; result: PolicyTestResult }[] = [];

    for (let i = 0; i < scenarios.length; i++) {
      const result = await this.evaluatePolicy(policyId, scenarios[i]);
      results.push({ scenario: i + 1, result });
    }

    return results;
  }

  validateConditionExpression(expression: string): { valid: boolean; error?: string } {
    if (!expression) {
      return { valid: true };
    }

    try {
      // Check for complex JSON
      if (expression.trim().startsWith('{')) {
        const parsed = JSON.parse(expression);
        this.validateComplexStructure(parsed);
        return { valid: true };
      }

      // Check simple expression format
      const match = expression.match(/^(\w+)\s*(>|>=|<|<=|=|==|!=|matches)\s*(.+)$/);
      if (!match) {
        return { valid: false, error: 'Invalid expression format' };
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  private validateComplexStructure(node: any): void {
    if (typeof node !== 'object' || node === null) {
      throw new Error('Invalid complex condition structure');
    }

    const validKeys = ['and', 'or', 'not', 'expression'];
    const keys = Object.keys(node);

    for (const key of keys) {
      if (!validKeys.includes(key)) {
        throw new Error(`Invalid key in complex condition: ${key}`);
      }
    }

    if (node.and && !Array.isArray(node.and)) {
      throw new Error('"and" must be an array');
    }
    if (node.or && !Array.isArray(node.or)) {
      throw new Error('"or" must be an array');
    }
  }

  // ============================================================================
  // Policy Aggregation & Inheritance
  // ============================================================================

  async getEffectivePolicies(
    companyId: string,
    scopeIds: string[],
    policyType: PolicyType
  ): Promise<PolicyTestResult[]> {
    serviceLogger.debug({ companyId, scopeCount: scopeIds.length }, 'Getting effective policies');

    // Get all policies from all scopes, ordered by specificity
    const allPolicies: { policy: any; scopeId: string; scopeLevel: number }[] = [];

    for (let i = 0; i < scopeIds.length; i++) {
      const scopeId = scopeIds[i];
      const policies = await prisma.policy.findMany({
        where: {
          scopeId,
          policyType,
          enabled: true,
        },
      });

      for (const policy of policies) {
        allPolicies.push({
          policy,
          scopeId,
          scopeLevel: i,
        });
      }
    }

    // Sort by scope level (more specific first)
    allPolicies.sort((a, b) => b.scopeLevel - a.scopeLevel);

    // Return as test results with scope info
    return allPolicies.map((p) => ({
      policyId: p.policy.policyId,
      policyName: p.policy.name,
      action: p.policy.action,
      allowed: this.isActionAllowed(p.policy.action),
      message: `Policy from scope ${p.scopeId}`,
      conditionMet: false,
      evaluatedAt: new Date(),
    }));
  }
}
