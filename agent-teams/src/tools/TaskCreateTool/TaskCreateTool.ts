/**
 * TaskCreateTool - Creates a task in the shared task list
 *
 * Ported from Claude Code's TaskCreateTool
 * Supports task dependencies and hooks validation
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TaskCreateInput {
  subject: string; // Brief title for the task
  description: string; // What needs to be done
  activeForm?: string; // Present continuous form for spinner (e.g., "Running tests")
  metadata?: Record<string, unknown>; // Arbitrbitrary metadata
  blockedBy?: string[]; // Task IDs this task depends on
}

export interface TaskCreateOutput {
  task: {
    id: string;
    subject: string;
    status: string;
  };
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
    };
  };
  webSocket: {
    publishToTeam: (teamName: string, type: string, payload: any) => Promise<void>;
  };
  executeHooks?: (params: HookExecutionParams) => Promise<HookResult[]>;
}

export interface HookExecutionParams {
  hookType: 'task_created' | 'task_completed';
  taskId: string;
  subject: string;
  description: string;
  agentName: string;
  teamName: string;
  metadata?: Record<string, unknown>;
}

export interface HookResult {
  blockingError?: string;
  warning?: string;
  success: boolean;
}

// ============================================================================
// Constants
// ============================================================================

export const TASK_CREATE_TOOL_NAME = 'TaskCreate';

// ============================================================================
// Zod Schema
// ============================================================================

export const TaskCreateInputSchema = z.object({
  subject: z.string().min(1).describe('A brief title for the task'),
  description: z.string().min(1).describe('What needs to be done'),
  activeForm: z
    .string()
    .optional()
    .describe('Present continuous form shown in spinner when in_progress (e.g., "Running tests")'),
  metadata: z.record(z.unknown()).optional().describe('Arbitrary metadata to attach to the task'),
  blockedBy: z.array(z.string()).optional().describe('Task IDs this task depends on'),
});

// ============================================================================
// Tool Implementation
// ============================================================================

export class TaskCreateTool {
  readonly name = TASK_CREATE_TOOL_NAME;
  readonly description = 'Create a task in the shared task list';
  readonly shouldDefer = true;

  /**
   * Execute the TaskCreate tool
   */
  async execute(input: TaskCreateInput, context: ToolContext): Promise<{ data: TaskCreateOutput }> {
    const { prisma, session, webSocket, executeHooks } = context;

    // Get current team from session context
    const teamName = session.teamContext?.teamName;
    if (!teamName) {
      throw new Error('No active team. Create a team with TeamCreate first.');
    }

    const team = await prisma.agentTeam.findUnique({
      where: { teamName },
    });

    if (!team) {
      throw new Error(`Team "${teamName}" not found`);
    }

    // Validate dependencies exist
    let validBlockedBy: string[] = [];
    if (input.blockedBy && input.blockedBy.length > 0) {
      const existingTasks = await prisma.agentTask.findMany({
        where: {
          taskId: { in: input.blockedBy },
          teamId: team.teamId,
        },
        select: { taskId: true },
      });

      const existingTaskIds = existingTasks.map((t: any) => t.taskId);
      validBlockedBy = input.blockedBy.filter((id) => existingTaskIds.includes(id));

      // Log warning for invalid dependencies
      const invalidDeps = input.blockedBy.filter((id) => !existingTaskIds.includes(id));
      if (invalidDeps.length > 0) {
        console.warn(`Ignoring invalid task dependencies: ${invalidDeps.join(', ')}`);
      }
    }

    // Determine initial status
    const initialStatus = validBlockedBy.length > 0 ? 'blocked' : 'pending';

    // Create task
    const task = await prisma.agentTask.create({
      data: {
        teamId: team.teamId,
        subject: input.subject,
        description: input.description,
        activeForm: input.activeForm,
        status: initialStatus,
        ownerAgentId: null,
        blockedBy: validBlockedBy,
        blocks: [],
        metadata: input.metadata || {},
        hookValidationStatus: executeHooks ? 'validating' : 'passed',
      },
    });

    // Update blocks on dependency tasks
    if (validBlockedBy.length > 0) {
      for (const depId of validBlockedBy) {
        await prisma.agentTask.update({
          where: { taskId: depId },
          data: {
            blocks: {
              push: task.taskId,
            },
          },
        });
      }
    }

    // Execute TaskCreated hooks if available
    const blockingErrors: string[] = [];
    if (executeHooks) {
      try {
        const hookResults = await executeHooks({
          hookType: 'task_created',
          taskId: task.taskId,
          subject: input.subject,
          description: input.description,
          agentName: session.agentName,
          teamName,
          metadata: input.metadata,
        });

        for (const result of hookResults) {
          if (result.blockingError) {
            blockingErrors.push(result.blockingError);
          }
        }

        // Update validation status
        await prisma.agentTask.update({
          where: { taskId: task.taskId },
          data: {
            hookValidationStatus: blockingErrors.length > 0 ? 'blocked' : 'passed',
            hookValidationErrors: blockingErrors.length > 0 ? blockingErrors.join('\n') : null,
          },
        });
      } catch (error) {
        console.error('Hook execution failed:', error);
        // Don't block task creation on hook errors
        await prisma.agentTask.update({
          where: { taskId: task.taskId },
          data: {
            hookValidationStatus: 'error',
          },
        });
      }
    }

    // If blocking errors, delete task and throw
    if (blockingErrors.length > 0) {
      await prisma.agentTask.delete({
        where: { taskId: task.taskId },
      });
      throw new Error(`Task creation blocked by hooks:\n${blockingErrors.join('\n')}`);
    }

    // Publish task created event
    await webSocket.publishToTeam(teamName, 'task:created', {
      taskId: task.taskId,
      teamName,
      subject: task.subject,
      description: task.description,
      status: task.status,
      blockedBy: validBlockedBy,
      timestamp: new Date().toISOString(),
    });

    return {
      data: {
        task: {
          id: task.taskId,
          subject: task.subject,
          status: task.status,
        },
      },
    };
  }

  /**
   * Get tool prompt/description for LLM
   */
  async getPrompt(): Promise<string> {
    return `
Create a new task in the shared task list for the current team.

## When to Use
Use this tool when:
- Breaking work into smaller, assignable units
- Creating tasks for teammates to claim
- Setting up dependencies between tasks
- Tracking progress on complex projects

## Parameters
- subject: Brief title (e.g., "Implement authentication middleware")
- description: Detailed description of what needs to be done
- activeForm: Present continuous verb phrase for UI spinner (e.g., "Implementing auth middleware")
- metadata: Optional key-value pairs for additional context
- blockedBy: Array of task IDs that must be completed first

## Task Lifecycle
1. pending → Waiting to be claimed
2. in_progress → Someone is working on it
3. completed → Done
4. blocked → Waiting on dependencies

## Task Dependencies
Use blockedBy to create task dependencies:
- Tasks with dependencies start in "blocked" status
- When all dependencies are completed, task becomes "pending"
- Prevents work on tasks that aren't ready yet

## Example Usage
1. Create foundation task:
   TaskCreate({ subject: "Setup database schema", description: "Create tables..." })

2. Create dependent task:
   TaskCreate({ 
     subject: "Implement API endpoints", 
     description: "Create REST endpoints...",
     blockedBy: ["<task-id-from-step-1>"]
   })

3. Tasks appear in the shared list, teammates can claim them
`;
  }

  /**
   * Render tool use message for UI
   */
  renderToolUseMessage(input: TaskCreateInput): string {
    return `Creating task: ${input.subject}`;
  }

  /**
   * Render tool result message for UI
   */
  renderToolResultMessage(output: TaskCreateOutput): string {
    return `Task #${output.task.id.substring(0, 8)} created: ${output.task.subject}`;
  }
}

// Export singleton instance
export const taskCreateTool = new TaskCreateTool();
