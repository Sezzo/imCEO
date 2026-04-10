/**
 * Team Commands
 *
 * CLI commands for managing agent teams:
 * - /team create - Create a new team
 * - /team add-agent - Add an agent to the team
 * - /team list - List all teams
 * - /team status - Show team status
 * - /team assign - Assign a task to an agent
 * - /team execute - Execute a task with the team
 * - /team broadcast - Send a message to all agents
 * - /team disband - Disband a team
 */

import type { ToolUseContext } from '../../Tool.js';
import { teamManager } from '../../services/team/team-manager.js';
import { coordinationEngine } from '../../services/team/coordination-engine.js';
import { agentRouter } from '../../services/team/agent-router.js';
import { logForDebugging } from '../../utils/debug.js';
import type {
  AgentConfig,
  AgentRole,
  CreateTeamRequest,
  TaskPriority,
} from '../../services/team/types.js';

// Store the current active team for the session
let activeTeamId: string | null = null;

/**
 * Create a new team with specified agents
 */
export async function teamCreate(
  name: string,
  agentConfigs: Omit<AgentConfig, 'id'>[],
  options: {
    coordinatorModel?: string;
    description?: string;
  } = {},
  context: ToolUseContext
): Promise<string> {
  logForDebugging(`[TeamCommand] Creating team: ${name}`);

  const request: CreateTeamRequest = {
    name,
    description: options.description,
    agents: agentConfigs,
    coordinatorModel: options.coordinatorModel,
  };

  const result = await teamManager.createTeam(request, context.options.tools);
  activeTeamId = result.team.config.id;

  return `Team "${name}" created with ID: ${result.team.config.id}\nSession ID: ${result.sessionId}\nAgents: ${result.agents.length}`;
}

/**
 * List all teams
 */
export function teamList(): string {
  const teams = teamManager.getAllTeams();

  if (teams.length === 0) {
    return 'No teams created yet.';
  }

  const lines = [
    'Teams:',
    ...teams.map((t) => {
      const agentCount = t.agents.size;
      const status = t.status;
      return `  - ${t.config.name} (${t.config.id}) - ${agentCount} agents - ${status}`;
    }),
  ];

  return lines.join('\n');
}

/**
 * Show team status
 */
export function teamStatus(teamId?: string): string {
  const id = teamId || activeTeamId;

  if (!id) {
    return 'No active team. Use /team list to see all teams or specify a team ID.';
  }

  const status = teamManager.getTeamStatus(id);
  if (!status) {
    return `Team not found: ${id}`;
  }

  const lines = [
    `Team: ${status.teamId}`,
    `Status: ${status.status}`,
    '',
    'Agents:',
    ...status.agents.map((a) => {
      const currentTask = a.currentTask ? ` (working on: ${a.currentTask})` : '';
      return `  - ${a.name} (${a.role}) - ${a.status}${currentTask}`;
    }),
    '',
    `Active Tasks: ${status.activeTasks}`,
    `Completed: ${status.completedTasks}`,
    `Failed: ${status.failedTasks}`,
  ];

  return lines.join('\n');
}

/**
 * Assign a task to an agent
 */
export async function teamAssign(
  title: string,
  description: string,
  options: {
    teamId?: string;
    to?: string;
    priority?: TaskPriority;
    context?: string;
  } = {}
): Promise<string> {
  const teamId = options.teamId || activeTeamId;

  if (!teamId) {
    return 'No active team. Create or specify a team first.';
  }

  const task = teamManager.createTask(teamId, title, description, {
    priority: options.priority,
    assignedTo: options.to,
    context: options.context,
  });

  if (options.to) {
    await teamManager.assignTask(task, options.to);
    return `Task "${title}" assigned to ${options.to}. Task ID: ${task.id}`;
  }

  return `Task "${title}" created and queued. Task ID: ${task.id}`;
}

/**
 * Execute a task using the team
 */
export async function teamExecute(
  goal: string,
  options: {
    teamId?: string;
    strategy?: 'sequential' | 'parallel' | 'hierarchical';
  } = {},
  context: ToolUseContext
): Promise<string> {
  const teamId = options.teamId || activeTeamId;

  if (!teamId) {
    return 'No active team. Create a team first with /team create.';
  }

  const team = teamManager.getTeam(teamId);
  if (!team) {
    return `Team not found: ${teamId}`;
  }

  logForDebugging(`[TeamCommand] Executing goal with team ${teamId}: ${goal}`);

  // Generate plan
  const plan = await coordinationEngine.generatePlan(
    team,
    goal,
    options.strategy || 'hierarchical'
  );

  // Emit event
  teamManager.emitEvent({
    type: 'execution_started',
    timestamp: new Date(),
    teamId,
    data: { planId: plan.id, taskCount: plan.tasks.length },
  });

  // Execute plan
  const result = await coordinationEngine.executePlan(plan, team, (event) => {
    // Progress callback - could update UI here
    logForDebugging(`[TeamCommand] Progress: ${event.type}`);
  });

  // Format result
  const lines = [
    `Execution ${result.success ? 'completed' : 'failed'}`,
    `Duration: ${(result.duration / 1000).toFixed(1)}s`,
    `Tasks: ${result.results.size} total`,
    '',
    'Summary:',
    result.summary,
  ];

  if (result.errors && result.errors.length > 0) {
    lines.push('', 'Errors:', ...result.errors.map((e) => `  - ${e}`));
  }

  if (result.artifacts.length > 0) {
    lines.push('', 'Artifacts:', ...result.artifacts.map((a) => `  - ${a.name} (${a.type})`));
  }

  return lines.join('\n');
}

/**
 * Broadcast a message to all agents in the team
 */
export async function teamBroadcast(
  message: string,
  options: {
    teamId?: string;
    urgency?: 'low' | 'normal' | 'high';
  } = {}
): Promise<string> {
  const teamId = options.teamId || activeTeamId;

  if (!teamId) {
    return 'No active team. Specify a team ID.';
  }

  const team = teamManager.getTeam(teamId);
  if (!team) {
    return `Team not found: ${teamId}`;
  }

  const coordinator = team.coordinator;
  if (!coordinator) {
    return 'Team has no coordinator.';
  }

  await agentRouter.broadcastMessage(coordinator, message, team, {
    metadata: { urgency: options.urgency || 'normal' },
  });

  return `Broadcast sent to ${team.agents.size} agents.`;
}

/**
 * Send a direct message to an agent
 */
export async function teamMessage(
  to: string,
  message: string,
  options: {
    teamId?: string;
  } = {}
): Promise<string> {
  const teamId = options.teamId || activeTeamId;

  if (!teamId) {
    return 'No active team. Specify a team ID.';
  }

  const team = teamManager.getTeam(teamId);
  if (!team) {
    return `Team not found: ${teamId}`;
  }

  const coordinator = team.coordinator;
  if (!coordinator) {
    return 'Team has no coordinator.';
  }

  const targetAgent = team.agents.get(to);
  if (!targetAgent) {
    return `Agent not found: ${to}. Available agents: ${Array.from(team.agents.keys()).join(', ')}`;
  }

  await agentRouter.sendDirectMessage(coordinator, to, message, team, {
    metadata: { requiresResponse: true },
  });

  return `Message sent to ${targetAgent.config.name}.`;
}

/**
 * Disband a team
 */
export async function teamDisband(teamId?: string): Promise<string> {
  const id = teamId || activeTeamId;

  if (!id) {
    return 'No team specified. Use /team list to see all teams.';
  }

  await teamManager.disbandTeam(id);

  if (activeTeamId === id) {
    activeTeamId = null;
  }

  return `Team ${id} has been disbanded.`;
}

/**
 * Set the active team for the session
 */
export function teamSetActive(teamId: string): string {
  const team = teamManager.getTeam(teamId);
  if (!team) {
    return `Team not found: ${teamId}`;
  }

  activeTeamId = teamId;
  return `Active team set to: ${team.config.name} (${teamId})`;
}

/**
 * Get the active team ID
 */
export function getActiveTeamId(): string | null {
  return activeTeamId;
}

/**
 * Quick team setup with predefined templates
 */
export async function teamQuickSetup(
  template: 'dev' | 'review' | 'research',
  name: string,
  context: ToolUseContext
): Promise<string> {
  let agentConfigs: Omit<AgentConfig, 'id'>[];

  switch (template) {
    case 'dev':
      agentConfigs = [
        {
          name: 'Senior Developer',
          role: 'worker' as AgentRole,
          model: 'opencode-opus-4',
          systemPrompt:
            'You are an experienced software developer. Write clean, well-documented code. Consider edge cases and best practices.',
          tools: ['BashTool', 'FileReadTool', 'FileEditTool', 'FileWriteTool'],
        },
        {
          name: 'Code Reviewer',
          role: 'reviewer' as AgentRole,
          model: 'opencode-sonnet-4',
          systemPrompt:
            'You are a thorough code reviewer. Check for bugs, security issues, performance problems, and adherence to best practices.',
          tools: ['BashTool', 'FileReadTool', 'GrepTool'],
        },
        {
          name: 'Test Engineer',
          role: 'worker' as AgentRole,
          model: 'opencode-sonnet-4',
          systemPrompt:
            'You are a test engineer. Write comprehensive tests, identify edge cases, and ensure code quality.',
          tools: ['BashTool', 'FileReadTool', 'FileWriteTool'],
        },
      ];
      break;

    case 'review':
      agentConfigs = [
        {
          name: 'Primary Reviewer',
          role: 'reviewer' as AgentRole,
          model: 'opencode-opus-4',
          systemPrompt:
            'You are the primary code reviewer. Focus on architecture, design patterns, and overall quality.',
          tools: ['FileReadTool', 'GrepTool', 'GlobTool'],
        },
        {
          name: 'Security Reviewer',
          role: 'reviewer' as AgentRole,
          model: 'opencode-sonnet-4',
          systemPrompt:
            'You are a security-focused reviewer. Identify vulnerabilities, injection risks, and security best practices violations.',
          tools: ['FileReadTool', 'GrepTool'],
        },
      ];
      break;

    case 'research':
      agentConfigs = [
        {
          name: 'Research Lead',
          role: 'coordinator' as AgentRole,
          model: 'opencode-opus-4',
          systemPrompt:
            'You are a research lead. Synthesize information, identify gaps, and guide the research direction.',
          tools: ['WebFetchTool', 'WebSearchTool', 'FileReadTool'],
        },
        {
          name: 'Data Analyst',
          role: 'worker' as AgentRole,
          model: 'opencode-sonnet-4',
          systemPrompt:
            'You are a data analyst. Find patterns, analyze datasets, and present findings clearly.',
          tools: ['BashTool', 'FileReadTool', 'FileWriteTool'],
        },
        {
          name: 'Fact Checker',
          role: 'reviewer' as AgentRole,
          model: 'opencode-sonnet-4',
          systemPrompt:
            'You are a fact checker. Verify claims, find authoritative sources, and ensure accuracy.',
          tools: ['WebFetchTool', 'WebSearchTool'],
        },
      ];
      break;

    default:
      return `Unknown template: ${template}. Available: dev, review, research`;
  }

  const result = await teamManager.createTeam(
    {
      name,
      description: `Team created from ${template} template`,
      agents: agentConfigs,
    },
    context.options.tools
  );

  activeTeamId = result.team.config.id;

  return `Team "${name}" created from ${template} template.\nID: ${result.team.config.id}\nAgents: ${agentConfigs.map((a) => a.name).join(', ')}`;
}

// Export all commands
export const teamCommands = {
  create: teamCreate,
  list: teamList,
  status: teamStatus,
  assign: teamAssign,
  execute: teamExecute,
  broadcast: teamBroadcast,
  message: teamMessage,
  disband: teamDisband,
  setActive: teamSetActive,
  quickSetup: teamQuickSetup,
};
