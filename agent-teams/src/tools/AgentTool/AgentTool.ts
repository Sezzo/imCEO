/**
 * AgentTool - Launch a new agent (teammate)
 *
 * Ported from Claude Code's AgentTool
 * Handles both subagent (async) and teammate (in-process) spawning
 */

import { z } from 'zod';
import {
  InProcessTeammateManager,
  SpawnTeammateConfig,
  formatAgentId,
  assignTeammateColor,
} from '../infrastructure/agent-execution/InProcessTeammateManager';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AgentToolInput {
  description: string; // Short (3-5 word) description of the task
  prompt: string; // The task for the agent to perform
  subagent_type?: string; // Type of specialized agent to use
  model?: 'sonnet' | 'opus' | 'haiku';
  run_in_background?: boolean; // Run in background (async)

  // Agent Teams parameters
  name?: string; // Name for spawned teammate (enables teammate mode)
  team_name?: string; // Team name for spawning
  mode?: 'default' | 'plan' | 'bypassPermissions'; // Permission mode for teammate
  isolation?: 'worktree'; // Isolation mode
}

export type AgentToolOutput = SynchronousOutput | AsyncLaunchedOutput | TeammateSpawnedOutput;

export interface SynchronousOutput {
  status: 'completed';
  result: string;
  prompt: string;
}

export interface AsyncLaunchedOutput {
  status: 'async_launched';
  agentId: string;
  description: string;
  prompt: string;
  outputFile: string;
}

export interface TeammateSpawnedOutput {
  status: 'teammate_spawned';
  teammate_id: string;
  agent_id: string;
  name: string;
  color?: string;
  team_name: string;
  plan_mode_required?: boolean;
  model?: string;
  prompt: string;
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
      isLeader: boolean;
    };
  };
  webSocket: {
    publishToTeam: (teamName: string, type: string, payload: any) => Promise<void>;
  };
  inProcessManager: InProcessTeammateManager;
  options: {
    agentDefinitions: any[];
    mainLoopModel?: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

export const AGENT_TOOL_NAME = 'Agent';
export const GENERAL_PURPOSE_AGENT = 'general-purpose';

// ============================================================================
// Zod Schema
// ============================================================================

export const AgentToolInputSchema = z.object({
  description: z.string().min(1).describe('A short (3-5 word) description of the task'),
  prompt: z.string().min(1).describe('The task for the agent to perform'),
  subagent_type: z.string().optional().describe('The type of specialized agent to use'),
  model: z
    .enum(['sonnet', 'opus', 'haiku'])
    .optional()
    .describe('Optional model override for this agent'),
  run_in_background: z
    .boolean()
    .optional()
    .describe('Set to true to run this agent in the background'),
  name: z
    .string()
    .optional()
    .describe('Name for the spawned agent. Makes it addressable via SendMessage while running.'),
  team_name: z
    .string()
    .optional()
    .describe('Team name for spawning. Uses current team context if omitted.'),
  mode: z
    .enum(['default', 'plan', 'bypassPermissions'])
    .optional()
    .describe('Permission mode for spawned teammate'),
  isolation: z
    .enum(['worktree'])
    .optional()
    .describe('Isolation mode. "worktree" creates a temporary git worktree.'),
});

// ============================================================================
// Tool Implementation
// ============================================================================

export class AgentTool {
  readonly name = AGENT_TOOL_NAME;
  readonly description = 'Launch a new agent (subagent or teammate)';
  readonly shouldDefer = true;

  /**
   * Execute the Agent tool
   */
  async execute(input: AgentToolInput, context: ToolContext): Promise<{ data: AgentToolOutput }> {
    const { session, inProcessManager, options } = context;

    // Resolve team name
    const teamName = input.team_name || session.teamContext?.teamName;

    // Check if spawning as teammate (name + team_name provided)
    if (teamName && input.name) {
      // Validate: Teammates cannot spawn other teammates
      if (session.teamContext && !session.teamContext.isLeader) {
        throw new Error(
          'Teammates cannot spawn other teammates — the team roster is flat. ' +
            'To spawn a subagent instead, omit the `name` parameter.'
        );
      }

      // Spawn as teammate
      return this.spawnTeammate(input, context, teamName);
    }

    // Check if in-process teammate trying to spawn background agent
    if (session.teamContext && !session.teamContext.isLeader && input.run_in_background) {
      throw new Error(
        'In-process teammates cannot spawn background agents. ' +
          'Use run_in_background=false for synchronous subagents.'
      );
    }

    // Standard subagent spawning (non-teammate)
    // This would delegate to a background task system
    if (input.run_in_background) {
      return this.spawnBackgroundSubagent(input, context);
    }

    // Synchronous subagent execution
    return this.spawnSynchronousSubagent(input, context);
  }

  /**
   * Spawn a teammate in the current team
   */
  private async spawnTeammate(
    input: AgentToolInput,
    context: ToolContext,
    teamName: string
  ): Promise<{ data: TeammateSpawnedOutput }> {
    const { inProcessManager, options, session } = context;

    // Get team
    const team = await context.prisma.agentTeam.findUnique({
      where: { teamName },
      include: { members: true },
    });

    if (!team) {
      throw new Error(`Team "${teamName}" does not exist. Create it with TeamCreate first.`);
    }

    // Validate lead is calling
    if (team.leadAgentId !== session.agentId && !session.teamContext?.isLeader) {
      throw new Error('Only the team lead can spawn teammates');
    }

    // Generate unique name if collision
    const baseName = input.name!;
    let uniqueName = baseName;
    let suffix = 2;

    while (team.members.some((m) => m.name.toLowerCase() === uniqueName.toLowerCase())) {
      uniqueName = `${baseName}-${suffix}`;
      suffix++;
    }

    // Resolve model
    const model = input.model || options.mainLoopModel || 'sonnet';

    // Determine plan mode requirement
    const planModeRequired = input.mode === 'plan';

    // Build spawn config
    const spawnConfig: SpawnTeammateConfig = {
      name: uniqueName,
      teamName,
      prompt: input.prompt,
      description: input.description,
      model,
      planModeRequired,
      agentType: input.subagent_type,
      allowedTools: this.getAllowedTools(input.subagent_type, context),
      invokingRequestId: session.agentId,
    };

    // Spawn teammate
    const result = await inProcessManager.spawnTeammate(spawnConfig);

    if (!result.success) {
      throw new Error(result.error || 'Failed to spawn teammate');
    }

    // Get color
    const member = await context.prisma.agentTeamMember.findFirst({
      where: { agentId: result.agentId },
    });

    return {
      data: {
        status: 'teammate_spawned',
        teammate_id: result.teammateId,
        agent_id: result.agentId,
        name: uniqueName,
        color: member?.color,
        team_name: teamName,
        plan_mode_required: planModeRequired,
        model,
        prompt: input.prompt,
      },
    };
  }

  /**
   * Spawn background subagent (async)
   */
  private async spawnBackgroundSubagent(
    input: AgentToolInput,
    context: ToolContext
  ): Promise<{ data: AsyncLaunchedOutput }> {
    const agentId = formatAgentId(input.description.replace(/\s+/g, '-').toLowerCase(), 'subagent');

    // In a real implementation, this would:
    // 1. Create a background job in a queue (Bull, etc.)
    // 2. Return immediately with job ID
    // 3. Background worker would execute the agent

    return {
      data: {
        status: 'async_launched',
        agentId,
        description: input.description,
        prompt: input.prompt,
        outputFile: `/tmp/agent-output/${agentId}.json`,
      },
    };
  }

  /**
   * Spawn synchronous subagent
   */
  private async spawnSynchronousSubagent(
    input: AgentToolInput,
    context: ToolContext
  ): Promise<{ data: SynchronousOutput }> {
    // In a real implementation, this would:
    // 1. Create a child process or isolate
    // 2. Run the agent there
    // 3. Wait for completion
    // 4. Return result

    // For now, return a placeholder
    return {
      data: {
        status: 'completed',
        result: `Subagent "${input.description}" completed execution.`,
        prompt: input.prompt,
      },
    };
  }

  /**
   * Get allowed tools for an agent type
   */
  private getAllowedTools(agentType: string | undefined, context: ToolContext): string[] {
    if (!agentType) return [];

    // Look up agent definition
    const definition = context.options.agentDefinitions?.find(
      (def: any) => def.agentType === agentType
    );

    return definition?.allowedTools || [];
  }

  /**
   * Get tool prompt/description for LLM
   */
  async getPrompt(): Promise<string> {
    return `
Launch a new agent to perform a task.

## Two Modes

### 1. Subagent Mode (default)
Spawn a worker agent that reports back when complete.
- No \\"name\\" parameter
- Runs independently then returns result
- Good for: isolated tasks, one-off operations

### 2. Teammate Mode (Agent Teams)
Spawn a teammate in the current team when BOTH are provided:
- \\"name\\": A unique name for the teammate
- \\"team_name\\": The team to join (or uses current team context)

Teammates:
- Can send/receive messages via SendMessage tool
- Access shared task list
- Work in parallel with other teammates
- Are coordinated by the team lead

## Parameters

### Core (always required)
- description: Short task description (3-5 words)
- prompt: Detailed instructions for the agent

### Optional
- subagent_type: Use a specialized agent definition
- model: Override model (sonnet/opus/haiku)
- run_in_background: Run asynchronously

### Teammate Mode (requires name)
- name: Teammate identifier (e.g., \\"security-reviewer\\")
- team_name: Target team (defaults to current team)
- mode: Permission mode (default/plan/bypassPermissions)
  - plan: Must submit plan before implementing

## Examples

### Basic subagent:
Agent({
  description: \\"Analyze codebase\\",
  prompt: \\"Search for security vulnerabilities in the auth module...\\"
})

### Background subagent:
Agent({
  description: \\"Run tests\\",
  prompt: \\"Execute the full test suite and report results...\\",
  run_in_background: true
})

### Teammate for parallel review:
Agent({
  description: \\"Security review\\",
  prompt: \\"Review PR #142 for security issues...\\",
  name: \\"security-reviewer\\",
  team_name: \\"pr-review-team\\"
})

### Teammate with plan approval:
Agent({
  description: \\"Refactor database layer\\",
  prompt: \\"Restructure the database access layer...\\",
  name: \\"architect\\",
  mode: \\"plan\\"
})

## Important Rules

- Teammates cannot spawn other teammates (flat hierarchy)
- In-process teammates cannot spawn background agents
- Plan mode teammates must submit plan and wait for approval
- Always use descriptive names for teammates (they appear in UI)
`;
  }

  /**
   * Render tool use message for UI
   */
  renderToolUseMessage(input: AgentToolInput): string {
    if (input.name && input.team_name) {
      return `Spawning teammate "${input.name}" in team "${input.team_name}": ${input.description}`;
    }
    if (input.run_in_background) {
      return `Launching background agent: ${input.description}`;
    }
    return `Spawning agent: ${input.description}`;
  }

  /**
   * Render tool result message for UI
   */
  renderToolResultMessage(output: AgentToolOutput): string {
    switch (output.status) {
      case 'teammate_spawned':
        return `Teammate "${output.name}" spawned (${output.agent_id})${output.plan_mode_required ? ' [plan mode required]' : ''}`;
      case 'async_launched':
        return `Background agent launched (${output.agentId})`;
      case 'completed':
        return `Agent completed: ${output.result}`;
      default:
        return 'Agent execution complete';
    }
  }
}

// Export singleton instance
export const agentTool = new AgentTool();
