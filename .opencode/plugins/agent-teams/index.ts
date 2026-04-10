/**
 * OpenCode Agent Teams Plugin
 *
 * Claude Code-style multi-agent collaboration for OpenCode
 *
 * Features:
 * - Create and manage agent teams
 * - Shared task list with dependencies
 * - Inter-agent messaging with delegation
 * - Multi-team support with cross-team delegation
 *
 * @module opencode-agent-teams
 */

import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import { z } from 'zod';

// Storage
import { LocalStorage } from './src/storage/LocalStorage';

// Tools
import { TeamCreateTool } from './src/tools/TeamCreateTool';
import { TeamDeleteTool } from './src/tools/TeamDeleteTool';
import { TaskCreateTool } from './src/tools/TaskCreateTool';
import { TaskListTool } from './src/tools/TaskListTool';
import { TaskUpdateTool } from './src/tools/TaskUpdateTool';
import { SendMessageTool } from './src/tools/SendMessageTool';
import { SpawnAgentTool } from './src/tools/SpawnAgentTool';

// Commands
import { createTeamCommands } from './src/commands/team';
import { createAgentCommands } from './src/commands/agent';
import { createTaskCommands } from './src/commands/task';
import { createTeamsDashboard } from './src/commands/teams';

// Types
import type { ToolContext } from './src/core/types';

/**
 * Agent Teams Plugin for OpenCode
 *
 * Enables multi-agent collaboration with:
 * - Team creation and management
 * - Shared task lists
 * - Inter-agent messaging
 * - Cross-team delegation
 */
const AgentTeamsPlugin: Plugin = async (ctx) => {
  const { project, client, $, directory, worktree } = ctx;

  // Initialize local storage
  const storagePath = `${directory}/.opencode/agent-teams`;
  const storage = new LocalStorage(storagePath);
  await storage.initialize();

  // Create tool context
  const toolContext: ToolContext = {
    storage,
    client,
    $,
    directory: directory || process.cwd(),
    worktree: worktree || directory || process.cwd(),
    logger: {
      info: (msg: string, meta?: Record<string, any>) => {
        client.app.log({
          body: {
            message: msg,
            level: 'info',
            service: 'agent-teams',
            ...meta,
          },
        });
      },
      error: (msg: string, error?: any) => {
        client.app.log({
          body: {
            message: msg,
            level: 'error',
            service: 'agent-teams',
            error: error?.message || error,
          },
        });
      },
      debug: (msg: string, meta?: Record<string, any>) => {
        if (process.env.DEBUG_AGENT_TEAMS) {
          client.app.log({
            body: {
              message: msg,
              level: 'debug',
              service: 'agent-teams',
              ...meta,
            },
          });
        }
      },
    },
    session: {
      agentId: `user@${project.name || 'default'}`,
      agentName: 'user',
      projectName: project.name || 'default',
      isUser: true,
    },
  };

  return {
    /**
     * Custom Tools - Available to the AI
     */
    tools: {
      // Team Management
      TeamCreate: tool({
        description:
          'Create a new agent team for coordinating multiple agents. The user becomes the team lead. A user can only lead one team at a time.',
        args: {
          team_name: z
            .string()
            .min(1)
            .describe("Unique name for the team (e.g., 'security-review', 'frontend-dev')"),
          description: z.string().optional().describe('What this team will accomplish'),
          agent_type: z.string().optional().describe('Type/role identifier for the lead'),
        },
        async execute(args) {
          return await TeamCreateTool.execute(args, toolContext);
        },
      }),

      TeamDelete: tool({
        description:
          'Clean up a team when work is complete. Can only be called by the team lead. Validates no active teammates remain.',
        args: {},
        async execute() {
          return await TeamDeleteTool.execute({}, toolContext);
        },
      }),

      // Task Management
      TaskCreate: tool({
        description:
          'Create a task in the shared task list. Tasks can have dependencies (blockedBy) that must be completed first.',
        args: {
          subject: z.string().min(1).describe('Brief title for the task'),
          description: z.string().min(1).describe('What needs to be done'),
          blocked_by: z.array(z.string()).optional().describe('Task IDs this task depends on'),
          active_form: z
            .string()
            .optional()
            .describe("Present continuous form shown in UI (e.g., 'Running tests')"),
        },
        async execute(args) {
          return await TaskCreateTool.execute(args, toolContext);
        },
      }),

      TaskList: tool({
        description: 'List all tasks in the shared task list with filtering by status and owner.',
        args: {
          team_name: z.string().describe('Team to list tasks for'),
          status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
          owner: z.string().optional().describe('Filter by agent ID'),
        },
        async execute(args) {
          return await TaskListTool.execute(args, toolContext);
        },
      }),

      TaskUpdate: tool({
        description:
          "Update task status or ownership. Use to claim tasks (status: 'in_progress'), complete them, or unassign.",
        args: {
          team_name: z.string().describe('Team the task belongs to'),
          task_id: z.string().describe('ID of the task to update'),
          status: z
            .enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled'])
            .optional(),
          owner: z
            .string()
            .nullable()
            .optional()
            .describe('Set agent ID to assign, null to unassign'),
        },
        async execute(args) {
          return await TaskUpdateTool.execute(args, toolContext);
        },
      }),

      // Messaging
      SendMessage: tool({
        description:
          "Send messages to agent teammates. Supports plain text, structured messages (shutdown_request, plan_approval), and delegation. Use '*' for broadcast to entire team.",
        args: {
          team_name: z.string().describe('Team to send message in'),
          to: z.string().describe("Recipient: teammate name, '*' for broadcast, or 'team-lead'"),
          message: z
            .union([z.string(), z.object({})])
            .describe('Plain text or structured message object'),
          summary: z
            .string()
            .optional()
            .describe('5-10 word preview (required for plain text messages)'),
        },
        async execute(args) {
          return await SendMessageTool.execute(args, toolContext);
        },
      }),

      // Agent Spawning
      SpawnAgent: tool({
        description:
          'Spawn a new teammate in the current team. Each agent can only be in one team. The spawned agent runs as a separate OpenCode instance and can use all tools including SendMessage.',
        args: {
          team_name: z.string().describe('Team to spawn agent in'),
          name: z
            .string()
            .min(1)
            .describe("Unique name for the teammate (e.g., 'security-reviewer')"),
          prompt: z.string().min(1).describe('The task/instructions for this agent'),
          description: z.string().min(1).describe('Short 3-5 word description shown in UI'),
          mode: z
            .enum(['default', 'plan', 'bypassPermissions'])
            .optional()
            .describe("Permission mode: 'plan' requires approval before implementing"),
          model: z
            .enum(['sonnet', 'opus', 'haiku'])
            .optional()
            .describe('Model override for this agent'),
        },
        async execute(args) {
          return await SpawnAgentTool.execute(args, toolContext);
        },
      }),
    },

    /**
     * Slash Commands - Available to the user
     */
    commands: {
      ...createTeamCommands(storage, toolContext),
      ...createAgentCommands(storage, toolContext),
      ...createTaskCommands(storage, toolContext),
      ...createTeamsDashboard(storage, toolContext),
    },

    /**
     * Event Hooks
     */
    hooks: {
      // Notify when agents complete
      'session.idle': async () => {
        const teams = await storage.getAllTeams();
        for (const team of teams) {
          const activeAgents = await storage.getActiveAgents(team.teamName);
          for (const agent of activeAgents) {
            if (agent.status === 'completed') {
              await ctx.notify(`✅ Agent ${agent.name} in team ${team.teamName} completed`);
            } else if (agent.status === 'failed') {
              await ctx.notify(`❌ Agent ${agent.name} in team ${team.teamName} failed`);
            }
          }
        }
      },

      // Log plugin events
      'tool.execute.after': async ({ tool, result }) => {
        if (
          tool.startsWith('Team') ||
          tool.startsWith('Task') ||
          tool.startsWith('Send') ||
          tool.startsWith('Spawn')
        ) {
          toolContext.logger.debug(`Tool ${tool} executed`, { result });
        }
      },
    },
  };
};

export default AgentTeamsPlugin;
