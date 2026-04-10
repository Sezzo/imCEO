/**
 * TeamDeleteTool - Clean up team when work is complete
 *
 * Validates no active teammates before cleanup.
 * Only team lead can delete.
 */

import { z } from 'zod';
import type { ToolContext, TeamDeleteOutput } from '../core/types';

export const TeamDeleteInputSchema = z.object({
  team_name: z.string().min(1).describe('Name of the team to delete'),
});

export class TeamDeleteTool {
  static async execute(
    input: z.infer<typeof TeamDeleteInputSchema>,
    context: ToolContext
  ): Promise<TeamDeleteOutput> {
    const { storage, session, logger } = context;

    // Get team
    const team = await storage.getTeam(input.team_name);

    if (!team) {
      return {
        success: true,
        message: `Team "${input.team_name}" not found, nothing to clean up`,
        team_name: input.team_name,
      };
    }

    // Verify lead is deleting (or user)
    if (team.leadAgentId !== session.agentId && !session.isUser) {
      throw new Error('Only the team lead can delete the team');
    }

    // Check for active non-lead members
    const nonLeadMembers = Object.values(team.members).filter(
      (m: any) => m.name !== 'team-lead' && m.isActive
    );

    if (nonLeadMembers.length > 0) {
      const memberNames = nonLeadMembers.map((m: any) => m.name).join(', ');
      return {
        success: false,
        message: `Cannot cleanup team with ${nonLeadMembers.length} active member(s): ${memberNames}. Request teammate shutdowns first.`,
        team_name: input.team_name,
        active_members: nonLeadMembers.length,
      };
    }

    // Get all tasks for this team
    const tasks = await storage.getTasks(input.team_name);
    const activeTasks = tasks.filter((t) => t.status === 'in_progress');

    if (activeTasks.length > 0) {
      return {
        success: false,
        message: `Cannot delete team with ${activeTasks.length} in-progress task(s). Complete or cancel tasks first.`,
        team_name: input.team_name,
      };
    }

    // Perform cleanup
    await storage.deleteTeam(input.team_name);

    logger.info('Team deleted', {
      team_name: input.team_name,
      tasks_cleaned: tasks.length,
      members_cleaned: Object.keys(team.members).length,
    });

    return {
      success: true,
      message: `Cleaned up team "${input.team_name}" and all associated data (tasks: ${tasks.length}, members: ${Object.keys(team.members).length})`,
      team_name: input.team_name,
      team_id: input.team_name,
    };
  }
}
