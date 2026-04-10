/**
 * TaskListTool - List all tasks in the shared task list
 *
 * Supports filtering by status and owner.
 */

import { z } from 'zod';
import type { ToolContext, TaskListInput, TaskListOutput } from '../core/types';

export const TaskListInputSchema = z.object({
  team_name: z.string().min(1),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
  owner: z.string().optional(),
});

export class TaskListTool {
  static async execute(
    input: z.infer<typeof TaskListInputSchema>,
    context: ToolContext
  ): Promise<TaskListOutput> {
    const { storage } = context;

    // Verify team exists
    const team = await storage.getTeam(input.team_name);
    if (!team) {
      throw new Error(`Team "${input.team_name}" not found`);
    }

    // Get all tasks
    let tasks = await storage.getTasks(input.team_name);

    // Apply filters
    if (input.status) {
      tasks = tasks.filter((t) => t.status === input.status);
    }

    if (input.owner) {
      tasks = tasks.filter((t) => t.ownerAgentId === input.owner);
    }

    // Sort by status then date
    const statusOrder = { pending: 0, in_progress: 1, blocked: 2, completed: 3 };
    tasks.sort((a, b) => {
      const statusDiff = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Process tasks
    const processedTasks = tasks.map((task) => {
      const isBlocked =
        task.status === 'blocked' || (task.blockedBy?.length > 0 && task.status === 'pending');

      const canClaim = task.status === 'pending' && !task.ownerAgentId && !isBlocked;

      return {
        id: task.taskId,
        subject: task.subject,
        description: task.description,
        status: task.status,
        ownerAgentId: task.ownerAgentId,
        blockedBy: task.blockedBy || [],
        isBlocked,
        canClaim,
        createdAt: task.createdAt,
      };
    });

    // Count by status
    const byStatus: Record<string, number> = {};
    for (const task of await storage.getTasks(input.team_name)) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    }

    return {
      tasks: processedTasks,
      total: processedTasks.length,
      byStatus,
    };
  }
}
