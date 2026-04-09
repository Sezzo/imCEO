import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { AuditEventType, AuditSeverity } from '@prisma/client';

const serviceLogger = logger.child({ component: 'AuditEventService' });

export interface CreateAuditEventDTO {
  eventType: AuditEventType;
  actorRoleId?: string;
  actorAgentId?: string;
  targetType: string;
  targetId: string;
  description?: string;
  payload?: Record<string, any>;
  severity: AuditSeverity;
}

export interface AuditEventFilters {
  eventType?: AuditEventType;
  actorRoleId?: string;
  actorAgentId?: string;
  targetType?: string;
  targetId?: string;
  severity?: AuditSeverity;
  fromDate?: Date;
  toDate?: Date;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface AuditSummary {
  totalEvents: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byActor: Record<string, number>;
}

export interface AuditTrend {
  period: string;
  count: number;
  bySeverity: Record<string, number>;
}

export class AuditEventService {
  async create(data: CreateAuditEventDTO) {
    serviceLogger.info({
      eventType: data.eventType,
      targetType: data.targetType,
      targetId: data.targetId,
      severity: data.severity,
    }, 'Creating audit event');

    return prisma.auditEvent.create({
      data: {
        eventType: data.eventType,
        actorRoleId: data.actorRoleId,
        actorAgentId: data.actorAgentId,
        targetType: data.targetType,
        targetId: data.targetId,
        description: data.description,
        payload: data.payload ?? {},
        severity: data.severity,
      },
    });
  }

  async findAll(filters?: AuditEventFilters, limit: number = 100, offset: number = 0) {
    serviceLogger.debug({ filters, limit, offset }, 'Finding audit events');

    return prisma.auditEvent.findMany({
      where: {
        ...(filters?.eventType && { eventType: filters.eventType }),
        ...(filters?.actorRoleId && { actorRoleId: filters.actorRoleId }),
        ...(filters?.actorAgentId && { actorAgentId: filters.actorAgentId }),
        ...(filters?.targetType && { targetType: filters.targetType }),
        ...(filters?.targetId && { targetId: filters.targetId }),
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.fromDate || filters?.toDate
          ? {
              createdAt: {
                ...(filters.fromDate && { gte: filters.fromDate }),
                ...(filters.toDate && { lte: filters.toDate }),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ auditEventId: id }, 'Finding audit event by id');
    return prisma.auditEvent.findUnique({
      where: { auditEventId: id },
    });
  }

  async count(filters?: AuditEventFilters): Promise<number> {
    serviceLogger.debug({ filters }, 'Counting audit events');

    return prisma.auditEvent.count({
      where: {
        ...(filters?.eventType && { eventType: filters.eventType }),
        ...(filters?.actorRoleId && { actorRoleId: filters.actorRoleId }),
        ...(filters?.actorAgentId && { actorAgentId: filters.actorAgentId }),
        ...(filters?.targetType && { targetType: filters.targetType }),
        ...(filters?.targetId && { targetId: filters.targetId }),
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.fromDate || filters?.toDate
          ? {
              createdAt: {
                ...(filters.fromDate && { gte: filters.fromDate }),
                ...(filters.toDate && { lte: filters.toDate }),
              },
            }
          : {}),
      },
    });
  }

  async getByTarget(targetType: string, targetId: string, limit: number = 100) {
    serviceLogger.debug({ targetType, targetId }, 'Getting audit events by target');

    return prisma.auditEvent.findMany({
      where: {
        targetType,
        targetId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getByActor(
    actorRoleId?: string,
    actorAgentId?: string,
    limit: number = 100
  ) {
    serviceLogger.debug({ actorRoleId, actorAgentId }, 'Getting audit events by actor');

    return prisma.auditEvent.findMany({
      where: {
        ...(actorRoleId && { actorRoleId }),
        ...(actorAgentId && { actorAgentId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getByDateRange(dateRange: DateRange, limit: number = 100) {
    serviceLogger.debug({ dateRange }, 'Getting audit events by date range');

    return prisma.auditEvent.findMany({
      where: {
        ...(dateRange.from || dateRange.to
          ? {
              createdAt: {
                ...(dateRange.from && { gte: dateRange.from }),
                ...(dateRange.to && { lte: dateRange.to }),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getSummary(dateRange?: DateRange): Promise<AuditSummary> {
    serviceLogger.debug({ dateRange }, 'Getting audit event summary');

    const whereClause = {
      ...(dateRange?.from || dateRange?.to
        ? {
            createdAt: {
              ...(dateRange.from && { gte: dateRange.from }),
              ...(dateRange.to && { lte: dateRange.to }),
            },
          }
        : {}),
    };

    const [totalEvents, bySeverity, byType, byActor] = await Promise.all([
      prisma.auditEvent.count({ where: whereClause }),
      prisma.auditEvent.groupBy({
        by: ['severity'],
        where: whereClause,
        _count: { severity: true },
      }),
      prisma.auditEvent.groupBy({
        by: ['eventType'],
        where: whereClause,
        _count: { eventType: true },
      }),
      prisma.auditEvent.groupBy({
        by: ['actorAgentId'],
        where: {
          ...whereClause,
          actorAgentId: { not: null },
        },
        _count: { actorAgentId: true },
      }),
    ]);

    const severityMap: Record<string, number> = {};
    bySeverity.forEach((item) => {
      severityMap[item.severity] = item._count.severity;
    });

    const typeMap: Record<string, number> = {};
    byType.forEach((item) => {
      typeMap[item.eventType] = item._count.eventType;
    });

    const actorMap: Record<string, number> = {};
    byActor.forEach((item) => {
      if (item.actorAgentId) {
        actorMap[item.actorAgentId] = item._count.actorAgentId;
      }
    });

    return {
      totalEvents,
      bySeverity: severityMap,
      byType: typeMap,
      byActor: actorMap,
    };
  }

  async getTrends(
    dateRange: DateRange,
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<AuditTrend[]> {
    serviceLogger.debug({ dateRange, granularity }, 'Getting audit event trends');

    const rawData = await prisma.auditEvent.findMany({
      where: {
        ...(dateRange.from || dateRange.to
          ? {
              createdAt: {
                ...(dateRange.from && { gte: dateRange.from }),
                ...(dateRange.to && { lte: dateRange.to }),
              },
            }
          : {}),
      },
      select: {
        createdAt: true,
        severity: true,
      },
    });

    // Group by period
    const trends = new Map<string, { count: number; bySeverity: Record<string, number> }>();

    for (const event of rawData) {
      let period: string;

      switch (granularity) {
        case 'hour':
          period = event.createdAt.toISOString().slice(0, 13); // YYYY-MM-DDTHH
          break;
        case 'day':
          period = event.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
          break;
        case 'week': {
          const weekStart = new Date(event.createdAt);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          period = weekStart.toISOString().slice(0, 10);
          break;
        }
        case 'month':
          period = event.createdAt.toISOString().slice(0, 7); // YYYY-MM
          break;
        default:
          period = event.createdAt.toISOString().slice(0, 10);
      }

      if (!trends.has(period)) {
        trends.set(period, { count: 0, bySeverity: {} });
      }

      const trend = trends.get(period)!;
      trend.count++;
      trend.bySeverity[event.severity] = (trend.bySeverity[event.severity] || 0) + 1;
    }

    return Array.from(trends.entries())
      .map(([period, data]) => ({
        period,
        count: data.count,
        bySeverity: data.bySeverity,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async getCriticalEvents(since?: Date, limit: number = 50) {
    serviceLogger.debug({ since }, 'Getting critical audit events');

    return prisma.auditEvent.findMany({
      where: {
        severity: 'critical',
        ...(since
          ? {
              createdAt: { gte: since },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async search(
    query: string,
    filters?: AuditEventFilters,
    limit: number = 50
  ) {
    serviceLogger.debug({ query, filters }, 'Searching audit events');

    // Search in description and target type
    return prisma.auditEvent.findMany({
      where: {
        OR: [
          { description: { contains: query, mode: 'insensitive' } },
          { targetType: { contains: query, mode: 'insensitive' } },
          { eventType: { contains: query, mode: 'insensitive' } },
        ],
        ...(filters?.eventType && { eventType: filters.eventType }),
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.fromDate || filters?.toDate
          ? {
              createdAt: {
                ...(filters.fromDate && { gte: filters.fromDate }),
                ...(filters.toDate && { lte: filters.toDate }),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async deleteOldEvents(olderThan: Date): Promise<number> {
    serviceLogger.info({ olderThan }, 'Deleting old audit events');

    const result = await prisma.auditEvent.deleteMany({
      where: {
        createdAt: { lt: olderThan },
        severity: { not: 'critical' }, // Keep critical events
      },
    });

    return result.count;
  }

  // Convenience methods for common event types
  async logCompanyCreated(
    companyId: string,
    actorRoleId?: string,
    actorAgentId?: string
  ) {
    return this.create({
      eventType: 'company_created',
      actorRoleId,
      actorAgentId,
      targetType: 'company',
      targetId: companyId,
      description: `Company created: ${companyId}`,
      severity: 'info',
    });
  }

  async logWorkItemStateChanged(
    workItemId: string,
    fromState: string,
    toState: string,
    actorRoleId?: string,
    actorAgentId?: string
  ) {
    return this.create({
      eventType: 'work_item_state_changed',
      actorRoleId,
      actorAgentId,
      targetType: 'work_item',
      targetId: workItemId,
      description: `Work item state changed from ${fromState} to ${toState}`,
      payload: { fromState, toState },
      severity: 'info',
    });
  }

  async logPolicyViolation(
    policyId: string,
    targetId: string,
    details: Record<string, any>,
    actorRoleId?: string,
    actorAgentId?: string
  ) {
    return this.create({
      eventType: 'policy_violation',
      actorRoleId,
      actorAgentId,
      targetType: 'policy',
      targetId: policyId,
      description: `Policy violation detected`,
      payload: { ...details, affectedTarget: targetId },
      severity: 'warning',
    });
  }

  async logCostThresholdReached(
    scopeId: string,
    cost: number,
    threshold: number,
    actorRoleId?: string,
    actorAgentId?: string
  ) {
    return this.create({
      eventType: 'cost_threshold_reached',
      actorRoleId,
      actorAgentId,
      targetType: 'cost_budget',
      targetId: scopeId,
      description: `Cost threshold reached: ${cost} / ${threshold}`,
      payload: { cost, threshold },
      severity: 'warning',
    });
  }

  async logApprovalRequested(
    approvalRequestId: string,
    requestedBy: string,
    actorRoleId?: string,
    actorAgentId?: string
  ) {
    return this.create({
      eventType: 'approval_requested',
      actorRoleId,
      actorAgentId,
      targetType: 'approval_request',
      targetId: approvalRequestId,
      description: `Approval requested by ${requestedBy}`,
      payload: { requestedBy },
      severity: 'info',
    });
  }

  async logDecisionApproved(
    targetType: string,
    targetId: string,
    approvedBy: string,
    actorRoleId?: string,
    actorAgentId?: string
  ) {
    return this.create({
      eventType: 'decision_approved',
      actorRoleId,
      actorAgentId,
      targetType,
      targetId,
      description: `Decision approved by ${approvedBy}`,
      payload: { approvedBy },
      severity: 'info',
    });
  }
}
