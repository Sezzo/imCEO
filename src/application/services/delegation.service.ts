import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { DelegationType, DelegationState } from '@prisma/client';

const serviceLogger = logger.child({ component: 'DelegationService' });

export interface CreateDelegationDTO {
  sourceWorkItemId: string;
  sourceAgentId?: string;
  sourceRoleId?: string;
  targetTeamId: string;
  targetRoleId?: string;
  targetAgentId?: string;
  delegationType: DelegationType;
  objective?: string;
  scope?: string;
  constraints?: Record<string, any>;
  costLimit?: number;
}

export interface UpdateDelegationDTO {
  objective?: string;
  scope?: string;
  constraints?: Record<string, any>;
  costLimit?: number;
}

export interface DelegationFilters {
  sourceWorkItemId?: string;
  sourceAgentId?: string;
  targetTeamId?: string;
  targetAgentId?: string;
  delegationType?: DelegationType;
  state?: DelegationState;
}

export interface DelegationRecommendation {
  targetTeamId: string;
  targetRoleId?: string;
  targetAgentId?: string;
  score: number;
  reasons: string[];
}

export interface CostTrackingUpdate {
  costIncurred: number;
  contextUsed?: number;
}

export class DelegationService {
  async findAll(filters?: DelegationFilters) {
    serviceLogger.debug({ filters }, 'Finding all delegations');

    return prisma.delegation.findMany({
      where: {
        ...(filters?.sourceWorkItemId && { sourceWorkItemId: filters.sourceWorkItemId }),
        ...(filters?.sourceAgentId && { sourceAgentId: filters.sourceAgentId }),
        ...(filters?.targetTeamId && { targetTeamId: filters.targetTeamId }),
        ...(filters?.targetAgentId && { targetAgentId: filters.targetAgentId }),
        ...(filters?.delegationType && { delegationType: filters.delegationType }),
        ...(filters?.state && { state: filters.state }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ delegationId: id }, 'Finding delegation by id');
    return prisma.delegation.findUnique({
      where: { delegationId: id },
    });
  }

  async create(data: CreateDelegationDTO) {
    serviceLogger.info({
      sourceWorkItemId: data.sourceWorkItemId,
      delegationType: data.delegationType,
      targetTeamId: data.targetTeamId,
    }, 'Creating delegation');

    // Validate source work item exists
    const workItem = await prisma.workItem.findUnique({
      where: { workItemId: data.sourceWorkItemId },
    });

    if (!workItem) {
      throw new Error('Source work item not found');
    }

    // Validate target team exists
    const team = await prisma.team.findUnique({
      where: { teamId: data.targetTeamId },
    });

    if (!team) {
      throw new Error('Target team not found');
    }

    return prisma.delegation.create({
      data: {
        sourceWorkItemId: data.sourceWorkItemId,
        sourceAgentId: data.sourceAgentId,
        sourceRoleId: data.sourceRoleId,
        targetTeamId: data.targetTeamId,
        targetRoleId: data.targetRoleId,
        targetAgentId: data.targetAgentId,
        delegationType: data.delegationType,
        objective: data.objective,
        scope: data.scope,
        constraints: data.constraints ?? {},
        costLimit: data.costLimit,
        state: 'pending',
      },
    });
  }

  async update(id: string, data: UpdateDelegationDTO) {
    serviceLogger.info({ delegationId: id }, 'Updating delegation');

    const delegation = await prisma.delegation.findUnique({
      where: { delegationId: id },
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.state === 'completed' || delegation.state === 'failed' || delegation.state === 'cancelled') {
      throw new Error('Cannot update completed/failed/cancelled delegation');
    }

    return prisma.delegation.update({
      where: { delegationId: id },
      data: {
        objective: data.objective,
        scope: data.scope,
        constraints: data.constraints,
        costLimit: data.costLimit,
      },
    });
  }

  async accept(id: string, agentId?: string): Promise<void> {
    serviceLogger.info({ delegationId: id, agentId }, 'Accepting delegation');

    const delegation = await prisma.delegation.findUnique({
      where: { delegationId: id },
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.state !== 'pending') {
      throw new Error('Delegation is not in pending state');
    }

    await prisma.delegation.update({
      where: { delegationId: id },
      data: {
        state: 'accepted',
        acceptedAt: new Date(),
        targetAgentId: agentId || delegation.targetAgentId,
      },
    });
  }

  async reject(id: string, reason?: string): Promise<void> {
    serviceLogger.info({ delegationId: id, reason }, 'Rejecting delegation');

    const delegation = await prisma.delegation.findUnique({
      where: { delegationId: id },
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.state !== 'pending') {
      throw new Error('Delegation is not in pending state');
    }

    await prisma.delegation.update({
      where: { delegationId: id },
      data: {
        state: 'failed',
        failedAt: new Date(),
      },
    });
  }

  async start(id: string): Promise<void> {
    serviceLogger.info({ delegationId: id }, 'Starting delegation');

    const delegation = await prisma.delegation.findUnique({
      where: { delegationId: id },
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.state !== 'accepted') {
      throw new Error('Delegation must be accepted before starting');
    }

    await prisma.delegation.update({
      where: { delegationId: id },
      data: {
        state: 'in_progress',
      },
    });
  }

  async complete(id: string, result?: Record<string, any>): Promise<void> {
    serviceLogger.info({ delegationId: id }, 'Completing delegation');

    const delegation = await prisma.delegation.findUnique({
      where: { delegationId: id },
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.state !== 'in_progress' && delegation.state !== 'accepted') {
      throw new Error('Delegation must be in progress to complete');
    }

    await prisma.delegation.update({
      where: { delegationId: id },
      data: {
        state: 'completed',
        completedAt: new Date(),
        constraints: {
          ...delegation.constraints as Record<string, any>,
          result,
        },
      },
    });
  }

  async fail(id: string, reason: string): Promise<void> {
    serviceLogger.info({ delegationId: id, reason }, 'Failing delegation');

    const delegation = await prisma.delegation.findUnique({
      where: { delegationId: id },
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.state === 'completed' || delegation.state === 'cancelled') {
      throw new Error('Cannot fail completed or cancelled delegation');
    }

    await prisma.delegation.update({
      where: { delegationId: id },
      data: {
        state: 'failed',
        failedAt: new Date(),
        constraints: {
          ...delegation.constraints as Record<string, any>,
          failureReason: reason,
        },
      },
    });
  }

  async cancel(id: string, reason?: string): Promise<void> {
    serviceLogger.info({ delegationId: id, reason }, 'Cancelling delegation');

    const delegation = await prisma.delegation.findUnique({
      where: { delegationId: id },
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.state === 'completed' || delegation.state === 'failed') {
      throw new Error('Cannot cancel completed or failed delegation');
    }

    await prisma.delegation.update({
      where: { delegationId: id },
      data: {
        state: 'cancelled',
        constraints: {
          ...delegation.constraints as Record<string, any>,
          cancellationReason: reason,
        },
      },
    });
  }

  async updateCostTracking(id: string, data: CostTrackingUpdate): Promise<void> {
    serviceLogger.debug({ delegationId: id, data }, 'Updating cost tracking');

    const delegation = await prisma.delegation.findUnique({
      where: { delegationId: id },
    });

    if (!delegation) {
      throw new Error('Delegation not found');
    }

    const currentConstraints = delegation.constraints as Record<string, any> || {};

    await prisma.delegation.update({
      where: { delegationId: id },
      data: {
        constraints: {
          ...currentConstraints,
          totalCost: (currentConstraints.totalCost || 0) + data.costIncurred,
          totalContextUsed: (currentConstraints.totalContextUsed || 0) + (data.contextUsed || 0),
        },
      },
    });
  }

  async getRecommendations(
    workItemId: string,
    delegationType: DelegationType,
    limit: number = 5
  ): Promise<DelegationRecommendation[]> {
    serviceLogger.debug({ workItemId, delegationType }, 'Getting delegation recommendations');

    // Get work item details
    const workItem = await prisma.workItem.findUnique({
      where: { workItemId },
      include: {
        team: true,
      },
    });

    if (!workItem) {
      throw new Error('Work item not found');
    }

    // Get all teams in the same department
    const teams = await prisma.team.findMany({
      where: {
        departmentId: workItem.departmentId || undefined,
      },
      include: {
        agentProfiles: {
          where: {
            status: 'active',
          },
        },
      },
    });

    const recommendations: DelegationRecommendation[] = [];

    for (const team of teams) {
      if (team.teamId === workItem.owningTeamId) {
        continue; // Skip current team
      }

      let score = 0;
      const reasons: string[] = [];

      // Score based on team mission match
      if (team.mission && workItem.description) {
        const missionWords = team.mission.toLowerCase().split(' ');
        const workWords = workItem.description.toLowerCase().split(' ');
        const matchCount = missionWords.filter((w) => workWords.includes(w)).length;
        if (matchCount > 0) {
          score += matchCount * 5;
          reasons.push(`Mission alignment: ${matchCount} matching keywords`);
        }
      }

      // Score based on team type match
      if (team.teamType === delegationType) {
        score += 20;
        reasons.push(`Team type matches delegation type: ${delegationType}`);
      }

      // Score based on available capacity
      const availableAgents = team.agentProfiles.filter((a) => a.status === 'active').length;
      if (availableAgents > 0) {
        score += Math.min(availableAgents * 5, 15);
        reasons.push(`${availableAgents} available agents`);
      }

      // Score based on past delegation success (if any)
      const pastDelegations = await prisma.delegation.count({
        where: {
          targetTeamId: team.teamId,
          state: 'completed',
        },
      });

      if (pastDelegations > 0) {
        score += Math.min(pastDelegations * 2, 10);
        reasons.push(`${pastDelegations} successful past delegations`);
      }

      if (score > 0) {
        recommendations.push({
          targetTeamId: team.teamId,
          targetRoleId: undefined,
          targetAgentId: team.agentProfiles[0]?.agentId, // Suggest first available agent
          score,
          reasons,
        });
      }
    }

    // Sort by score and return top recommendations
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getDelegationChain(workItemId: string): Promise<any[]> {
    serviceLogger.debug({ workItemId }, 'Getting delegation chain');

    const delegations = await prisma.delegation.findMany({
      where: {
        sourceWorkItemId: workItemId,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build a chain/tree structure
    const chain: any[] = [];

    for (const delegation of delegations) {
      chain.push({
        id: delegation.delegationId,
        type: delegation.delegationType,
        state: delegation.state,
        source: {
          agentId: delegation.sourceAgentId,
          roleId: delegation.sourceRoleId,
        },
        target: {
          teamId: delegation.targetTeamId,
          agentId: delegation.targetAgentId,
          roleId: delegation.targetRoleId,
        },
        createdAt: delegation.createdAt,
        acceptedAt: delegation.acceptedAt,
        completedAt: delegation.completedAt,
        failedAt: delegation.failedAt,
      });
    }

    return chain;
  }

  async getActiveDelegationsForAgent(agentId: string) {
    serviceLogger.debug({ agentId }, 'Getting active delegations for agent');

    return prisma.delegation.findMany({
      where: {
        targetAgentId: agentId,
        state: { in: ['pending', 'accepted', 'in_progress'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveDelegationsForTeam(teamId: string) {
    serviceLogger.debug({ teamId }, 'Getting active delegations for team');

    return prisma.delegation.findMany({
      where: {
        targetTeamId: teamId,
        state: { in: ['pending', 'accepted', 'in_progress'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDelegationMetrics(
    teamId?: string,
    agentId?: string,
    dateRange?: { from?: Date; to?: Date }
  ): Promise<{
    total: number;
    byState: Record<string, number>;
    byType: Record<string, number>;
    avgCompletionTime: number | null;
    successRate: number;
  }> {
    serviceLogger.debug({ teamId, agentId }, 'Getting delegation metrics');

    const whereClause: any = {
      ...(teamId && { targetTeamId: teamId }),
      ...(agentId && { targetAgentId: agentId }),
      ...(dateRange?.from || dateRange?.to
        ? {
            createdAt: {
              ...(dateRange.from && { gte: dateRange.from }),
              ...(dateRange.to && { lte: dateRange.to }),
            },
          }
        : {}),
    };

    const [allDelegations, completedDelegations] = await Promise.all([
      prisma.delegation.findMany({
        where: whereClause,
        select: {
          state: true,
          delegationType: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.delegation.findMany({
        where: {
          ...whereClause,
          state: 'completed',
        },
        select: {
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);

    // Count by state
    const byState: Record<string, number> = {};
    allDelegations.forEach((d) => {
      byState[d.state] = (byState[d.state] || 0) + 1;
    });

    // Count by type
    const byType: Record<string, number> = {};
    allDelegations.forEach((d) => {
      byType[d.delegationType] = (byType[d.delegationType] || 0) + 1;
    });

    // Calculate average completion time
    let avgCompletionTime: number | null = null;
    if (completedDelegations.length > 0) {
      const totalTime = completedDelegations.reduce((sum, d) => {
        if (d.completedAt) {
          return sum + (d.completedAt.getTime() - d.createdAt.getTime());
        }
        return sum;
      }, 0);
      avgCompletionTime = totalTime / completedDelegations.length / 1000; // in seconds
    }

    // Calculate success rate
    const successCount = completedDelegations.length;
    const failureCount = byState['failed'] || 0;
    const totalCompleted = successCount + failureCount;
    const successRate = totalCompleted > 0 ? (successCount / totalCompleted) * 100 : 0;

    return {
      total: allDelegations.length,
      byState,
      byType,
      avgCompletionTime,
      successRate,
    };
  }
}
