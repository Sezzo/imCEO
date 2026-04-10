/**
 * TeamDeleteTool - Cleans up team and task directories when the swarm is complete
 *
 * Ported from Claude Code's TeamDeleteTool
 * Validates no active teammates before cleanup, removes team from database
 */

import { z } from 'zod';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TeamDeleteInput {
  // No parameters needed - uses context to determine team
}

export interface TeamDeleteOutput {
  success: boolean;
  message: string;
  team_name?: string;
  team_id?: string;
  active_members?: number;
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
      leadAgentId: string;
    };
  };
  webSocket: {
    publishToTeam: (teamName: string, type: string, payload: any) => Promise<void>;
  };
}

// ============================================================================
// Constants
// ============================================================================

export const TEAM_DELETE_TOOL_NAME = 'TeamDelete';
export const TEAM_LEAD_NAME = 'team-lead';

// ============================================================================
// Zod Schema
// ============================================================================

export const TeamDeleteInputSchema = z.object({
  // No parameters - uses session context
});

// ============================================================================
// Tool Implementation
// ============================================================================

export class TeamDeleteTool {
  readonly name = TEAM_DELETE_TOOL_NAME;
  readonly description = 'Clean up team and task directories when the swarm is complete';
  readonly shouldDefer = true;

  /**
   * Execute the TeamDelete tool
   */
  async execute(
    _input: TeamDeleteInput,
    context: ToolContext
  ): Promise<{ data: TeamDeleteOutput }> {
    const { prisma, session, webSocket } = context;

    // Get team from session context
    const teamName = session.teamContext?.teamName;

    if (!teamName) {
      return {
        data: {
          success: true,
          message: 'No team name found in session context, nothing to clean up',
        },
      };
    }

    // Find the team
    const team = await prisma.agentTeam.findUnique({
      where: { teamName },
      include: {
        members: true,
      },
    });

    if (!team) {
      return {
        data: {
          success: true,
          message: `Team "${teamName}" not found in database, nothing to clean up`,
          team_name: teamName,
        },
      };
    }

    // Check for active non-lead members
    const nonLeadMembers = team.members.filter((m: any) => m.name !== TEAM_LEAD_NAME);

    // Separate truly active members from idle/dead ones
    // Members with isActive === false are idle (finished their turn or crashed)
    const activeMembers = nonLeadMembers.filter((m: any) => m.isActive !== false);

    if (activeMembers.length > 0) {
      const memberNames = activeMembers.map((m: any) => m.name).join(', ');
      return {
        data: {
          success: false,
          message: `Cannot cleanup team with ${activeMembers.length} active member(s): ${memberNames}. Use requestShutdown to gracefully terminate teammates first.`,
          team_name: teamName,
          team_id: team.teamId,
          active_members: activeMembers.length,
        },
      };
    }

    // Perform cleanup in transaction
    await prisma.$transaction(async (tx: any) => {
      // 1. Delete all tasks for this team
      await tx.agentTask.deleteMany({
        where: { teamId: team.teamId },
      });

      // 2. Delete all mailbox messages
      await tx.teamMailbox.deleteMany({
        where: { teamId: team.teamId },
      });

      // 3. Delete all execution logs
      await tx.agentExecutionLog.deleteMany({
        where: { teamId: team.teamId },
      });

      // 4. Delete all sessions
      await tx.agentTeamSession.deleteMany({
        where: { teamId: team.teamId },
      });

      // 5. Delete all members
      await tx.agentTeamMember.deleteMany({
        where: { teamId: team.teamId },
      });

      // 6. Delete the team itself
      await tx.agentTeam.delete({
        where: { teamId: team.teamId },
      });
    });

    // Publish team deleted event
    await webSocket.publishToTeam(teamName, 'team:deleted', {
      teamId: team.teamId,
      teamName,
      timestamp: new Date().toISOString(),
    });

    // Log analytics event
    console.log('Team deleted:', {
      team_name: teamName,
      team_id: team.teamId,
    });

    return {
      data: {
        success: true,
        message: `Cleaned up team "${teamName}" and all associated data (tasks, messages, logs, sessions)`,
        team_name: teamName,
        team_id: team.teamId,
      },
    };
  }

  /**
   * Get tool prompt/description for LLM
   */
  async getPrompt(): Promise<string> {
    return `
Clean up team and remove all associated resources when the swarm is complete.

## When to Use
Use this tool when:
- All teammates have finished their work and been shut down
- You want to permanently remove a team and all its data
- You're done with the agent team collaboration

## Validation
IMPORTANT: This tool will FAIL if any teammates are still active.
You must:
1. First request all teammates to shut down (they can approve or reject)
2. Wait for all teammates to become inactive
3. Then call TeamDelete to cleanup

## What Gets Cleaned Up
- Team configuration and members
- All tasks in the task list
- All mailbox messages
- All execution logs
- All agent sessions

## Important Notes
- ONLY the team lead should call this tool
- This action is IRREVERSIBLE - all team data will be deleted
- Teammates should NOT run cleanup (their team context may not resolve correctly)

## Example Usage
1. Request teammate shutdown: SendMessage({ to: "researcher", message: { type: "shutdown_request" } })
2. Wait for teammates to approve and exit
3. TeamDelete() - Clean up when all teammates are gone
`;
  }

  /**
   * Render tool use message for UI
   */
  renderToolUseMessage(): string {
    return 'Cleaning up team...';
  }

  /**
   * Render tool result message for UI
   */
  renderToolResultMessage(output: TeamDeleteOutput): string {
    if (output.success) {
      return `✅ ${output.message}`;
    } else {
      return `❌ ${output.message}`;
    }
  }
}

// Export singleton instance
export const teamDeleteTool = new TeamDeleteTool();
