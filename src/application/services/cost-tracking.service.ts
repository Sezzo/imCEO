import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { BudgetPeriod, BudgetAlertLevel } from '@prisma/client';

const serviceLogger = logger.child({ component: 'CostTrackingService' });

export interface CreateCostRecordDTO {
  scopeType: string;
  scopeId: string;
  teamId?: string;
  agentId?: string;
  modelProfileId?: string;
  workItemId?: string;
  costType: string;
  value: number;
  unit?: string;
  details?: Record<string, any>;
}

export interface CreateCostBudgetDTO {
  companyId: string;
  name: string;
  description?: string;
  scopeType: string;
  scopeId: string;
  budgetLimit: number;
  period?: BudgetPeriod;
  startDate: Date;
  endDate?: Date;
  alertThresholds?: {
    warning?: number;
    critical?: number;
  };
}

export interface CostFilters {
  scopeType?: string;
  scopeId?: string;
  teamId?: string;
  agentId?: string;
  costType?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface CostReport {
  totalCost: number;
  byType: Record<string, number>;
  byScope: Record<string, number>;
  byTime: Array<{ period: string; cost: number }>;
  trend: Array<{ date: string; cost: number }>;
}

export class CostTrackingService {
  async createRecord(data: CreateCostRecordDTO) {
    serviceLogger.info({
      scopeType: data.scopeType,
      scopeId: data.scopeId,
      costType: data.costType,
      value: data.value,
    }, 'Creating cost record');

    const record = await prisma.costRecord.create({
      data: {
        scopeType: data.scopeType,
        scopeId: data.scopeId,
        teamId: data.teamId,
        agentId: data.agentId,
        modelProfileId: data.modelProfileId,
        workItemId: data.workItemId,
        costType: data.costType,
        value: data.value,
        unit: data.unit ?? 'USD',
        details: data.details ?? {},
      },
    });

    await this.updateBudgetSpend(data.scopeType, data.scopeId, data.value);

    return record;
  }

  async findAll(filters?: CostFilters) {
    serviceLogger.debug({ filters }, 'Finding all cost records');
    return prisma.costRecord.findMany({
      where: {
        ...(filters?.scopeType && { scopeType: filters.scopeType }),
        ...(filters?.scopeId && { scopeId: filters.scopeId }),
        ...(filters?.teamId && { teamId: filters.teamId }),
        ...(filters?.agentId && { agentId: filters.agentId }),
        ...(filters?.costType && { costType: filters.costType }),
        ...(filters?.fromDate && { recordedAt: { gte: filters.fromDate } }),
        ...(filters?.toDate && { recordedAt: { lte: filters.toDate } }),
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ costRecordId: id }, 'Finding cost record by id');
    return prisma.costRecord.findUnique({
      where: { costRecordId: id },
    });
  }

  async getTotalCost(filters?: CostFilters): Promise<number> {
    serviceLogger.debug({ filters }, 'Calculating total cost');
    const result = await prisma.costRecord.aggregate({
      where: {
        ...(filters?.scopeType && { scopeType: filters.scopeType }),
        ...(filters?.scopeId && { scopeId: filters.scopeId }),
        ...(filters?.teamId && { teamId: filters.teamId }),
        ...(filters?.agentId && { agentId: filters.agentId }),
        ...(filters?.costType && { costType: filters.costType }),
        ...(filters?.fromDate && { recordedAt: { gte: filters.fromDate } }),
        ...(filters?.toDate && { recordedAt: { lte: filters.toDate } }),
      },
      _sum: {
        value: true,
      },
    });

    return result._sum.value?.toNumber() ?? 0;
  }

  async getCostByType(filters?: CostFilters): Promise<Record<string, number>> {
    serviceLogger.debug({ filters }, 'Getting cost by type');
    const records = await prisma.costRecord.groupBy({
      by: ['costType'],
      where: {
        ...(filters?.scopeType && { scopeType: filters.scopeType }),
        ...(filters?.scopeId && { scopeId: filters.scopeId }),
        ...(filters?.fromDate && { recordedAt: { gte: filters.fromDate } }),
        ...(filters?.toDate && { recordedAt: { lte: filters.toDate } }),
      },
      _sum: {
        value: true,
      },
    });

    const result: Record<string, number> = {};
    for (const record of records) {
      result[record.costType] = record._sum.value?.toNumber() ?? 0;
    }

    return result;
  }

  async getCostByScope(scopeType: string, fromDate?: Date, toDate?: Date): Promise<Record<string, number>> {
    serviceLogger.debug({ scopeType, fromDate, toDate }, 'Getting cost by scope');
    const records = await prisma.costRecord.groupBy({
      by: ['scopeId'],
      where: {
        scopeType,
        ...(fromDate && { recordedAt: { gte: fromDate } }),
        ...(toDate && { recordedAt: { lte: toDate } }),
      },
      _sum: {
        value: true,
      },
    });

    const result: Record<string, number> = {};
    for (const record of records) {
      result[record.scopeId] = record._sum.value?.toNumber() ?? 0;
    }

    return result;
  }

  async getCostTrend(period: 'day' | 'week' | 'month', count: number = 30, filters?: CostFilters): Promise<Array<{ period: string; cost: number }>> {
    serviceLogger.debug({ period, count, filters }, 'Getting cost trend');

    const now = new Date();
    const periods: Array<{ start: Date; end: Date; label: string }> = [];

    for (let i = count - 1; i >= 0; i--) {
      const end = new Date(now);
      const start = new Date(now);

      if (period === 'day') {
        start.setDate(end.getDate() - i);
        end.setDate(end.getDate() - i + 1);
        periods.push({
          start,
          end,
          label: start.toISOString().split('T')[0],
        });
      } else if (period === 'week') {
        start.setDate(end.getDate() - i * 7);
        end.setDate(end.getDate() - (i - 1) * 7);
        periods.push({
          start,
          end,
          label: `Week ${i + 1}`,
        });
      } else {
        start.setMonth(end.getMonth() - i);
        end.setMonth(end.getMonth() - i + 1);
        periods.push({
          start,
          end,
          label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        });
      }
    }

    const result: Array<{ period: string; cost: number }> = [];
    for (const p of periods) {
      const cost = await this.getTotalCost({
        ...filters,
        fromDate: p.start,
        toDate: p.end,
      });
      result.push({ period: p.label, cost });
    }

    return result;
  }

  async generateReport(filters?: CostFilters): Promise<CostReport> {
    serviceLogger.info({ filters }, 'Generating cost report');

    const [totalCost, byType, byScope, byTime] = await Promise.all([
      this.getTotalCost(filters),
      this.getCostByType(filters),
      filters?.scopeType ? this.getCostByScope(filters.scopeType, filters.fromDate, filters.toDate) : Promise.resolve({}),
      this.getCostTrend('day', 30, filters),
    ]);

    return {
      totalCost,
      byType,
      byScope,
      byTime,
      trend: byTime,
    };
  }

  async createBudget(data: CreateCostBudgetDTO) {
    serviceLogger.info({
      name: data.name,
      companyId: data.companyId,
      scopeType: data.scopeType,
      limit: data.budgetLimit,
    }, 'Creating cost budget');

    return prisma.costBudget.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        description: data.description,
        scopeType: data.scopeType,
        scopeId: data.scopeId,
        budgetLimit: data.budgetLimit,
        period: data.period ?? 'monthly',
        startDate: data.startDate,
        endDate: data.endDate,
        alertThresholds: data.alertThresholds ?? { warning: 80, critical: 95 },
        currentSpend: 0,
        enabled: true,
      },
    });
  }

  async findBudgetById(id: string) {
    serviceLogger.debug({ budgetId: id }, 'Finding cost budget by id');
    return prisma.costBudget.findUnique({
      where: { budgetId: id },
    });
  }

  async findBudgetsByScope(scopeType: string, scopeId: string) {
    serviceLogger.debug({ scopeType, scopeId }, 'Finding cost budgets by scope');
    return prisma.costBudget.findMany({
      where: {
        scopeType,
        scopeId,
        enabled: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBudgetsByCompany(companyId: string) {
    serviceLogger.debug({ companyId }, 'Finding cost budgets by company');
    return prisma.costBudget.findMany({
      where: {
        companyId,
        enabled: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateBudget(budgetId: string, data: Partial<CreateCostBudgetDTO>) {
    serviceLogger.info({ budgetId }, 'Updating cost budget');
    return prisma.costBudget.update({
      where: { budgetId },
      data: {
        name: data.name,
        description: data.description,
        budgetLimit: data.budgetLimit,
        period: data.period,
        startDate: data.startDate,
        endDate: data.endDate,
        alertThresholds: data.alertThresholds,
      },
    });
  }

  async deleteBudget(budgetId: string) {
    serviceLogger.info({ budgetId }, 'Deleting cost budget');
    await prisma.costBudget.delete({
      where: { budgetId },
    });
  }

  private async updateBudgetSpend(scopeType: string, scopeId: string, amount: number): Promise<void> {
    const budgets = await prisma.costBudget.findMany({
      where: {
        scopeType,
        scopeId,
        enabled: true,
      },
    });

    for (const budget of budgets) {
      const newSpend = budget.currentSpend.toNumber() + amount;
      const percentage = (newSpend / budget.budgetLimit.toNumber()) * 100;
      const thresholds = budget.alertThresholds as { warning?: number; critical?: number } ?? { warning: 80, critical: 95 };

      let newAlertLevel: BudgetAlertLevel = budget.lastAlertLevel;
      let shouldAlert = false;

      if (percentage >= (thresholds.critical ?? 95) && budget.lastAlertLevel !== 'critical') {
        newAlertLevel = 'critical';
        shouldAlert = true;
      } else if (percentage >= (thresholds.warning ?? 80) && budget.lastAlertLevel === 'none') {
        newAlertLevel = 'warning';
        shouldAlert = true;
      }

      if (shouldAlert) {
        serviceLogger.warn({
          budgetId: budget.budgetId,
          percentage,
          alertLevel: newAlertLevel,
        }, 'Budget threshold exceeded');

        await prisma.auditEvent.create({
          data: {
            eventType: 'cost_threshold_reached',
            targetType: scopeType,
            targetId: scopeId,
            description: `Budget alert: ${budget.name} has reached ${percentage.toFixed(1)}% of limit`,
            payload: {
              budgetId: budget.budgetId,
              currentSpend: newSpend,
              budgetLimit: budget.budgetLimit,
              percentage,
              alertLevel: newAlertLevel,
            },
            severity: newAlertLevel === 'critical' ? 'critical' : 'warning',
          },
        });
      }

      await prisma.costBudget.update({
        where: { budgetId: budget.budgetId },
        data: {
          currentSpend: newSpend,
          lastAlertLevel: newAlertLevel,
          lastAlertAt: shouldAlert ? new Date() : budget.lastAlertAt,
        },
      });
    }
  }

  async checkBudgetStatus(scopeType: string, scopeId: string): Promise<{
    hasBudget: boolean;
    budgets: Array<{
      budgetId: string;
      name: string;
      limit: number;
      currentSpend: number;
      percentage: number;
      remaining: number;
      alertLevel: BudgetAlertLevel;
    }>;
    totalLimit: number;
    totalSpent: number;
    wouldExceed: boolean;
  }> {
    serviceLogger.debug({ scopeType, scopeId }, 'Checking budget status');

    const budgets = await this.findBudgetsByScope(scopeType, scopeId);

    if (budgets.length === 0) {
      return {
        hasBudget: false,
        budgets: [],
        totalLimit: 0,
        totalSpent: 0,
        wouldExceed: false,
      };
    }

    let totalLimit = 0;
    let totalSpent = 0;
    let wouldExceed = false;

    const budgetDetails = budgets.map(budget => {
      const limit = budget.budgetLimit.toNumber();
      const spent = budget.currentSpend.toNumber();
      const percentage = (spent / limit) * 100;
      const remaining = limit - spent;

      totalLimit += limit;
      totalSpent += spent;

      if (percentage >= 100) {
        wouldExceed = true;
      }

      return {
        budgetId: budget.budgetId,
        name: budget.name,
        limit,
        currentSpend: spent,
        percentage,
        remaining,
        alertLevel: budget.lastAlertLevel,
      };
    });

    return {
      hasBudget: true,
      budgets: budgetDetails,
      totalLimit,
      totalSpent,
      wouldExceed,
    };
  }

  async resetBudgetSpend(budgetId: string): Promise<void> {
    serviceLogger.info({ budgetId }, 'Resetting budget spend');

    await prisma.costBudget.update({
      where: { budgetId },
      data: {
        currentSpend: 0,
        lastAlertLevel: 'none',
        lastAlertAt: null,
      },
    });
  }

  async getBudgetForecast(budgetId: string, days: number = 30): Promise<{
    projectedSpend: number;
    projectedPercentage: number;
    willExceed: boolean;
    daysUntilExceed?: number;
    trend: Array<{ date: string; projected: number }>;
  }> {
    serviceLogger.debug({ budgetId, days }, 'Calculating budget forecast');

    const budget = await this.findBudgetById(budgetId);
    if (!budget) {
      throw new Error('Budget not found');
    }

    const limit = budget.budgetLimit.toNumber();
    const currentSpend = budget.currentSpend.toNumber();

    const recentSpend = await prisma.costRecord.aggregate({
      where: {
        scopeType: budget.scopeType,
        scopeId: budget.scopeId,
        recordedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      _sum: {
        value: true,
      },
    });

    const weeklySpend = recentSpend._sum.value?.toNumber() ?? 0;
    const dailyRate = weeklySpend / 7;
    const projectedSpend = currentSpend + (dailyRate * days);
    const projectedPercentage = (projectedSpend / limit) * 100;
    const willExceed = projectedSpend > limit;
    const daysUntilExceed = dailyRate > 0
      ? Math.ceil((limit - currentSpend) / dailyRate)
      : undefined;

    const trend: Array<{ date: string; projected: number }> = [];
    const now = new Date();
    for (let i = 0; i <= days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      trend.push({
        date: date.toISOString().split('T')[0],
        projected: currentSpend + (dailyRate * i),
      });
    }

    return {
      projectedSpend,
      projectedPercentage,
      willExceed,
      daysUntilExceed,
      trend,
    };
  }
}
