/**
 * TeamCreateTool - Create a new agent team
 *
 * User becomes the team lead. Each user can only lead one team at a time.
 */

import { z } from 'zod';
import type { ToolContext, TeamCreateInput, TeamCreateOutput } from '../core/types';

const TEAM_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
];

export const TeamCreateInputSchema = z.object({
  team_name: z.string().min(1),
  description: z.string().optional(),
  agent_type: z.string().optional(),
});

export class TeamCreateTool {
  static async execute(
    input: z.infer<typeof TeamCreateInputSchema>,
    context: ToolContext
  ): Promise<TeamCreateOutput> {
    const { storage, session, logger } = context;

    // Validate: Check if user already leads a team
    const existingTeam = await storage.getTeamByLead(session.agentId);
    if (existingTeam) {
      throw new Error(
        `Already leading team "${existingTeam.teamName}". ` +
          `Delete it first with TeamDelete before creating a new one.`
      );
    }

    // Generate team ID and lead agent ID
    const teamId = input.team_name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const leadAgentId = `team-lead@${teamId}`;

    // Check for name collision
    const existing = await storage.getTeam(teamId);
    if (existing) {
      throw new Error(`Team "${teamId}" already exists. Use a different name.`);
    }

    // Create team
    const team = {
      teamName: teamId,
      description: input.description,
      createdAt: new Date().toISOString(),
      leadAgentId,
      members: {
        'team-lead': {
          agentId: leadAgentId,
          name: 'team-lead',
          agentType: input.agent_type || 'team-lead',
          color: TEAM_COLORS[0],
          model: undefined,
          planModeRequired: false,
          isActive: true,
          isLeader: true,
          joinedAt: new Date().toISOString(),
          backendType: 'in_process' as const,
        },
      },
    };

    await storage.saveTeam(team);

    logger.info('Team created', {
      team_name: teamId,
      lead_agent_id: leadAgentId,
      member_count: 1,
    });

    return {
      success: true,
      team_name: teamId,
      team_id: teamId,
      lead_agent_id: leadAgentId,
    };
  }
}
