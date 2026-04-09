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

  async transition(id: string, toState: WorkItemState, reason?: string) {
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

    return prisma.workItem.update({
      where: { workItemId: id },
      data: {
        state: toState,
        ...(toState === 'InProgress' && { startedAt: new Date() }),
        ...(toState === 'Done' && { completedAt: new Date() }),
      },
    });
  }

  private isValidTransition(from: WorkItemState, to: WorkItemState): boolean {
    // Define valid state transitions
    const transitions: Record<WorkItemState, WorkItemState[]> = {
      Draft: ['Proposed', 'Cancelled'],
      Proposed: ['Approved', 'Rejected'],
      Approved: ['Planned', 'Rejected'],
      Planned: ['Ready', 'Cancelled'],
      Ready: ['InProgress', 'Cancelled'],
      InProgress: ['WaitingOnDependency', 'InReview', 'Blocked', 'Cancelled'],
      WaitingOnDependency: ['InProgress', 'Blocked'],
      InReview: ['ChangesRequested', 'AwaitingApproval', 'Blocked'],
      ChangesRequested: ['InProgress', 'InTest'],
      InTest: ['AwaitingApproval', 'ChangesRequested'],
      AwaitingApproval: ['ApprovedForCompletion', 'ChangesRequested', 'Rejected'],
      ApprovedForCompletion: ['Done'],
      Done: ['Archived', 'Reopened'],
      Archived: ['Reopened'],
      Reopened: ['InProgress'],
      Rejected: ['Reopened'],
      Cancelled: ['Reopened'],
      Blocked: ['InProgress'],
    };

    return transitions[from]?.includes(to) ?? false;
  }

  async getHistory(id: string) {
    serviceLogger.debug({ workItemId: id }, 'Getting work item history');
    // This would typically query an audit log or history table
    // For now, return a placeholder
    return [];
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
}
