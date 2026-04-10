/**
 * SpawnAgentTool - Launch a new agent teammate
 *
 * Each agent runs as a separate OpenCode instance in a sub-process (tmux/iTerm2).
 * Each agent can only be in one team at a time.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ToolContext, SpawnAgentInput, SpawnAgentOutput } from '../core/types';

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

export const SpawnAgentInputSchema = z.object({
  team_name: z.string().min(1),
  name: z.string().min(1),
  prompt: z.string().min(1),
  description: z.string().min(1),
  mode: z.enum(['default', 'plan', 'bypassPermissions']).optional(),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
});

export class SpawnAgentTool {
  static async execute(
    input: z.infer<typeof SpawnAgentInputSchema>,
    context: ToolContext
  ): Promise<SpawnAgentOutput> {
    const { storage, session, logger, $, directory } = context;

    // Get team
    const team = await storage.getTeam(input.team_name);
    if (!team) {
      throw new Error(`Team "${input.team_name}" does not exist. Create it with TeamCreate first.`);
    }

    // Validate: Only team lead can spawn
    if (session.agentId !== team.leadAgentId && !session.isUser) {
      throw new Error('Only the team lead can spawn teammates');
    }

    // Generate unique name if collision
    const baseName = input.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    let uniqueName = baseName;
    let suffix = 2;

    while (team.members[uniqueName]) {
      uniqueName = `${baseName}-${suffix}`;
      suffix++;
    }

    // Generate agent ID
    const agentId = `${uniqueName}@${input.team_name}`;
    const color = TEAM_COLORS[Object.keys(team.members).length % TEAM_COLORS.length];

    // Add member to team
    team.members[uniqueName] = {
      agentId,
      name: uniqueName,
      agentType: 'teammate',
      color,
      model: input.model,
      planModeRequired: input.mode === 'plan',
      isActive: true,
      isLeader: false,
      joinedAt: new Date().toISOString(),
      backendType: 'subprocess',
    };

    await storage.saveTeam(team);

    // Create session for the agent
    const sessionId = randomUUID();
    await storage.saveSession({
      sessionId,
      agentId,
      agentName: uniqueName,
      teamName: input.team_name,
      prompt: input.prompt,
      status: 'running',
      executionState: input.mode === 'plan' ? 'waiting_for_plan_approval' : 'running',
      awaitingPlanApproval: input.mode === 'plan',
      tokenCount: 0,
      startedAt: new Date().toISOString(),
    });

    // Spawn the agent in a sub-process (tmux/iTerm2)
    // This would use OpenCode's multi-session capability
    try {
      // Note: In a real implementation, this would:
      // 1. Create a new tmux window/pane or iTerm2 tab
      // 2. Start a new OpenCode instance with the agent's identity
      // 3. Send the initial prompt

      // For now, we simulate this with a background process
      logger.info('Spawning agent subprocess', {
        agent_id: agentId,
        name: uniqueName,
        team: input.team_name,
      });

      // Create initial message in agent's mailbox
      const initialMessage = {
        messageId: randomUUID(),
        fromAgentId: 'team-lead',
        toAgentId: uniqueName,
        messageType: 'text' as const,
        content: input.prompt,
        summary: input.description,
        isRead: false,
        isProcessed: false,
        createdAt: new Date().toISOString(),
      };

      await storage.saveMessage(input.team_name, uniqueName, initialMessage);

      // In a real implementation, we would spawn like this:
      // await $`tmux new-window -d -n ${uniqueName} "cd ${directory} && opencode --agent-id ${agentId} --team ${input.team_name}"`;
    } catch (error) {
      logger.error('Failed to spawn agent subprocess', error);
      throw new Error(
        `Failed to spawn agent: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    logger.info('Agent spawned', {
      agent_id: agentId,
      name: uniqueName,
      team: input.team_name,
      mode: input.mode || 'default',
    });

    return {
      success: true,
      teammate_id: agentId,
      agent_id: agentId,
      name: uniqueName,
      team_name: input.team_name,
      color,
      plan_mode_required: input.mode === 'plan',
      model: input.model,
      prompt: input.prompt,
    };
  }
}
