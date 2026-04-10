/**
 * Teams Dashboard - /teams command
 *
 * Shows overview of all teams with interactive navigation.
 */

import type { LocalStorage, ToolContext } from '../core/types';

export function createTeamsDashboard(storage: LocalStorage, context: ToolContext) {
  return {
    teams: {
      description: 'Open Agent Teams Dashboard',
      args: [],
      async execute() {
        const teams = await storage.getAllTeams();

        if (teams.length === 0) {
          return `
┌─ Agent Teams ──────────────────────────────┐
│                                             │
│  No teams yet.                              │
│                                             │
│  Create one: /team create <name>            │
│                                             │
└─────────────────────────────────────────────┘
          `;
        }

        // Build dashboard
        const teamLines = [];

        for (const team of teams) {
          const members = Object.values(team.members);
          const activeMembers = members.filter((m: any) => m.isActive);
          const tasks = await storage.getTasks(team.teamName);
          const activeTasks = tasks.filter((t) => t.status === 'in_progress').length;

          teamLines.push(`│  📁 ${team.teamName.padEnd(40)} │`);
          teamLines.push(
            `│     ${activeMembers.length} members, ${tasks.length} tasks (${activeTasks} active)   │`
          );

          // Show recent delegations
          const delegations = await storage.getDelegations(team.teamName);
          const pendingDelegations = delegations.filter((d) => d.status === 'pending');
          if (pendingDelegations.length > 0) {
            teamLines.push(
              `│     ⚡ ${pendingDelegations.length} pending delegation(s)                │`
            );
          }

          teamLines.push(`│${' '.repeat(45)}│`);
        }

        return `
┌─ Your Agent Teams ──────────────────────────┐
│                                             │
${teamLines.join('\n')}
│                                             │
│  Commands:                                  │
│  /team create <name>                        │
│  /team delete <name>                        │
│  /agent spawn <team> <name> <prompt>        │
│  /task create <team> <subject> <desc>       │
│  /task list <team>                          │
│                                             │
└─────────────────────────────────────────────┘
        `;
      },
    },
  };
}
