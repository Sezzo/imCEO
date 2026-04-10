/**
 * TaskGetTool - Gets details of a specific task
 *
 * Ported from Claude Code's TaskGetTool
 */

import { z } from 'zod';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TaskGetInput {
  id: string; // Task ID to retrieve
}

export interface TaskGetOutput {
  task: {
    id: string;
    subject: string;
    description?: string;
    activeForm?: string;
    status: string;
    ownerAgentId?: string;
    ownerAgentName?: string;
    blockedBy: string[];
    blocks: string[];
    blockedByDetails?: Array<{
      id: string;
      subject: string;
      status: string;
    }>;
    metadata?: Record<string, unknown>;
    createdAt: string;
    claimedAt?: string;
    completedAt?: string;
  } | null;
}

export interface ToolContext {
  prisma: any;
  session: {
    agentId: string;
    agentName: string;
    teamContext?: {
      teamId: string;
      teamName: string;
    };
  };
}

// ============================================================================
// Constants
// ============================================================================

export const TASK_GET_TOOL_NAME = 'TaskGet';

// ============================================================================
// Zod Schema
// ============================================================================

export const TaskGetInputSchema = z.object({
  id: z.string().describe('ID of the task to retrieve'),
});

// ============================================================================
// Tool Implementation
// ============================================================================

export class TaskGetTool {
  readonly name = TASK_GET_TOOL_NAME;
  readonly description = 'Get details of a specific task';

  /**
   * Execute the TaskGet tool
   */
  async execute(input: TaskGetInput, context: ToolContext): Promise<{ data: TaskGetOutput }> {
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

    // Fetch task
    const task = await prisma.agentTask.findFirst({
      where: {
        taskId: input.id,
        teamId: team.teamId,
      },
    });

    if (!task) {
      return {
        data: { task: null },
      };
    }

    // Get owner name if assigned
    let ownerAgentName: string | undefined;
    if (task.ownerAgentId) {
      const member = await prisma.agentTeamMember.findFirst({
        where: {
          agentId: task.ownerAgentId,
          teamId: team.teamId,
        },
      });
      ownerAgentName = member?.name;
    }

    // Get blockedBy task details
    let blockedByDetails: Array<{ id: string; subject: string; status: string }> | undefined;
    if (task.blockedBy?.length > 0) {
      const blockedTasks = await prisma.agentTask.findMany({
        where: {
          taskId: { in: task.blockedBy },
          teamId: team.teamId,
        },
        select: {
          taskId: true,
          subject: true,
          status: true,
        },
      });
      blockedByDetails = blockedTasks.map((t: any) => ({
        id: t.taskId,
        subject: t.subject,
        status: t.status,
      }));
    }

    return {
      data: {
        task: {
          id: task.taskId,
          subject: task.subject,
          description: task.description || undefined,
          activeForm: task.activeForm || undefined,
          status: task.status,
          ownerAgentId: task.ownerAgentId || undefined,
          ownerAgentName,
          blockedBy: task.blockedBy || [],
          blocks: task.blocks || [],
          blockedByDetails,
          metadata: task.metadata || undefined,
          createdAt: task.createdAt.toISOString(),
          claimedAt: task.claimedAt?.toISOString(),
          completedAt: task.completedAt?.toISOString(),
        },
      },
    };
  }

  /**
   * Get tool prompt/description for LLM
   */
  async getPrompt(): Promise<string> {
    return `
Get detailed information about a specific task by its ID.

## When to Use
Use this tool when:
- You need details about a task before claiming it
- Checking if a dependency task is complete
- Understanding task requirements and metadata
- Verifying task ownership

## Parameters
- id: The unique task identifier (required)

## Output Fields
- id, subject, description, status
- ownerAgentId/Name: Who is assigned
- blockedBy: IDs of tasks this depends on
- blockedByDetails: Full details of blocking tasks (if available)
- blocks: IDs of tasks waiting on this one
- metadata: Additional task data
- timestamps: created, claimed, completed

## Returns null if task not found

## Example Usage
1. Get task details:
   TaskGet({ id: "task-123-abc" })

2. Check if dependencies are complete:
   TaskGet({ id: "my-task" })
   → Check blockedByDetails[].status
`;
  }

  /**
   * Render tool use message for UI
   */
  renderToolUseMessage(input: TaskGetInput): string {
    return `Getting task ${input.id.substring(0, 8)}...`;
  }

  /**
   * Render tool result message for UI
   */
  renderToolResultMessage(output: TaskGetOutput): string {
    if (!output.task) {
      return 'Task not found';
    }
    return `Task: ${output.task.subject} (${output.task.status})`;
  }
}

// Export singleton instance
export const taskGetTool = new TaskGetTool();
