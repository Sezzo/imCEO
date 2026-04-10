/**
 * Team Commands - /team create, /team delete, /teams
 */

import type { LocalStorage, ToolContext } from '../core/types';

export function createTeamCommands(storage: LocalStorage, context: ToolContext) {
  return {
    team: {
      description: 'Manage agent teams',
      subcommands: {
        create: {
          description: 'Create a new team',
          args: [
            { name: 'name', description: 'Team name', required: true },
            { name: 'description', description: 'Team description', required: false },
          ],
          async execute(args: string[]) {
            const [name, ...descParts] = args;
            const description = descParts.join(' ');

            try {
              const { TeamCreateTool } = await import('../tools/TeamCreateTool');
              const result = await TeamCreateTool.execute(
                { team_name: name, description },
                context
              );
              return `✅ Created team "${result.team_name}" with lead ${result.lead_agent_id}`;
            } catch (error: any) {
              return `❌ ${error.message}`;
            }
          },
        },

        delete: {
          description: 'Delete a team',
          args: [{ name: 'name', description: 'Team name', required: true }],
          async execute(args: string[]) {
            const [name] = args;

            try {
              const { TeamDeleteTool } = await import('../tools/TeamDeleteTool');
              const result = await TeamDeleteTool.execute({ team_name: name }, context);

              if (result.success) {
                return `✅ ${result.message}`;
              } else {
                return `⚠️ ${result.message}`;
              }
            } catch (error: any) {
              return `❌ ${error.message}`;
            }
          },
        },

        list: {
          description: 'List your teams',
          args: [],
          async execute() {
            const teams = await storage.getAllTeams();

            if (teams.length === 0) {
              return 'No teams yet. Create one with: /team create <name>';
            }

            const lines = teams.map((t) => {
              const memberCount = Object.keys(t.members).length;
              return `• ${t.teamName} (${memberCount} members)${t.description ? ` - ${t.description}` : ''}`;
            });

            return `Your Teams:\n${lines.join('\n')}`;
          },
        },
      },
    },
  };
}
