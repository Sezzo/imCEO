/**
 * Task Commands - /task create, /task list, /task claim, /task complete
 */

import type { LocalStorage, ToolContext } from '../core/types';

export function createTaskCommands(storage: LocalStorage, context: ToolContext) {
  return {
    task: {
      description: 'Manage tasks',
      subcommands: {
        create: {
          description: 'Create a new task',
          args: [
            { name: 'team', description: 'Team name', required: true },
            { name: 'subject', description: 'Task title', required: true },
            { name: 'description', description: 'Task details', required: true },
          ],
          async execute(args: string[]) {
            const [teamName, subject, ...descParts] = args;
            const description = descParts.join(' ');

            if (!teamName || !subject || !description) {
              return 'Usage: /task create <team> <subject> <description>';
            }

            try {
              const { TaskCreateTool } = await import('../tools/TaskCreateTool');
              const result = await TaskCreateTool.execute(
                { team_name: teamName, subject, description },
                context
              );

              return `✅ Created task "${result.task.subject}" (${result.task.status})\n   ID: ${result.task.id}`;
            } catch (error: any) {
              return `❌ ${error.message}`;
            }
          },
        },

        list: {
          description: 'List tasks in a team',
          args: [
            { name: 'team', description: 'Team name', required: true },
            { name: 'status', description: 'Filter by status', required: false },
          ],
          async execute(args: string[]) {
            const [teamName, status] = args;

            if (!teamName) {
              return 'Usage: /task list <team> [status]';
            }

            try {
              const { TaskListTool } = await import('../tools/TaskListTool');
              const result = await TaskListTool.execute(
                { team_name: teamName, status: status as any },
                context
              );

              if (result.tasks.length === 0) {
                return `No tasks in team "${teamName}"`;
              }

              const lines = result.tasks.map((t) => {
                const statusEmoji =
                  {
                    pending: '⏳',
                    in_progress: '🔵',
                    completed: '✅',
                    blocked: '🚫',
                  }[t.status] || '⚪';

                const claimable = t.canClaim ? ' [claimable]' : '';
                const owner = t.ownerAgentId ? ` (${t.ownerAgentId})` : '';

                return `${statusEmoji} ${t.subject}${owner}${claimable}`;
              });

              return `Tasks in "${teamName}":\n${lines.join('\n')}\n\nTotal: ${result.total}`;
            } catch (error: any) {
              return `❌ ${error.message}`;
            }
          },
        },

        claim: {
          description: 'Claim a task',
          args: [
            { name: 'team', description: 'Team name', required: true },
            { name: 'task_id', description: 'Task ID', required: true },
          ],
          async execute(args: string[]) {
            const [teamName, taskId] = args;

            if (!teamName || !taskId) {
              return 'Usage: /task claim <team> <task_id>';
            }

            try {
              const { TaskUpdateTool } = await import('../tools/TaskUpdateTool');
              const result = await TaskUpdateTool.execute(
                { team_name: teamName, task_id: taskId, status: 'in_progress' },
                context
              );

              return `✅ Claimed task "${result.task.subject}"`;
            } catch (error: any) {
              return `❌ ${error.message}`;
            }
          },
        },

        complete: {
          description: 'Complete a task',
          args: [
            { name: 'team', description: 'Team name', required: true },
            { name: 'task_id', description: 'Task ID', required: true },
          ],
          async execute(args: string[]) {
            const [teamName, taskId] = args;

            if (!teamName || !taskId) {
              return 'Usage: /task complete <team> <task_id>';
            }

            try {
              const { TaskUpdateTool } = await import('../tools/TaskUpdateTool');
              const result = await TaskUpdateTool.execute(
                { team_name: teamName, task_id: taskId, status: 'completed' },
                context
              );

              let msg = `✅ Completed task "${result.task.subject}"`;
              if (result.task.unblockedTasks?.length) {
                msg += `\n   Unblocked ${result.task.unblockedTasks.length} dependent task(s)`;
              }
              return msg;
            } catch (error: any) {
              return `❌ ${error.message}`;
            }
          },
        },
      },
    },
  };
}
