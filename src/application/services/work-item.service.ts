import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { WorkItemState, WorkItemType } from '@prisma/client';

const serviceLogger = logger.child({ component: 'WorkItemService' });

export interface CreateWorkItemDTO {
  type: WorkItemType;
  title: string;
  description?: string;
  parentWorkItemId?: string;
  companyId?: string;
  divisionId?: string;
  departmentId?: string;
  owningTeamId?: string;
  owningRoleId?: string;
  assignedAgentId?: string;
  priority?: string;
  severity?: string;
  costLimit?: number;
  estimatedEffort?: number;
  dueAt?: string;
}

export interface UpdateWorkItemDTO extends Partial<CreateWorkItemDTO> {}

export interface WorkItemFilters {
  state?: string;
  type?: string;
  teamId?: string;
}

export class WorkItemService {
  async findAll(filters?: WorkItemFilters) {
    serviceLogger.debug({ filters }, 'Finding all work items');
    return prisma.workItem.findMany({
      where: {
        ...(filters?.state && { state: filters.state as WorkItemState }),
        ...(filters?.type && { type: filters.type as WorkItemType }),
        ...(filters?.teamId && { owningTeamId: filters.teamId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ workItemId: id }, 'Finding work item by id');
    return prisma.workItem.findUnique({
      where: { workItemId: id },
      include: {
        childWorkItems: true,
        artifacts: true,
        agent: true,
        team: true,
      },
    });
  }

  async create(data: CreateWorkItemDTO) {
    serviceLogger.info({ title: data.title, type: data.type }, 'Creating work item');
    return prisma.workItem.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        parentWorkItemId: data.parentWorkItemId,
        companyId: data.companyId,
        divisionId: data.divisionId,
        departmentId: data.departmentId,
        owningTeamId: data.owningTeamId,
        owningRoleId: data.owningRoleId,
        assignedAgentId: data.assignedAgentId,
        priority: data.priority,
        severity: data.severity,
        costLimit: data.costLimit,
        estimatedEffort: data.estimatedEffort,
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      },
    });
  }

  async update(id: string, data: UpdateWorkItemDTO) {
    serviceLogger.info({ workItemId: id }, 'Updating work item');
    return prisma.workItem.update({
      where: { workItemId: id },
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        assignedAgentId: data.assignedAgentId,
        priority: data.priority,
        severity: data.severity,
        costLimit: data.costLimit,
        estimatedEffort: data.estimatedEffort,
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ workItemId: id }, 'Deleting work item');
    await prisma.workItem.delete({
      where: { workItemId: id },
    });
  }

  async transition(id: string, toState: WorkItemState, reason?: string, actorId?: string, actorType?: string) {
    serviceLogger.info({ workItemId: id, toState, reason }, 'Transitioning work item');

    const workItem = await prisma.workItem.findUnique({
      where: { workItemId: id },
    });

    if (!workItem) {
      return null;
    }

    // Validate state transition
    const validTransition = this.isValidTransition(workItem.state, toState);
    if (!validTransition) {
      throw new Error(`Invalid state transition from ${workItem.state} to ${toState}`);
    }

    // Perform transition and create history entry in a transaction
    const [updated] = await prisma.$transaction([
      prisma.workItem.update({
        where: { workItemId: id },
        data: {
          state: toState,
          ...(toState === 'InProgress' && { startedAt: new Date() }),
          ...(toState === 'Done' && { completedAt: new Date() }),
        },
      }),
      prisma.workItemHistory.create({
        data: {
          workItemId: id,
          fromState: workItem.state,
          toState,
          reason,
          actorId,
          actorType,
        },
      }),
    ]);

    return updated;
  }

  private isValidTransition(from: WorkItemState, to: WorkItemState): boolean {
    // Define valid state transitions
    const transitions: Record<WorkItemState, WorkItemState[]> = {
      Draft: ['Proposed', 'Cancelled'],
      Proposed: ['Approved', 'Rejected'],
      Approved: ['Planned', 'Rejected'],
      Planned: ['Ready', 'Cancelled'],
      Ready: ['InProgress', 'Cancelled'],
      InProgress: ['WaitingOnDependency', 'InReview', 'ChangesRequested', 'Cancelled'],
      WaitingOnDependency: ['InProgress', 'ChangesRequested'],
      InReview: ['ChangesRequested', 'AwaitingApproval'],
      ChangesRequested: ['InProgress', 'InTest'],
      InTest: ['AwaitingApproval', 'ChangesRequested'],
      AwaitingApproval: ['ApprovedForCompletion', 'ChangesRequested', 'Rejected'],
      ApprovedForCompletion: ['Done'],
      Done: ['Archived', 'Reopened'],
      Archived: ['Reopened'],
      Reopened: ['InProgress'],
      Rejected: ['Reopened'],
      Cancelled: ['Reopened'],
    };

    return transitions[from]?.includes(to) ?? false;
  }

  async getHistory(id: string) {
    serviceLogger.debug({ workItemId: id }, 'Getting work item history');
    return prisma.workItemHistory.findMany({
      where: { workItemId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBoard() {
    serviceLogger.debug('Getting work item board');
    const items = await prisma.workItem.findMany({
      orderBy: { priority: 'desc', createdAt: 'desc' },
    });

    // Group by state for Kanban board
    const columns: Record<string, typeof items> = {
      Draft: [],
      Proposed: [],
      Approved: [],
      Planned: [],
      Ready: [],
      InProgress: [],
      InReview: [],
      ChangesRequested: [],
      InTest: [],
      AwaitingApproval: [],
      ApprovedForCompletion: [],
      Done: [],
    };

    items.forEach((item) => {
      if (columns[item.state]) {
        columns[item.state].push(item);
      }
    });

    return columns;
  }

  // ============================================================================
  // Advanced Hierarchy Management
  // ============================================================================

  async getHierarchyTree(id: string): Promise<any> {
    serviceLogger.debug({ workItemId: id }, 'Getting hierarchy tree');

    const root = await prisma.workItem.findUnique({
      where: { workItemId: id },
      include: {
        childWorkItems: {
          include: {
            childWorkItems: {
              include: {
                childWorkItems: true,
              },
            },
          },
        },
        agent: true,
        team: true,
      },
    });

    if (!root) {
      return null;
    }

    // Build tree structure recursively
    const buildNode = (item: any): any => ({
      id: item.workItemId,
      type: item.type,
      title: item.title,
      state: item.state,
      priority: item.priority,
      assignedAgent: item.agent
        ? { id: item.agent.agentId, name: item.agent.displayName }
        : null,
      owningTeam: item.team ? { id: item.team.teamId, name: item.team.name } : null,
      children: item.childWorkItems?.map(buildNode) || [],
    });

    return buildNode(root);
  }

  async getAncestors(id: string): Promise<any[]> {
    serviceLogger.debug({ workItemId: id }, 'Getting ancestors');

    const ancestors: any[] = [];
    let currentId: string | null = id;

    // Prevent infinite loops
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);

      const item = await prisma.workItem.findUnique({
        where: { workItemId: currentId },
        include: {
          parentWorkItem: {
            include: {
              agent: true,
              team: true,
            },
          },
        },
      });

      if (!item || !item.parentWorkItem) {
        break;
      }

      ancestors.unshift({
        id: item.parentWorkItem.workItemId,
        type: item.parentWorkItem.type,
        title: item.parentWorkItem.title,
        state: item.parentWorkItem.state,
        assignedAgent: item.parentWorkItem.agent
          ? { id: item.parentWorkItem.agent.agentId, name: item.parentWorkItem.agent.displayName }
          : null,
        owningTeam: item.parentWorkItem.team
          ? { id: item.parentWorkItem.team.teamId, name: item.parentWorkItem.team.name }
          : null,
      });

      currentId = item.parentWorkItem.workItemId;
    }

    return ancestors;
  }

  async getDescendants(id: string): Promise<any[]> {
    serviceLogger.debug({ workItemId: id }, 'Getting descendants');

    const descendants: any[] = [];
    const toProcess = [id];
    const visited = new Set<string>();

    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!;

      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const item = await prisma.workItem.findUnique({
        where: { workItemId: currentId },
        include: {
          childWorkItems: {
            include: {
              agent: true,
              team: true,
            },
          },
        },
      });

      if (!item) {
        continue;
      }

      for (const child of item.childWorkItems) {
        descendants.push({
          id: child.workItemId,
          type: child.type,
          title: child.title,
          state: child.state,
          priority: child.priority,
          assignedAgent: child.agent
            ? { id: child.agent.agentId, name: child.agent.displayName }
            : null,
          owningTeam: child.team ? { id: child.team.teamId, name: child.team.name } : null,
          parentId: currentId,
        });

        toProcess.push(child.workItemId);
      }
    }

    return descendants;
  }

  async getSiblings(id: string): Promise<any[]> {
    serviceLogger.debug({ workItemId: id }, 'Getting siblings');

    const item = await prisma.workItem.findUnique({
      where: { workItemId: id },
      select: { parentWorkItemId: true },
    });

    if (!item || !item.parentWorkItemId) {
      return [];
    }

    const siblings = await prisma.workItem.findMany({
      where: {
        parentWorkItemId: item.parentWorkItemId,
        workItemId: { not: id },
      },
      include: {
        agent: true,
        team: true,
      },
    });

    return siblings.map((s) => ({
      id: s.workItemId,
      type: s.type,
      title: s.title,
      state: s.state,
      priority: s.priority,
      assignedAgent: s.agent ? { id: s.agent.agentId, name: s.agent.displayName } : null,
      owningTeam: s.team ? { id: s.team.teamId, name: s.team.name } : null,
    }));
  }

  async moveInHierarchy(id: string, newParentId: string | null): Promise<void> {
    serviceLogger.info({ workItemId: id, newParentId }, 'Moving work item in hierarchy');

    // Prevent moving under self or descendants
    if (newParentId) {
      if (newParentId === id) {
        throw new Error('Cannot move work item under itself');
      }

      const descendants = await this.getDescendants(id);
      if (descendants.some((d) => d.id === newParentId)) {
        throw new Error('Cannot move work item under its own descendant');
      }

      // Validate new parent exists
      const newParent = await prisma.workItem.findUnique({
        where: { workItemId: newParentId },
      });

      if (!newParent) {
        throw new Error('New parent work item not found');
      }
    }

    await prisma.workItem.update({
      where: { workItemId: id },
      data: { parentWorkItemId: newParentId },
    });
  }

  async getImpactAnalysis(id: string): Promise<any> {
    serviceLogger.debug({ workItemId: id }, 'Getting impact analysis');

    const item = await prisma.workItem.findUnique({
      where: { workItemId: id },
      include: {
        childWorkItems: {
          select: { workItemId: true, title: true, type: true, state: true },
        },
        artifacts: {
          select: { artifactId: true, title: true, type: true, status: true },
        },
      },
    });

    if (!item) {
      throw new Error('Work item not found');
    }

    // Get all descendants
    const allDescendants = await this.getDescendants(id);

    // Count by state
    const stateCounts: Record<string, number> = {};
    [item, ...allDescendants].forEach((i) => {
      stateCounts[i.state] = (stateCounts[i.state] || 0) + 1;
    });

    // Calculate estimated effort
    const totalEstimatedEffort = [item, ...allDescendants].reduce(
      (sum, i) => sum + (i.estimatedEffort || 0),
      0
    );

    return {
      workItem: {
        id: item.workItemId,
        type: item.type,
        title: item.title,
        state: item.state,
      },
      directChildren: item.childWorkItems.length,
      totalDescendants: allDescendants.length,
      stateBreakdown: stateCounts,
      artifacts: item.artifacts,
      totalEstimatedEffort,
      canBeDeleted: item.childWorkItems.length === 0,
      blockingItems: allDescendants.filter((d) =>
        ['Blocked', 'WaitingOnDependency'].includes(d.state)
      ),
    };
  }

  async rollupProgress(id: string): Promise<any> {
    serviceLogger.debug({ workItemId: id }, 'Rolling up progress');

    const item = await prisma.workItem.findUnique({
      where: { workItemId: id },
      include: {
        childWorkItems: true,
      },
    });

    if (!item) {
      throw new Error('Work item not found');
    }

    // Get all descendants for full rollup
    const descendants = await this.getDescendants(id);
    const allItems = [item, ...descendants];

    // Calculate completion percentage
    const doneStates = ['Done', 'Archived'];
    const completedItems = allItems.filter((i) => doneStates.includes(i.state)).length;
    const completionPercentage = allItems.length > 0
      ? (completedItems / allItems.length) * 100
      : 0;

    // Calculate effort-based progress
    const totalEffort = allItems.reduce((sum, i) => sum + (i.estimatedEffort || 0), 0);
    const completedEffort = allItems
      .filter((i) => doneStates.includes(i.state))
      .reduce((sum, i) => sum + (i.estimatedEffort || 0), 0);
    const effortPercentage = totalEffort > 0 ? (completedEffort / totalEffort) * 100 : 0;

    // Count by type
    const byType: Record<string, { total: number; completed: number }> = {};
    allItems.forEach((i) => {
      if (!byType[i.type]) {
        byType[i.type] = { total: 0, completed: 0 };
      }
      byType[i.type].total++;
      if (doneStates.includes(i.state)) {
        byType[i.type].completed++;
      }
    });

    return {
      workItemId: id,
      totalItems: allItems.length,
      completedItems,
      completionPercentage: Math.round(completionPercentage),
      totalEstimatedEffort: totalEffort,
      completedEstimatedEffort: completedEffort,
      effortPercentage: Math.round(effortPercentage),
      byType,
      childrenStatus: item.childWorkItems.map((child) => ({
        id: child.workItemId,
        title: child.title,
        state: child.state,
        estimatedEffort: child.estimatedEffort,
        actualEffort: child.actualEffort,
      })),
    };
  }

  async findOrphans(companyId: string): Promise<any[]> {
    serviceLogger.debug({ companyId }, 'Finding orphaned work items');

    const orphans = await prisma.workItem.findMany({
      where: {
        companyId,
        parentWorkItemId: null,
        type: { notIn: ['Vision', 'Goal'] }, // These are expected to have no parent
      },
      include: {
        agent: true,
        team: true,
      },
    });

    return orphans.map((o) => ({
      id: o.workItemId,
      type: o.type,
      title: o.title,
      state: o.state,
      createdAt: o.createdAt,
      assignedAgent: o.agent ? { id: o.agent.agentId, name: o.agent.displayName } : null,
      owningTeam: o.team ? { id: o.team.teamId, name: o.team.name } : null,
    }));
  }

  async getHierarchyPath(id: string): Promise<string[]> {
    serviceLogger.debug({ workItemId: id }, 'Getting hierarchy path');

    const path: string[] = [];
    let currentId: string | null = id;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      path.unshift(currentId);

      const item = await prisma.workItem.findUnique({
        where: { workItemId: currentId },
        select: { parentWorkItemId: true },
      });

      if (!item) {
        break;
      }

      currentId = item.parentWorkItemId;
    }

    return path;
  }

  async bulkUpdateParent(childIds: string[], newParentId: string | null): Promise<number> {
    serviceLogger.info({ childCount: childIds.length, newParentId }, 'Bulk updating parents');

    if (newParentId) {
      // Validate new parent exists
      const newParent = await prisma.workItem.findUnique({
        where: { workItemId: newParentId },
      });

      if (!newParent) {
        throw new Error('New parent work item not found');
      }

      // Check for circular dependencies
      const descendants = await this.getDescendants(newParentId);
      const descendantIds = new Set(descendants.map((d) => d.id));

      for (const childId of childIds) {
        if (descendantIds.has(childId)) {
          throw new Error(`Cannot move ${childId} under its own descendant`);
        }
        if (childId === newParentId) {
          throw new Error('Cannot move work item under itself');
        }
      }
    }

    const result = await prisma.workItem.updateMany({
      where: {
        workItemId: { in: childIds },
      },
      data: {
        parentWorkItemId: newParentId,
      },
    });

    return result.count;
  }
}
