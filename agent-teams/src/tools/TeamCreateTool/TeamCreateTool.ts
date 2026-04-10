/**
 * TeamCreateTool - Creates a new agent team for coordinating multiple agents
 *
 * Ported from Claude Code's TeamCreateTool
 * Creates team configuration in database and initializes task list
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TeamCreateInput {
  team_name: string;
  description?: string;
  agent_type?: string; // Type/role of team lead (e.g., "researcher", "test-runner")
}

export interface TeamCreateOutput {
  team_name: string;
  team_id: string;
  lead_agent_id: string;
}

export interface ToolContext {
  prisma: any; // PrismaClient type
  session: {
    agentId: string;
    agentName: string;
    companyId: string;
    sessionId?: string;
  };
  webSocket: {
    publishToTeam: (teamName: string, type: string, payload: any) => Promise<void>;
  };
}

// ============================================================================
// Constants
// ============================================================================

export const TEAM_CREATE_TOOL_NAME = 'TeamCreate';
export const TEAM_LEAD_NAME = 'team-lead';
export const TEAM_COLORS = [
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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format agent ID from name and team
 * Format: "name@teamName"
 */
export function formatAgentId(name: string, teamName: string): string {
  return `${sanitizeAgentName(name)}@${sanitizeTeamName(teamName)}`;
}

/**
 * Sanitize agent name for ID
 */
export function sanitizeAgentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Sanitize team name
 */
export function sanitizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate unique team name if provided name exists
 */
async function generateUniqueTeamName(providedName: string, prisma: any): Promise<string> {
  const existingTeam = await prisma.agentTeam.findUnique({
    where: { teamName: providedName },
  });

  if (!existingTeam) {
    return providedName;
  }

  // Generate with random suffix
  const suffix = randomUUID().slice(0, 8);
  return `${providedName}-${suffix}`;
}

/**
 * Assign a unique color to a teammate
 */
export function assignTeammateColor(index: number = 0): string {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

/**
 * Reset task list for a team (clear any existing tasks)
 */
async function resetTaskList(teamName: string, prisma: any): Promise<void> {
  // Delete all existing tasks for this team
  await prisma.agentTask.deleteMany({
    where: {
      team: {
        teamName,
      },
    },
  });
}

// ============================================================================
// Zod Schema
// ============================================================================

export const TeamCreateInputSchema = z.object({
  team_name: z.string().min(1).describe('Name for the new team to create'),
  description: z.string().optional().describe('Team description/purpose'),
  agent_type: z
    .string()
    .optional()
    .describe(
      'Type/role of the team lead (e.g., "researcher", "test-runner"). Used for team file and inter-agent coordination.'
    ),
});

// ============================================================================
// Tool Implementation
// ============================================================================

export class TeamCreateTool {
  readonly name = TEAM_CREATE_TOOL_NAME;
  readonly description = 'Create a new team for coordinating multiple agents';
  readonly shouldDefer = true;

  /**
   * Execute the TeamCreate tool
   */
  async execute(input: TeamCreateInput, context: ToolContext): Promise<{ data: TeamCreateOutput }> {
    const { prisma, session, webSocket } = context;

    // 1. Validate: Check if already leading a team (one team per leader)
    const existingTeam = await prisma.agentTeam.findFirst({
      where: { leadAgentId: session.agentId },
    });

    if (existingTeam) {
      throw new Error(
        `Already leading team "${existingTeam.teamName}". A leader can only manage one team at a time. Use TeamDelete to end the current team before creating a new one.`
      );
    }

    // 2. Generate unique team name
    const finalTeamName = await generateUniqueTeamName(input.team_name, prisma);

    // 3. Generate deterministic agent ID for the team lead
    const leadAgentId = formatAgentId(TEAM_LEAD_NAME, finalTeamName);
    const leadAgentType = input.agent_type || TEAM_LEAD_NAME;

    // 4. Create team in database
    const team = await prisma.agentTeam.create({
      data: {
        teamName: finalTeamName,
        description: input.description,
        companyId: session.companyId,
        leadAgentId: leadAgentId,
        leadSessionId: session.sessionId,
        currentState: 'active',
        metadata: {
          createdBy: session.agentId,
          createdByName: session.agentName,
        },
        members: {
          create: [
            {
              agentId: leadAgentId,
              name: TEAM_LEAD_NAME,
              agentType: leadAgentType,
              model: null, // Will inherit from leader
              color: assignTeammateColor(0),
              backendType: 'in_process',
              isActive: true,
              isLeader: true,
              planModeRequired: false,
            },
          ],
        },
      },
    });

    // 5. Reset task list for this team (ensure fresh start)
    await resetTaskList(finalTeamName, prisma);

    // 6. Publish team created event
    await webSocket.publishToTeam(finalTeamName, 'team:created', {
      teamId: team.teamId,
      teamName: finalTeamName,
      leadAgentId,
      timestamp: new Date().toISOString(),
    });

    // 7. Log analytics event
    console.log('Team created:', {
      team_name: finalTeamName,
      teammate_count: 1,
      lead_agent_type: leadAgentType,
    });

    // 8. Return result
    return {
      data: {
        team_name: finalTeamName,
        team_id: team.teamId,
        lead_agent_id: leadAgentId,
      },
    };
  }

  /**
   * Get tool prompt/description for LLM
   */
  async getPrompt(): Promise<string> {
    return `
Create a new agent team for coordinating multiple AI agents working together.

## When to Use
Use this tool when you need to:
- Coordinate parallel work across multiple agents
- Set up a research team with different perspectives
- Create specialized agents for complex tasks
- Enable inter-agent communication and task sharing

## Parameters
- team_name: A unique name for the team (required)
- description: What this team will accomplish (optional)
- agent_type: The role/type of the team lead (optional, defaults to "team-lead")

## Output
Returns:
- team_name: The final team name (may be modified if collision)
- team_id: Database ID for the team
- lead_agent_id: The lead agent's identifier (format: "team-lead@team-name")

## Important Notes
- A session can only lead ONE team at a time
- Use TeamDelete to clean up before creating a new team
- Team members communicate via the SendMessage tool
- Tasks are managed through TaskCreate, TaskList, TaskUpdate tools

## Example Usage
Create a team with 3 agents to review a PR from different angles:
1. TeamCreate({ team_name: "pr-review-team", description: "Review PR #142" })
2. Agent({ name: "security-reviewer", prompt: "Review for security issues...", team_name: "pr-review-team" })
3. Agent({ name: "performance-reviewer", prompt: "Check performance impact...", team_name: "pr-review-team" })
4. Agent({ name: "test-reviewer", prompt: "Validate test coverage...", team_name: "pr-review-team" })
`;
  }

  /**
   * Render tool use message for UI
   */
  renderToolUseMessage(input: TeamCreateInput): string {
    return `Creating team "${input.team_name}"${input.description ? ` - ${input.description}` : ''}`;
  }

  /**
   * Render tool result message for UI
   */
  renderToolResultMessage(output: TeamCreateOutput): string {
    return `Team "${output.team_name}" created with lead agent "${output.lead_agent_id}"`;
  }
}

// Export singleton instance
export const teamCreateTool = new TeamCreateTool();
