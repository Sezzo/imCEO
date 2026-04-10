/**
 * TaskUpdateTool - Update task status and ownership
 *
 * Use to claim tasks (status → in_progress), complete them, or unassign.
 * Automatically unblocks dependent tasks when completing.
 */

import { z } from 'zod';
import type { ToolContext, TaskUpdateInput, TaskUpdateOutput } from '../core/types';

export const TaskUpdateInputSchema = z.object({
  team_name: z.string().min(1),
  task_id: z.string().min(1),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).optional(),
  owner: z.string().nullable().optional(),
});

export class TaskUpdateTool {
  static async execute(
    input: z.infer<typeof TaskUpdateInputSchema>,
    context: ToolContext
  ): Promise<TaskUpdateOutput> {
    const { storage, session, logger } = context;

    // Get task
    const task = await storage.getTask(input.team_name, input.task_id);
    if (!task) {
      throw new Error(`Task "${input.task_id}" not found in team "${input.team_name}"`);
    }

    const previousStatus = task.status;
    const previousOwner = task.ownerAgentId;

    // Build update
    const updates: Partial<typeof task> = {};

    if (input.status) {
      updates.status = input.status;

      if (input.status === 'in_progress' && previousStatus !== 'in_progress') {
        updates.claimedAt = new Date().toISOString();
      }

      if (input.status === 'completed' && previousStatus !== 'completed') {
        updates.completedAt = new Date().toISOString();
      }
    }

    if (input.owner !== undefined) {
      updates.ownerAgentId = input.owner || undefined;

      // Auto-transition status based on owner change
      if (input.owner && previousStatus === 'pending') {
        updates.status = 'in_progress';
        updates.claimedAt = new Date().toISOString();
      }

      if (input.owner === null && previousStatus === 'in_progress') {
        updates.status = 'pending';
      }
    }

    // Apply updates
    Object.assign(task, updates);
    await storage.saveTask(input.team_name, task);

    // Handle unblocking when completing
    const unblockedTasks: string[] = [];
    if (task.status === 'completed' && previousStatus !== 'completed' && task.blocks?.length) {
      for (const blockedId of task.blocks) {
        const blockedTask = await storage.getTask(input.team_name, blockedId);
        if (blockedTask && blockedTask.status === 'blocked') {
          // Check if all dependencies are now complete
          const deps = await Promise.all(
            blockedTask.blockedBy.map((id) => storage.getTask(input.team_name, id))
          );
          const allComplete = deps.every((d) => d?.status === 'completed');

          if (allComplete) {
            blockedTask.status = 'pending';
            await storage.saveTask(input.team_name, blockedTask);
            unblockedTasks.push(blockedId);
          }
        }
      }
    }

    logger.info('Task updated', {
      task_id: input.task_id,
      team: input.team_name,
      from_status: previousStatus,
      to_status: task.status,
      unblocked: unblockedTasks.length,
    });

    return {
      task: {
        id: task.taskId,
        subject: task.subject,
        status: task.status,
        ownerAgentId: task.ownerAgentId,
        previousStatus,
        unblockedTasks: unblockedTasks.length > 0 ? unblockedTasks : undefined,
      },
    };
  }
}
