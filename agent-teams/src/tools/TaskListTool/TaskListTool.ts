/**
 * TaskListTool - Lists all tasks in the shared task list
 *
 * Ported from Claude Code's TaskListTool
 * Supports filtering by status, owner, and dependencies
 */

import { z } from 'zod';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TaskListInput {
  status?: string; // Filter by status
  owner?: string; // Filter by owner agent ID
  includeBlocked?: boolean; // Include blocked tasks
  limit?: number; // Max number of tasks to return
}

export interface TaskListOutput {
  tasks: Array<{
    id: string;
    subject: string;
    description?: string;
    status: string;
    ownerAgentId?: string;
    ownerAgentName?: string;
    blockedBy: string[];
    blocks: string[];
    isBlocked: boolean;
    canClaim: boolean;
    createdAt: string;
    claimedAt?: string;
    completedAt?: string;
  }>;
  total: number;
  byStatus: Record<string, number>;
}

export interface ToolContext {
  prisma: any;
  session: {
    agentId: string;
    agentName: string;
    companyId: string;
    teamContext?: {
      teamId: string;
      teamName: string;
    };
  };
}

// ============================================================================
// Constants
// ============================================================================

export const TASK_LIST_TOOL_NAME = 'TaskList';

// ============================================================================
// Zod Schema
// ============================================================================

export const TaskListInputSchema = z.object({
  status: z
    .enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled'])
    .optional()
    .describe('Filter by task status'),
  owner: z.string().optional().describe('Filter by owner agent ID'),
  includeBlocked: z.boolean().optional().default(true).describe('Include blocked tasks in results'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe('Maximum number of tasks to return'),
});

// ============================================================================
// Tool Implementation
// ============================================================================

export class TaskListTool {
  readonly name = TASK_LIST_TOOL_NAME;
  readonly description = 'List all tasks in the shared task list';

  /**
   * Execute the TaskList tool
   */
  async execute(input: TaskListInput, context: ToolContext): Promise<{ data: TaskListOutput }> {
    const { prisma, session } = context;

    // Get current team from session context
    const teamName = session.teamContext?.teamName;
    if (!teamName) {
      throw new Error('No active team. Create a team with TeamCreate first.');
    }

    const team = await prisma.agentTeam.findUnique({
      where: { teamName },
    });

    if (!team) {
      throw new Error(`Team "${teamName}" not found`);
    }

    // Build where clause
    const where: any = {
      teamId: team.teamId,
    };

    if (input.status) {
      where.status = input.status;
    } else if (!input.includeBlocked) {
      where.status = { not: 'blocked' };
    }

    if (input.owner) {
      where.ownerAgentId = input.owner;
    }

    // Fetch tasks with owner info
    const tasks = await prisma.agentTask.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // pending first, then in_progress, etc.
        { createdAt: 'desc' },
      ],
      take: input.limit || 50,
      include: {
        owner: input.owner ? true : false, // Include owner details if filtering by owner
      },
    });

    // Get count by status
    const statusCounts = await prisma.agentTask.groupBy({
      by: ['status'],
      where: { teamId: team.teamId },
      _count: { status: true },
    });

    const byStatus: Record<string, number> = {};
    for (const sc of statusCounts) {
      byStatus[sc.status] = sc._count.status;
    }

    // Get all member names for lookup
    const members = await prisma.agentTeamMember.findMany({
      where: { teamId: team.teamId },
      select: { agentId: true, name: true },
    });

    const memberNames = new Map(members.map((m: any) => [m.agentId, m.name]));

    // Process tasks
    const processedTasks = tasks.map((task: any) => {
      const isBlocked =
        task.status === 'blocked' || (task.blockedBy?.length > 0 && task.status === 'pending');

      // Can claim if pending and not blocked
      const canClaim = task.status === 'pending' && !task.ownerAgentId && !isBlocked;

      return {
        id: task.taskId,
        subject: task.subject,
        description: task.description,
        status: task.status,
        ownerAgentId: task.ownerAgentId || undefined,
        ownerAgentName: task.ownerAgentId ? memberNames.get(task.ownerAgentId) : undefined,
        blockedBy: task.blockedBy || [],
        blocks: task.blocks || [],
        isBlocked,
        canClaim,
        createdAt: task.createdAt.toISOString(),
        claimedAt: task.claimedAt?.toISOString(),
        completedAt: task.completedAt?.toISOString(),
      };
    });

    return {
      data: {
        tasks: processedTasks,
        total: processedTasks.length,
        byStatus,
      },
    };
  }

  /**
   * Get tool prompt/description for LLM
   */
  async getPrompt(): Promise<string> {
    return `
List all tasks in the shared task list for the current team.

## When to Use
Use this tool when:
- Getting an overview of all work items
- Finding available tasks to claim
- Checking task dependencies and blockers
- Monitoring team progress
- Looking for tasks assigned to specific agents

## Parameters
- status: Filter by status (pending, in_progress, completed, blocked, cancelled)
- owner: Filter by owner agent ID
- includeBlocked: Include blocked tasks (default: true)
- limit: Max tasks to return (default: 50, max: 100)

## Output Fields
- id: Unique task identifier
- subject: Task title
- description: Detailed description
- status: Current status
- ownerAgentId/Name: Who is working on it
- blockedBy: Task IDs this depends on
- blocks: Task IDs waiting on this
- isBlocked: True if task can't start yet
- canClaim: True if available to work on
- timestamps: Created, claimed, completed dates

## Example Usage
1. List all pending tasks:
   TaskList({ status: "pending" })

2. Find tasks assigned to a teammate:
   TaskList({ owner: "researcher@my-team" })

3. Get unblocked available work:
   TaskList({ includeBlocked: false })

4. See everything:
   TaskList({ limit: 100 })
`;
  }

  /**
   * Render tool use message for UI
   */
  renderToolUseMessage(input: TaskListInput): string {
    const filters = [];
    if (input.status) filters.push(`status: ${input.status}`);
    if (input.owner) filters.push(`owner: ${input.owner}`);
    if (input.limit && input.limit !== 50) filters.push(`limit: ${input.limit}`);

    return `Listing tasks${filters.length > 0 ? ` (${filters.join(', ')})` : ''}`;
  }

  /**
   * Render tool result message for UI
   */
  renderToolResultMessage(output: TaskListOutput): string {
    const statusSummary = Object.entries(output.byStatus)
      .map(([status, count]) => `${status}: ${count}`)
      .join(', ');

    return `Found ${output.total} tasks (${statusSummary})`;
  }
}

// Export singleton instance
export const taskListTool = new TaskListTool();
