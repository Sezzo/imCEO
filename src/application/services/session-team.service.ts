import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import type { TeamSessionState, Prisma } from '@prisma/client';

const serviceLogger = logger.child({ component: 'TeamSessionService' });

export interface CreateTeamSessionDTO {
  teamId: string;
  initiatingWorkItemId?: string;
  sessionPurpose?: string;
}

export interface UpdateTeamSessionDTO {
  currentState?: TeamSessionState;
  currentCost?: number;
  currentContextUsage?: number;
}

export interface SessionLaunchConfig {
  agentIds: string[];
  workItemAssignments?: Record<string, string>; // agentId -> workItemId
}

export class TeamSessionService {
  async findAll() {
    serviceLogger.debug('Finding all team sessions');
    return prisma.teamSession.findMany({
      orderBy: { launchedAt: 'desc' },
      include: {
        agentSessions: true,
      },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ teamSessionId: id }, 'Finding team session by id');
    return prisma.teamSession.findUnique({
      where: { teamSessionId: id },
      include: {
        agentSessions: {
          include: {
            teamSession: true,
          },
        },
      },
    });
  }

  async findByTeamId(teamId: string) {
    serviceLogger.debug({ teamId }, 'Finding team sessions by team id');
    return prisma.teamSession.findMany({
      where: { teamId },
      orderBy: { launchedAt: 'desc' },
      include: {
        agentSessions: true,
      },
    });
  }

  async findActiveByTeamId(teamId: string) {
    serviceLogger.debug({ teamId }, 'Finding active team sessions');
    return prisma.teamSession.findMany({
      where: {
        teamId,
        currentState: {
          in: ['Queued', 'Launching', 'Active', 'Waiting', 'Idle'],
        },
      },
      include: {
        agentSessions: true,
      },
    });
  }

  async create(data: CreateTeamSessionDTO) {
    serviceLogger.info({ teamId: data.teamId }, 'Creating team session');
    return prisma.teamSession.create({
      data: {
        teamId: data.teamId,
        initiatingWorkItemId: data.initiatingWorkItemId,
        sessionPurpose: data.sessionPurpose,
        currentState: 'Queued',
        currentCost: 0,
        currentContextUsage: 0,
      },
    });
  }

  async launch(sessionId: string, config: SessionLaunchConfig) {
    serviceLogger.info({ teamSessionId: sessionId }, 'Launching team session');

    return prisma.$transaction(async (tx) => {
      // Update session state to Launching
      const session = await tx.teamSession.update({
        where: { teamSessionId: sessionId },
        data: {
          currentState: 'Launching',
          launchedAt: new Date(),
        },
      });

      // Create agent sessions for each agent
      const agentSessionPromises = config.agentIds.map(async (agentId) => {
        const workItemId = config.workItemAssignments?.[agentId];
        return tx.agentSession.create({
          data: {
            teamSessionId: sessionId,
            agentId,
            assignedWorkItemId: workItemId,
            state: 'Assigned',
            costAccumulated: 0,
            contextAccumulated: 0,
          },
        });
      });

      await Promise.all(agentSessionPromises);

      // Transition to Active
      const activeSession = await tx.teamSession.update({
        where: { teamSessionId: sessionId },
        data: {
          currentState: 'Active',
        },
        include: {
          agentSessions: true,
        },
      });

      serviceLogger.info(
        { teamSessionId: sessionId, agentCount: config.agentIds.length },
        'Team session launched successfully'
      );

      return activeSession;
    });
  }

  async updateState(
    sessionId: string,
    newState: TeamSessionState,
    reason?: string
  ) {
    serviceLogger.info(
      { teamSessionId: sessionId, newState, reason },
      'Updating team session state'
    );

    const updateData: Prisma.TeamSessionUpdateInput = {
      currentState: newState,
    };

    if (newState === 'Completed' || newState === 'Failed' || newState === 'Terminated') {
      updateData.endedAt = new Date();
    }

    return prisma.teamSession.update({
      where: { teamSessionId: sessionId },
      data: updateData,
      include: {
        agentSessions: true,
      },
    });
  }

  async updateCost(sessionId: string, additionalCost: number) {
    serviceLogger.debug(
      { teamSessionId: sessionId, additionalCost },
      'Updating team session cost'
    );

    return prisma.teamSession.update({
      where: { teamSessionId: sessionId },
      data: {
        currentCost: {
          increment: additionalCost,
        },
      },
    });
  }

  async updateContextUsage(sessionId: string, additionalTokens: number) {
    serviceLogger.debug(
      { teamSessionId: sessionId, additionalTokens },
      'Updating team session context usage'
    );

    return prisma.teamSession.update({
      where: { teamSessionId: sessionId },
      data: {
        currentContextUsage: {
          increment: additionalTokens,
        },
      },
    });
  }

  async terminate(sessionId: string, reason?: string) {
    serviceLogger.info(
      { teamSessionId: sessionId, reason },
      'Terminating team session'
    );

    return prisma.$transaction(async (tx) => {
      // Terminate all agent sessions
      await tx.agentSession.updateMany({
        where: {
          teamSessionId: sessionId,
          state: {
            in: ['Assigned', 'Running', 'Waiting', 'Idle', 'Blocked'],
          },
        },
        data: {
          state: 'Killed',
          endedAt: new Date(),
        },
      });

      // Terminate the team session
      return tx.teamSession.update({
        where: { teamSessionId: sessionId },
        data: {
          currentState: 'Terminated',
          endedAt: new Date(),
        },
        include: {
          agentSessions: true,
        },
      });
    });
  }

  async complete(sessionId: string) {
    serviceLogger.info({ teamSessionId: sessionId }, 'Completing team session');

    return prisma.$transaction(async (tx) => {
      // Complete all active agent sessions
      await tx.agentSession.updateMany({
        where: {
          teamSessionId: sessionId,
          state: {
            in: ['Assigned', 'Running', 'Waiting', 'Idle'],
          },
        },
        data: {
          state: 'Completed',
          endedAt: new Date(),
        },
      });

      return tx.teamSession.update({
        where: { teamSessionId: sessionId },
        data: {
          currentState: 'Completed',
          endedAt: new Date(),
        },
        include: {
          agentSessions: true,
        },
      });
    });
  }

  async delete(id: string) {
    serviceLogger.info({ teamSessionId: id }, 'Deleting team session');
    await prisma.teamSession.delete({
      where: { teamSessionId: id },
    });
  }

  // State transition validation
  private readonly validTransitions: Record<TeamSessionState, TeamSessionState[]> = {
    Queued: ['Launching', 'Failed', 'Terminated'],
    Launching: ['Active', 'Failed', 'Terminated'],
    Active: ['Waiting', 'Idle', 'Failed', 'Completed', 'Terminated'],
    Waiting: ['Active', 'Idle', 'Failed', 'Completed', 'Terminated'],
    Idle: ['Active', 'Waiting', 'Failed', 'Completed', 'Terminated'],
    Failed: ['Terminated'],
    Completed: ['Terminated'],
    Terminated: [],
  };

  isValidTransition(from: TeamSessionState, to: TeamSessionState): boolean {
    return this.validTransitions[from]?.includes(to) ?? false;
  }

  // Get session statistics
  async getSessionStats(sessionId: string) {
    serviceLogger.debug({ teamSessionId: sessionId }, 'Getting session stats');

    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const agentSessions = session.agentSessions || [];

    return {
      totalAgents: agentSessions.length,
      activeAgents: agentSessions.filter(
        (a) => a.state === 'Running' || a.state === 'Waiting'
      ).length,
      completedAgents: agentSessions.filter((a) => a.state === 'Completed').length,
      failedAgents: agentSessions.filter(
        (a) => a.state === 'Failed' || a.state === 'Killed'
      ).length,
      totalCost: session.currentCost,
      totalContextUsage: session.currentContextUsage,
      duration: session.endedAt
        ? session.endedAt.getTime() - (session.launchedAt?.getTime() ?? 0)
        : Date.now() - (session.launchedAt?.getTime() ?? 0),
    };
  }
}
