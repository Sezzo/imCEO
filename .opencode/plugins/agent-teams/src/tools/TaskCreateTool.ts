/**
 * TaskCreateTool - Create a task in the shared task list
 *
 * Supports task dependencies via blockedBy array.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ToolContext, TaskCreateInput, TaskCreateOutput, Task } from '../core/types';

export const TaskCreateInputSchema = z.object({
  team_name: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().min(1),
  blocked_by: z.array(z.string()).optional(),
  active_form: z.string().optional(),
});

export class TaskCreateTool {
  static async execute(
    input: z.infer<typeof TaskCreateInputSchema>,
    context: ToolContext
  ): Promise<TaskCreateOutput> {
    const { storage, session, logger } = context;

    // Verify team exists
    const team = await storage.getTeam(input.team_name);
    if (!team) {
      throw new Error(`Team "${input.team_name}" not found. Create it with TeamCreate first.`);
    }

    // Validate dependencies exist
    let validBlockedBy: string[] = [];
    if (input.blocked_by && input.blocked_by.length > 0) {
      const existingTasks = await storage.getTasks(input.team_name);
      const existingTaskIds = existingTasks.map((t) => t.taskId);

      validBlockedBy = input.blocked_by.filter((id) => existingTaskIds.includes(id));

      const invalidDeps = input.blocked_by.filter((id) => !existingTaskIds.includes(id));
      if (invalidDeps.length > 0) {
        logger.info('Ignoring invalid task dependencies', { invalid: invalidDeps });
      }
    }

    // Determine initial status
    const initialStatus = validBlockedBy.length > 0 ? 'blocked' : 'pending';

    // Create task
    const taskId = `task-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const task: Task = {
      taskId,
      subject: input.subject,
      description: input.description,
      activeForm: input.active_form,
      status: initialStatus,
      blockedBy: validBlockedBy,
      blocks: [],
      metadata: {},
      createdAt: new Date().toISOString(),
    };

    await storage.saveTask(input.team_name, task);

    // Update blocks on dependency tasks
    for (const depId of validBlockedBy) {
      const depTask = await storage.getTask(input.team_name, depId);
      if (depTask) {
        depTask.blocks = [...(depTask.blocks || []), taskId];
        await storage.saveTask(input.team_name, depTask);
      }
    }

    logger.info('Task created', {
      task_id: taskId,
      team: input.team_name,
      status: initialStatus,
      blocked_by: validBlockedBy.length,
    });

    return {
      task: {
        id: taskId,
        subject: task.subject,
        status: task.status,
      },
    };
  }
}
