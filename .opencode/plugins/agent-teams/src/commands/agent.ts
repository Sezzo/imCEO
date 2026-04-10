/**
 * Agent Commands - /agent spawn, /agent list, /agent kill
 */

import type { LocalStorage, ToolContext } from '../core/types';

export function createAgentCommands(storage: LocalStorage, context: ToolContext) {
  return {
    agent: {
      description: 'Manage agent teammates',
      subcommands: {
        spawn: {
          description: 'Spawn a new agent',
          args: [
            { name: 'team', description: 'Team name', required: true },
            { name: 'name', description: 'Agent name', required: true },
            { name: 'prompt', description: 'Agent instructions', required: true },
          ],
          async execute(args: string[]) {
            const [teamName, name, ...promptParts] = args;
            const prompt = promptParts.join(' ');

            if (!teamName || !name || !prompt) {
              return 'Usage: /agent spawn <team> <name> <prompt>';
            }

            try {
              const { SpawnAgentTool } = await import('../tools/SpawnAgentTool');
              const result = await SpawnAgentTool.execute(
                {
                  team_name: teamName,
                  name,
                  prompt,
                  description: prompt.substring(0, 50) + '...',
                },
                context
              );

              return `✅ Spawned agent "${result.name}" in team "${result.team_name}"\n   ID: ${result.agent_id}`;
            } catch (error: any) {
              return `❌ ${error.message}`;
            }
          },
        },

        list: {
          description: 'List agents in a team',
          args: [{ name: 'team', description: 'Team name', required: true }],
          async execute(args: string[]) {
            const [teamName] = args;

            if (!teamName) {
              return 'Usage: /agent list <team>';
            }

            const team = await storage.getTeam(teamName);
            if (!team) {
              return `Team "${teamName}" not found`;
            }

            const members = Object.values(team.members);
            if (members.length === 0) {
              return `No agents in team "${teamName}"`;
            }

            const lines = members.map((m: any) => {
              const role = m.isLeader ? '👑 lead' : '🤝 member';
              const status = m.isActive ? 'active' : 'inactive';
              return `• ${m.name} ${role} (${status})`;
            });

            return `Team "${teamName}" Agents:\n${lines.join('\n')}`;
          },
        },

        kill: {
          description: 'Force kill an agent (emergency only)',
          args: [
            { name: 'team', description: 'Team name', required: true },
            { name: 'name', description: 'Agent name', required: true },
          ],
          async execute(args: string[]) {
            const [teamName, name] = args;

            if (!teamName || !name) {
              return 'Usage: /agent kill <team> <name>';
            }

            // In a real implementation, this would kill the sub-process
            return `⚠️ Kill agent "${name}" in team "${teamName}" - use SendMessage with shutdown_request for graceful shutdown`;
          },
        },
      },
    },
  };
}
