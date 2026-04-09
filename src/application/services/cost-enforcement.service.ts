import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { eventPublisher } from '../../infrastructure/websocket';

const serviceLogger = logger.child({ component: 'CostEnforcementService' });

export interface BudgetPolicy {
  scopeType: 'company' | 'team' | 'agent' | 'session';
  scopeId: string;
  dailyLimit?: number;
  monthlyLimit?: number;
  perTaskLimit?: number;
  perSessionLimit?: number;
  alertThresholds: number[]; // Percentages (e.g., [50, 75, 90, 100])
}

export interface CostAlert {
  alertId: string;
  policyId: string;
  scopeType: string;
  scopeId: string;
  threshold: number;
  currentCost: number;
  limit: number;
  severity: 'warning' | 'critical';
  triggeredAt: Date;
  acknowledged: boolean;
}

export interface CostRecord {
  scopeType: string;
  scopeId: string;
  teamId?: string;
  agentId?: string;
  modelProfileId?: string;
  workItemId?: string;
  costType: 'input_tokens' | 'output_tokens' | 'compute' | 'storage' | 'other';
  value: number;
  unit: string;
  details?: Record<string, unknown>;
}

export class CostEnforcementService {
  private activePolicies: Map<string, BudgetPolicy> = new Map();
  private triggeredAlerts: Set<string> = new Set(); // Track already triggered alerts

  // Register a budget policy
  async registerPolicy(policy: BudgetPolicy): Promise<void> {
    const policyId = `${policy.scopeType}:${policy.scopeId}`;
    serviceLogger.info({ policyId, policy }, 'Registering budget policy');

    this.activePolicies.set(policyId, policy);

    // Persist to database
    await prisma.policy.create({
      data: {
        name: `Budget: ${policy.scopeType} ${policy.scopeId}`,
        description: `Budget limit: ${policy.perSessionLimit || policy.perTaskLimit || policy.dailyLimit || policy.monthlyLimit}`,
        policyType: 'budget_policy',
        scopeType: policy.scopeType,
        scopeId: policy.scopeId,
        conditionExpression: JSON.stringify({
          dailyLimit: policy.dailyLimit,
          monthlyLimit: policy.monthlyLimit,
          perTaskLimit: policy.perTaskLimit,
          perSessionLimit: policy.perSessionLimit,
          alertThresholds: policy.alertThresholds,
        }),
        action: 'block',
        enabled: true,
      },
    });
  }

  async unregisterPolicy(scopeType: string, scopeId: string): Promise<void> {
    const policyId = `${scopeType}:${scopeId}`;
    serviceLogger.info({ policyId }, 'Unregistering budget policy');

    this.activePolicies.delete(policyId);

    // Disable in database
    await prisma.policy.updateMany({
      where: {
        policyType: 'budget_policy',
        scopeType,
        scopeId,
      },
      data: { enabled: false },
    });
  }

  // Record a cost
  async recordCost(record: CostRecord): Promise<void> {
    serviceLogger.debug(record, 'Recording cost');

    // Persist to database
    await prisma.costRecord.create({
      data: {
        scopeType: record.scopeType,
        scopeId: record.scopeId,
        teamId: record.teamId,
        agentId: record.agentId,
        modelProfileId: record.modelProfileId,
        workItemId: record.workItemId,
        costType: record.costType,
        value: record.value,
        unit: record.unit,
        details: record.details as Prisma.InputJsonValue,
      },
    });

    // Check thresholds and emit alerts
    await this.checkThresholds(record);
  }

  // Check cost thresholds and emit alerts
  private async checkThresholds(record: CostRecord): Promise<void> {
    // Check relevant policies
    const policiesToCheck = [
      { scopeType: record.scopeType, scopeId: record.scopeId },
      ...(record.teamId ? [{ scopeType: 'team', scopeId: record.teamId }] : []),
      ...(record.agentId ? [{ scopeType: 'agent', scopeId: record.agentId }] : []),
    ];

    for (const { scopeType, scopeId } of policiesToCheck) {
      const policyId = `${scopeType}:${scopeId}`;
      const policy = this.activePolicies.get(policyId);

      if (!policy) continue;

      const currentCost = await this.getCurrentCost(scopeType, scopeId, policy);
      const limit = this.getLimitForPolicy(policy, record);

      if (!limit) continue;

      const percentage = (currentCost / limit) * 100;

      // Check alert thresholds
      for (const threshold of policy.alertThresholds) {
        if (percentage >= threshold) {
          const alertKey = `${policyId}:${threshold}`;

          // Only alert once per threshold
          if (!this.triggeredAlerts.has(alertKey)) {
            this.triggeredAlerts.add(alertKey);

            const alert: CostAlert = {
              alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              policyId,
              scopeType,
              scopeId,
              threshold,
              currentCost,
              limit,
              severity: threshold >= 100 ? 'critical' : 'warning',
              triggeredAt: new Date(),
              acknowledged: false,
            };

            this.emitCostAlert(alert);
          }
        }
      }

      // Check if limit exceeded
      if (currentCost > limit) {
        await this.handleLimitExceeded(policy, currentCost, limit);
      }
    }
  }

  private async getCurrentCost(
    scopeType: string,
    scopeId: string,
    policy: BudgetPolicy
  ): Promise<number> {
    const now = new Date();

    if (policy.dailyLimit) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const result = await prisma.costRecord.aggregate({
        where: {
          scopeType,
          scopeId,
          recordedAt: { gte: startOfDay },
        },
        _sum: { value: true },
      });
      return Number(result._sum.value || 0);
    }

    if (policy.monthlyLimit) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const result = await prisma.costRecord.aggregate({
        where: {
          scopeType,
          scopeId,
          recordedAt: { gte: startOfMonth },
        },
        _sum: { value: true },
      });
      return Number(result._sum.value || 0);
    }

    // For per-session or per-task, get the sum for the active session/task
    const result = await prisma.costRecord.aggregate({
      where: {
        scopeType,
        scopeId,
      },
      _sum: { value: true },
    });
    return Number(result._sum.value || 0);
  }

  private getLimitForPolicy(policy: BudgetPolicy, record: CostRecord): number | undefined {
    if (record.scopeType === 'session' && policy.perSessionLimit) {
      return policy.perSessionLimit;
    }
    if (record.scopeType === 'work_item' && policy.perTaskLimit) {
      return policy.perTaskLimit;
    }
    return policy.dailyLimit || policy.monthlyLimit;
  }

  private emitCostAlert(alert: CostAlert): void {
    serviceLogger.warn(
      { alert },
      `Cost ${alert.severity}: ${alert.scopeType} ${alert.scopeId} at ${alert.threshold}% of budget`
    );

    // Publish event
    eventPublisher.publish(
      'cost_threshold_reached',
      {
        alertId: alert.alertId,
        policyId: alert.policyId,
        scopeType: alert.scopeType,
        scopeId: alert.scopeId,
        threshold: alert.threshold,
        currentCost: alert.currentCost,
        limit: alert.limit,
        severity: alert.severity,
      },
      {
        [alert.scopeType === 'session' ? 'sessionId' : 'teamId']: alert.scopeId,
        priority: alert.severity === 'critical' ? 'critical' : 'high',
      }
    );

    // Record audit event
    prisma.auditEvent.create({
      data: {
        eventType: 'cost_threshold_reached',
        targetType: alert.scopeType,
        targetId: alert.scopeId,
        description: `Cost threshold reached: ${alert.threshold}% of budget (${alert.currentCost}/${alert.limit})`,
        severity: alert.severity === 'critical' ? 'critical' : 'warning',
      },
    }).catch((err) => {
      serviceLogger.error({ error: err }, 'Failed to record audit event');
    });
  }

  private async handleLimitExceeded(
    policy: BudgetPolicy,
    currentCost: number,
    limit: number
  ): Promise<void> {
    serviceLogger.error(
      { policy, currentCost, limit },
      'Cost limit exceeded - taking action'
    );

    // Publish critical event
    eventPublisher.publish(
      'cost_limit_exceeded',
      {
        scopeType: policy.scopeType,
        scopeId: policy.scopeId,
        currentCost,
        limit,
        action: 'terminate',
      },
      {
        priority: 'critical',
      }
    );

    // Take action based on scope type
    if (policy.scopeType === 'session') {
      await this.terminateSession(policy.scopeId, currentCost, limit);
    }
  }

  private async terminateSession(
    sessionId: string,
    currentCost: number,
    limit: number
  ): Promise<void> {
    serviceLogger.error(
      { sessionId, currentCost, limit },
      'Auto-terminating session due to budget exceeded'
    );

    // Import dynamically to avoid circular dependency
    const { TeamSessionService } = await import('./session-team.service');
    const sessionService = new TeamSessionService();

    await sessionService.terminate(
      sessionId,
      `Budget exceeded: $${currentCost.toFixed(2)} / $${limit.toFixed(2)}`
    );
  }

  // Get cost summary for a scope
  async getCostSummary(
    scopeType: string,
    scopeId: string,
    period: 'day' | 'week' | 'month' | 'all' = 'month'
  ): Promise<{
    total: number;
    byType: Record<string, number>;
    byPeriod: Record<string, number>;
    trend: { increasing: boolean; changePercent: number };
  }> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(0);
    }

    const records = await prisma.costRecord.findMany({
      where: {
        scopeType,
        scopeId,
        recordedAt: { gte: startDate },
      },
    });

    const total = records.reduce((sum, r) => sum + Number(r.value), 0);

    const byType: Record<string, number> = {};
    const byPeriod: Record<string, number> = {};

    for (const record of records) {
      byType[record.costType] = (byType[record.costType] || 0) + Number(record.value);

      const periodKey = record.recordedAt.toISOString().split('T')[0];
      byPeriod[periodKey] = (byPeriod[periodKey] || 0) + Number(record.value);
    }

    // Calculate trend (compare first half to second half of period)
    const sortedPeriods = Object.keys(byPeriod).sort();
    const midPoint = Math.floor(sortedPeriods.length / 2);

    const firstHalf = sortedPeriods.slice(0, midPoint).reduce((sum, key) => sum + byPeriod[key], 0);
    const secondHalf = sortedPeriods.slice(midPoint).reduce((sum, key) => sum + byPeriod[key], 0);

    const trend = {
      increasing: secondHalf > firstHalf,
      changePercent: firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0,
    };

    return { total, byType, byPeriod, trend };
  }

  // Reset triggered alerts (for testing or new period)
  resetAlerts(): void {
    this.triggeredAlerts.clear();
    serviceLogger.info('Reset cost alerts');
  }

  // Get active policies
  getActivePolicies(): BudgetPolicy[] {
    return Array.from(this.activePolicies.values());
  }
}

// Singleton instance
export const costEnforcementService = new CostEnforcementService();
