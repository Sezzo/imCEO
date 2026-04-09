import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { ApprovalRequestState } from '@prisma/client';

const serviceLogger = logger.child({ component: 'ApprovalRequestService' });

export interface CreateApprovalRequestDTO {
  targetType: string;
  targetId: string;
  reason?: string;
  requestedByRoleId: string;
  requestedByAgentId?: string;
  requiredApproverRoleIds?: string[];
  expiresAt?: string;
}

export interface ApprovalRequestFilters {
  targetType?: string;
  targetId?: string;
  requestedByRoleId?: string;
  requestedByAgentId?: string;
  state?: ApprovalRequestState;
}

export interface SubmitApprovalDTO {
  approvedByRoleId?: string;
  approvedByAgentId?: string;
  notes?: string;
}

export interface SubmitRejectionDTO {
  rejectedByRoleId?: string;
  rejectedByAgentId?: string;
  reason: string;
}

export interface ApprovalSummary {
  totalRequests: number;
  byState: Record<string, number>;
  approved: number;
  rejected: number;
  pending: number;
  expired: number;
  escalated: number;
  avgApprovalTime: number | null;
}

export class ApprovalRequestService {
  async findAll(filters?: ApprovalRequestFilters) {
    serviceLogger.debug({ filters }, 'Finding all approval requests');

    return prisma.approvalRequest.findMany({
      where: {
        ...(filters?.targetType && { targetType: filters.targetType }),
        ...(filters?.targetId && { targetId: filters.targetId }),
        ...(filters?.requestedByRoleId && { requestedByRoleId: filters.requestedByRoleId }),
        ...(filters?.requestedByAgentId && { requestedByAgentId: filters.requestedByAgentId }),
        ...(filters?.state && { state: filters.state }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ approvalRequestId: id }, 'Finding approval request by id');
    return prisma.approvalRequest.findUnique({
      where: { approvalRequestId: id },
    });
  }

  async create(data: CreateApprovalRequestDTO) {
    serviceLogger.info({
      targetType: data.targetType,
      targetId: data.targetId,
      requestedByRoleId: data.requestedByRoleId,
    }, 'Creating approval request');

    return prisma.approvalRequest.create({
      data: {
        targetType: data.targetType,
        targetId: data.targetId,
        reason: data.reason,
        requestedByRoleId: data.requestedByRoleId,
        requestedByAgentId: data.requestedByAgentId,
        requiredApproverRoleIds: data.requiredApproverRoleIds ?? [],
        state: 'pending',
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
    });
  }

  async approve(id: string, _data: SubmitApprovalDTO) {
    serviceLogger.info({ approvalRequestId: id }, 'Approving request');

    const request = await prisma.approvalRequest.findUnique({
      where: { approvalRequestId: id },
    });

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.state !== 'pending') {
      throw new Error(`Cannot approve request in ${request.state} state`);
    }

    // Check if expired
    if (request.expiresAt && new Date() > request.expiresAt) {
      await this.expire(id);
      throw new Error('Approval request has expired');
    }

    return prisma.approvalRequest.update({
      where: { approvalRequestId: id },
      data: {
        state: 'approved',
        approvedAt: new Date(),
      },
    });
  }

  async reject(id: string, data: SubmitRejectionDTO) {
    serviceLogger.info({ approvalRequestId: id, reason: data.reason }, 'Rejecting request');

    const request = await prisma.approvalRequest.findUnique({
      where: { approvalRequestId: id },
    });

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.state !== 'pending') {
      throw new Error(`Cannot reject request in ${request.state} state`);
    }

    // Check if expired
    if (request.expiresAt && new Date() > request.expiresAt) {
      await this.expire(id);
      throw new Error('Approval request has expired');
    }

    return prisma.approvalRequest.update({
      where: { approvalRequestId: id },
      data: {
        state: 'rejected',
        rejectedAt: new Date(),
      },
    });
  }

  async escalate(id: string, reason?: string) {
    serviceLogger.info({ approvalRequestId: id, reason }, 'Escalating request');

    const request = await prisma.approvalRequest.findUnique({
      where: { approvalRequestId: id },
    });

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.state !== 'pending') {
      throw new Error(`Cannot escalate request in ${request.state} state`);
    }

    return prisma.approvalRequest.update({
      where: { approvalRequestId: id },
      data: {
        state: 'escalated',
        escalatedAt: new Date(),
      },
    });
  }

  async expire(id: string) {
    serviceLogger.info({ approvalRequestId: id }, 'Expiring request');

    const request = await prisma.approvalRequest.findUnique({
      where: { approvalRequestId: id },
    });

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.state !== 'pending') {
      throw new Error(`Cannot expire request in ${request.state} state`);
    }

    return prisma.approvalRequest.update({
      where: { approvalRequestId: id },
      data: {
        state: 'expired',
      },
    });
  }

  async cancel(id: string, reason?: string) {
    serviceLogger.info({ approvalRequestId: id, reason }, 'Cancelling request');

    const request = await prisma.approvalRequest.findUnique({
      where: { approvalRequestId: id },
    });

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.state !== 'pending') {
      throw new Error(`Cannot cancel request in ${request.state} state`);
    }

    await prisma.approvalRequest.delete({
      where: { approvalRequestId: id },
    });
  }

  async checkExpiration(): Promise<number> {
    serviceLogger.debug('Checking for expired approval requests');

    const expiredRequests = await prisma.approvalRequest.findMany({
      where: {
        state: 'pending',
        expiresAt: { lt: new Date() },
      },
    });

    for (const request of expiredRequests) {
      await this.expire(request.approvalRequestId);
    }

    return expiredRequests.length;
  }

  async getPendingForApprover(
    roleId?: string,
    agentId?: string
  ) {
    serviceLogger.debug({ roleId, agentId }, 'Getting pending approvals for approver');

    if (!roleId && !agentId) {
      throw new Error('Either roleId or agentId must be specified');
    }

    const whereClause: any = {
      state: 'pending',
    };

    if (roleId) {
      whereClause.requiredApproverRoleIds = {
        has: roleId,
      };
    }

    return prisma.approvalRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequestsByRequester(
    roleId?: string,
    agentId?: string
  ) {
    serviceLogger.debug({ roleId, agentId }, 'Getting requests by requester');

    type WhereClause = { requestedByRoleId?: string; requestedByAgentId?: string };
    const whereClause: WhereClause = {};

    if (roleId) {
      whereClause.requestedByRoleId = roleId;
    }
    if (agentId) {
      whereClause.requestedByAgentId = agentId;
    }

    return prisma.approvalRequest.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStatus(targetType: string, targetId: string) {
    serviceLogger.debug({ targetType, targetId }, 'Getting approval status');

    const requests = await prisma.approvalRequest.findMany({
      where: {
        targetType,
        targetId,
      },
      orderBy: { createdAt: 'desc' },
    });

    const latest = requests[0];
    const pending = requests.filter((r) => r.state === 'pending');
    const approved = requests.filter((r) => r.state === 'approved');
    const rejected = requests.filter((r) => r.state === 'rejected');

    return {
      hasActiveRequest: pending.length > 0,
      latestRequest: latest,
      totalRequests: requests.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      canRequest: pending.length === 0 && (latest?.state !== 'pending'),
      isApproved: approved.length > 0 && pending.length === 0,
      isBlocked: rejected.length > 0 && pending.length === 0,
    };
  }

  async getSummary(
    dateRange?: { from?: Date; to?: Date }
  ): Promise<ApprovalSummary> {
    serviceLogger.debug({ dateRange }, 'Getting approval summary');

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

    const requests = await prisma.approvalRequest.findMany({
      where: whereClause,
    });

    const byState: Record<string, number> = {};
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    let expired = 0;
    let escalated = 0;

    let totalApprovalTime = 0;
    let approvalCount = 0;

    requests.forEach((request) => {
      byState[request.state] = (byState[request.state] || 0) + 1;

      switch (request.state) {
        case 'approved':
          approved++;
          if (request.approvedAt && request.createdAt) {
            totalApprovalTime += request.approvedAt.getTime() - request.createdAt.getTime();
            approvalCount++;
          }
          break;
        case 'rejected':
          rejected++;
          break;
        case 'pending':
          pending++;
          break;
        case 'expired':
          expired++;
          break;
        case 'escalated':
          escalated++;
          break;
      }
    });

    const avgApprovalTime = approvalCount > 0
      ? totalApprovalTime / approvalCount / 1000 / 60 // in minutes
      : null;

    return {
      totalRequests: requests.length,
      byState,
      approved,
      rejected,
      pending,
      expired,
      escalated,
      avgApprovalTime,
    };
  }

  async getApprovalChain(
    requestId: string
  ): Promise<Array<{ state: string; timestamp: Date | null; notes?: string }>> {
    serviceLogger.debug({ requestId }, 'Getting approval chain');

    const request = await prisma.approvalRequest.findUnique({
      where: { approvalRequestId: requestId },
    });

    if (!request) {
      throw new Error('Approval request not found');
    }

    const chain: Array<{ state: string; timestamp: Date | null; notes?: string }> = [
      { state: 'requested', timestamp: request.createdAt, notes: request.reason || undefined },
    ];

    if (request.approvedAt) {
      chain.push({ state: 'approved', timestamp: request.approvedAt });
    }

    if (request.rejectedAt) {
      chain.push({ state: 'rejected', timestamp: request.rejectedAt });
    }

    if (request.escalatedAt) {
      chain.push({ state: 'escalated', timestamp: request.escalatedAt });
    }

    return chain;
  }

  async delegateApproval(
    requestId: string,
    fromRoleId: string,
    toRoleId: string
  ) {
    serviceLogger.info({ requestId, fromRoleId, toRoleId }, 'Delegating approval');

    const request = await prisma.approvalRequest.findUnique({
      where: { approvalRequestId: requestId },
    });

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.state !== 'pending') {
      throw new Error(`Cannot delegate approval in ${request.state} state`);
    }

    // Update required approver role IDs
    const currentRequired = (request.requiredApproverRoleIds as string[] | null) || [];
    const newRequired = currentRequired.map((roleId: string) =>
      roleId === fromRoleId ? toRoleId : roleId
    );

    // If fromRoleId wasn't in the list, add toRoleId
    if (!currentRequired.includes(fromRoleId)) {
      newRequired.push(toRoleId);
    }

    return prisma.approvalRequest.update({
      where: { approvalRequestId: requestId },
      data: {
        requiredApproverRoleIds: newRequired,
      },
    });
  }
}
