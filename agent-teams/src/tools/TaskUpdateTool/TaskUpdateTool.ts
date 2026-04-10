/**
 * TaskUpdateTool - Updates task status and ownership
 *
 * Ported from Claude Code's TaskUpdateTool
 * Supports claiming, completing, and updating tasks
 */

import { z } from 'zod';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TaskUpdateInput {
  id: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  owner?: string; // Set to null to unassign, or agent ID to assign
  metadata?: Record<string, unknown>; // Merge with existing metadata
}

export interface TaskUpdateOutput {
  task: {
    id: string;
    subject: string;
    status: string;
    ownerAgentId?: string;
    previousStatus?: string;
    previousOwner?: string;
    unblockedTasks?: string[]; // Tasks that became unblocked
  };
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
  webSocket: {
    publishToTeam: (teamName: string, type: string, payload: any) => Promise<void>;
  };
  executeHooks?: (params: {
    hookType: 'task_completed';
    taskId: string;
    subject: string;
    description: string;
    agentName: string;
    teamName: string;
    metadata?: Record<string, unknown>;
  }) => Promise<Array<{ blockingError?: string; success: boolean }>>;
}

// ============================================================================
// Constants
// ============================================================================

export const TASK_UPDATE_TOOL_NAME = 'TaskUpdate';

// ============================================================================
// Zod Schema
// ============================================================================

export const TaskUpdateInputSchema = z.object({
  id: z.string().describe('ID of the task to update'),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled'])
    .optional()
    .describe('New status for the task'),
  owner: z
    .string()
    .nullable()
    .optional()
    .describe('Set owner agent ID (null to unassign, string to assign)'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Metadata to merge with existing task metadata'),
});

// ============================================================================
// Tool Implementation
// ============================================================================

export class TaskUpdateTool {
  readonly name = TASK_UPDATE_TOOL_NAME;
  readonly description = 'Update task status and ownership';
  readonly shouldDefer = true;

  /**
   * Execute the TaskUpdate tool
   */
  async execute(input: TaskUpdateInput, context: ToolContext): Promise<{ data: TaskUpdateOutput }> {
    const { prisma, session, webSocket, executeHooks } = context;

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

    // Fetch existing task
    const existingTask = await prisma.agentTask.findFirst({
      where: {
        taskId: input.id,
        teamId: team.teamId,
      },
    });

    if (!existingTask) {
      throw new Error(`Task "${input.id}" not found`);
    }

    const previousStatus = existingTask.status;
    const previousOwner = existingTask.ownerAgentId;

    // Build update data
    const updateData: any = {};

    // Handle status update
    if (input.status) {
      updateData.status = input.status;

      // Set timestamps based on status transition
      if (input.status === 'in_progress' && previousStatus !== 'in_progress') {
        updateData.claimedAt = new Date();
      }

      if (input.status === 'completed' && previousStatus !== 'completed') {
        updateData.completedAt = new Date();
      }
    }

    // Handle owner update
    if (input.owner !== undefined) {
      updateData.ownerAgentId = input.owner;

      // If assigning to someone, automatically transition to in_progress
      if (input.owner && previousStatus === 'pending') {
        updateData.status = 'in_progress';
        updateData.claimedAt = new Date();
      }

      // If unassigning and was in_progress, transition back to pending
      if (input.owner === null && previousStatus === 'in_progress') {
        updateData.status = 'pending';
      }
    }

    // Handle metadata merge
    if (input.metadata) {
      updateData.metadata = {
        ...(existingTask.metadata || {}),
        ...input.metadata,
      };
    }

    // Execute TaskCompleted hooks if completing
    let blockingErrors: string[] = [];
    if (input.status === 'completed' && previousStatus !== 'completed' && executeHooks) {
      const hookResults = await executeHooks({
        hookType: 'task_completed',
        taskId: existingTask.taskId,
        subject: existingTask.subject,
        description: existingTask.description || '',
        agentName: session.agentName,
        teamName,
        metadata: existingTask.metadata,
      });

      for (const result of hookResults) {
        if (result.blockingError) {
          blockingErrors.push(result.blockingError);
        }
      }

      // If hooks block completion, prevent the update
      if (blockingErrors.length > 0) {
        throw new Error(`Task completion blocked by hooks:\n${blockingErrors.join('\n')}`);
      }
    }

    // Update task
    const updatedTask = await prisma.agentTask.update({
      where: { taskId: input.id },
      data: updateData,
    });

    // Check for unblocked tasks (tasks that were waiting on this one)
    const unblockedTasks: string[] = [];
    if (input.status === 'completed' && existingTask.blocks?.length > 0) {
      for (const blockedTaskId of existingTask.blocks) {
        const blockedTask = await prisma.agentTask.findUnique({
          where: { taskId: blockedTaskId },
        });

        if (blockedTask && blockedTask.status === 'blocked') {
          // Check if all dependencies are now complete
          const dependencies = await prisma.agentTask.findMany({
            where: {
              taskId: { in: blockedTask.blockedBy },
            },
          });

          const allDepsCompleted = dependencies.every((t: any) => t.status === 'completed');

          if (allDepsCompleted) {
            await prisma.agentTask.update({
              where: { taskId: blockedTaskId },
              data: { status: 'pending' },
            });
            unblockedTasks.push(blockedTaskId);

            // Publish unblocked event
            await webSocket.publishToTeam(teamName, 'task:unblocked', {
              taskId: blockedTaskId,
              teamName,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Publish appropriate events
    const newStatus = updatedTask.status;

    if (newStatus === 'in_progress' && previousStatus !== 'in_progress') {
      await webSocket.publishToTeam(teamName, 'task:claimed', {
        taskId: updatedTask.taskId,
        teamName,
        agentId: updatedTask.ownerAgentId,
        agentName: session.agentName,
        timestamp: new Date().toISOString(),
      });
    }

    if (newStatus === 'completed' && previousStatus !== 'completed') {
      await webSocket.publishToTeam(teamName, 'task:completed', {
        taskId: updatedTask.taskId,
        teamName,
        agentId: updatedTask.ownerAgentId,
        timestamp: new Date().toISOString(),
      });
    }

    if (newStatus === 'blocked' && previousStatus !== 'blocked') {
      await webSocket.publishToTeam(teamName, 'task:blocked', {
        taskId: updatedTask.taskId,
        teamName,
        blockedBy: updatedTask.blockedBy,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      data: {
        task: {
          id: updatedTask.taskId,
          subject: updatedTask.subject,
          status: updatedTask.status,
          ownerAgentId: updatedTask.ownerAgentId || undefined,
          previousStatus,
          previousOwner: previousOwner || undefined,
          unblockedTasks: unblockedTasks.length > 0 ? unblockedTasks : undefined,
        },
      },
    };
  }

  /**
   * Get tool prompt/description for LLM
   */
  async getPrompt(): Promise<string> {
    return `
Update task status, ownership, or metadata in the shared task list.

## When to Use
Use this tool when:
- Claiming a task to work on it
- Marking a task as completed
- Unassigning from a task (e.g., when stuck)
- Cancelling a task
- Updating task metadata

## Parameters
- id: Task ID to update (required)
- status: New status (pending, in_progress, completed, blocked, cancelled)
- owner: Set owner agent ID (string to assign, null to unassign)
- metadata: Object to merge with existing metadata

## Smart Transitions
- Setting owner automatically sets status to "in_progress"
- Unassigning (owner: null) from "in_progress" reverts to "pending"
- Completing a task automatically unblocks dependent tasks

## Automatic Unblocking
When you mark a task as completed:
1. System checks tasks that depend on this one
2. If ALL dependencies of a blocked task are now complete
3. That task automatically transitions from "blocked" → "pending"
4. Event is published to notify the team

## Example Usage
1. Claim a task:
   TaskUpdate({ id: "task-123", owner: "researcher@my-team" })

2. Complete a task:
   TaskUpdate({ id: "task-123", status: "completed" })

3. Unassign (stuck, need help):
   TaskUpdate({ id: "task-123", owner: null })

4. Cancel:
   TaskUpdate({ id: "task-123", status: "cancelled" })

5. Add metadata:
   TaskUpdate({ id: "task-123", metadata: { priority: "high" } })
`;
  }

  /**
   * Render tool use message for UI
   */
  renderToolUseMessage(input: TaskUpdateInput): string {
    const changes = [];
    if (input.status) changes.push(`status → ${input.status}`);
    if (input.owner !== undefined) changes.push(`owner → ${input.owner || 'unassigned'}`);
    if (input.metadata) changes.push('metadata updated');

    return `Updating task ${input.id.substring(0, 8)}${changes.length > 0 ? `: ${changes.join(', ')}` : ''}`;
  }

  /**
   * Render tool result message for UI
   */
  renderToolResultMessage(output: TaskUpdateOutput): string {
    let message = `Task ${output.task.id.substring(0, 8)}: ${output.task.subject} is now ${output.task.status}`;

    if (output.task.unblockedTasks && output.task.unblockedTasks.length > 0) {
      message += ` (unblocked ${output.task.unblockedTasks.length} dependent task(s))`;
    }

    return message;
  }
}

// Export singleton instance
export const taskUpdateTool = new TaskUpdateTool();
