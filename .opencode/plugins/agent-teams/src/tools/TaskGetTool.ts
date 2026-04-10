/**
 * TaskGetTool - Get details of a specific task
 */

import { z } from 'zod';
import type { ToolContext } from '../core/types';

export const TaskGetInputSchema = z.object({
  team_name: z.string().min(1),
  task_id: z.string().min(1),
});

export class TaskGetTool {
  static async execute(
    input: z.infer<typeof TaskGetInputSchema>,
    context: ToolContext
  ): Promise<{ task: any | null }> {
    const { storage } = context;

    const task = await storage.getTask(input.team_name, input.task_id);

    if (!task) {
      return { task: null };
    }

    // Get blockedBy details
    let blockedByDetails;
    if (task.blockedBy?.length) {
      const deps = await Promise.all(
        task.blockedBy.map((id) => storage.getTask(input.team_name, id))
      );
      blockedByDetails = deps.filter(Boolean).map((t) => ({
        id: t!.taskId,
        subject: t!.subject,
        status: t!.status,
      }));
    }

    return {
      task: {
        id: task.taskId,
        subject: task.subject,
        description: task.description,
        activeForm: task.activeForm,
        status: task.status,
        ownerAgentId: task.ownerAgentId,
        blockedBy: task.blockedBy || [],
        blockedByDetails,
        blocks: task.blocks || [],
        metadata: task.metadata,
        createdAt: task.createdAt,
        claimedAt: task.claimedAt,
        completedAt: task.completedAt,
      },
    };
  }
}
