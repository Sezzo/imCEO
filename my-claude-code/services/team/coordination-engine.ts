/**
 * Team Coordination Engine
 *
 * Coordinates task execution across agent teams:
 * - Task planning and decomposition
 * - Execution strategy selection
 * - Parallel vs sequential execution
 * - Result synthesis
 * - Conflict resolution
 */

import { randomUUID } from 'crypto';
import { QueryEngine } from '../../QueryEngine.js';
import { logForDebugging } from '../../utils/debug.js';
import type {
  Agent,
  ExecutionContext,
  ExecutionPlan,
  ExecutionStrategy,
  Task,
  TaskArtifact,
  TaskPriority,
  TaskResult,
  TaskStatus,
  Team,
  TeamEvent,
} from './types.js';
import { teamManager } from './team-manager.js';
import { agentRouter } from './agent-router.js';

interface PlannedTask {
  title: string;
  description: string;
  role: 'coordinator' | 'worker' | 'reviewer' | 'specialist';
  dependencies?: number[]; // Indices of tasks this depends on
  estimatedDuration?: number; // minutes
  priority: TaskPriority;
}

interface ExecutionResult {
  success: boolean;
  results: Map<string, TaskResult>;
  artifacts: TaskArtifact[];
  summary: string;
  duration: number;
  errors?: string[];
}

export class TeamCoordinationEngine {
  /**
   * Generate an execution plan from a high-level goal
   */
  async generatePlan(
    team: Team,
    goal: string,
    strategy: ExecutionStrategy = 'hierarchical'
  ): Promise<ExecutionPlan> {
    const coordinator = team.coordinator;
    if (!coordinator || !coordinator.engine) {
      throw new Error('Team has no coordinator or coordinator has no engine');
    }

    logForDebugging(`[CoordinationEngine] Generating plan for: ${goal}`);

    // Use coordinator to plan the approach
    const planPrompt = `I need to achieve the following goal:

${goal}

Please break this down into 2-5 concrete subtasks. For each subtask:
1. Title (short, clear)
2. Description (what needs to be done)
3. Role needed (worker, reviewer, or specialist)
4. Dependencies (which other subtasks must complete first, if any)
5. Priority (low, medium, high, critical)
6. Estimated duration in minutes

Return the plan as a JSON array with this structure:
[
  {
    "title": "...",
    "description": "...",
    "role": "worker|reviewer|specialist",
    "dependencies": [0, 1],
    "estimatedDuration": 15,
    "priority": "high"
  }
]`;

    // Submit to coordinator's engine
    const stream = coordinator.engine.submitMessage(planPrompt);
    let response = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && 'text' in event.delta) {
        response += event.delta.text;
      }
    }

    // Parse the plan from response
    let plannedTasks: PlannedTask[];
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        plannedTasks = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (error) {
      logForDebugging(`[CoordinationEngine] Failed to parse plan: ${error}`);
      // Fallback: create a simple single-task plan
      plannedTasks = [
        {
          title: 'Execute Goal',
          description: goal,
          role: 'worker',
          priority: 'medium',
          estimatedDuration: 30,
        },
      ];
    }

    // Create tasks from plan
    const tasks: Task[] = [];
    const taskIdMap = new Map<number, string>(); // Maps plan index to task ID

    for (let i = 0; i < plannedTasks.length; i++) {
      const planned = plannedTasks[i];
      const task = teamManager.createTask(team.config.id, planned.title, planned.description, {
        priority: planned.priority,
        context: goal,
        timeout: (planned.estimatedDuration || 30) * 60 * 1000, // Convert to ms
      });
      tasks.push(task);
      taskIdMap.set(i, task.id);
    }

    // Map dependencies
    for (let i = 0; i < plannedTasks.length; i++) {
      const planned = plannedTasks[i];
      const task = tasks[i];

      if (planned.dependencies && planned.dependencies.length > 0) {
        task.dependencies = planned.dependencies
          .map((idx) => taskIdMap.get(idx))
          .filter((id): id is string => id !== undefined);
      }

      // Find best agent for this task
      const bestAgent = this.findBestAgentForTask(team, planned);
      if (bestAgent) {
        task.assignedTo = bestAgent.config.id;
      }
    }

    // Create execution plan
    const plan: ExecutionPlan = {
      id: `plan-${randomUUID().slice(0, 8)}`,
      teamId: team.config.id,
      strategy,
      tasks,
      dependencies: this.buildDependencyGraph(tasks),
      estimatedDuration: plannedTasks.reduce((sum, t) => sum + (t.estimatedDuration || 30), 0),
      createdAt: new Date(),
    };

    logForDebugging(`[CoordinationEngine] Plan created with ${tasks.length} tasks`);

    return plan;
  }

  /**
   * Execute a plan
   */
  async executePlan(
    plan: ExecutionPlan,
    team: Team,
    onProgress?: (event: TeamEvent) => void
  ): Promise<ExecutionResult> {
    logForDebugging(
      `[CoordinationEngine] Executing plan: ${plan.id} with strategy ${plan.strategy}`
    );

    teamManager.updateTeamStatus(plan.teamId, 'running');

    const startTime = Date.now();
    const results = new Map<string, TaskResult>();
    const errors: string[] = [];
    const artifacts: TaskArtifact[] = [];

    try {
      let completedTasks: Task[] = [];

      switch (plan.strategy) {
        case 'sequential':
          completedTasks = await this.executeSequential(plan, team, results, onProgress);
          break;
        case 'parallel':
          completedTasks = await this.executeParallel(plan, team, results, onProgress);
          break;
        case 'hierarchical':
        default:
          completedTasks = await this.executeHierarchical(plan, team, results, onProgress);
          break;
      }

      // Collect artifacts
      for (const result of results.values()) {
        if (result.artifacts) {
          artifacts.push(...result.artifacts);
        }
      }

      // Generate summary
      const summary = await this.generateExecutionSummary(team, plan, completedTasks, results);

      teamManager.updateTeamStatus(plan.teamId, 'completed');

      return {
        success: errors.length === 0,
        results,
        artifacts,
        summary,
        duration: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      teamManager.updateTeamStatus(plan.teamId, 'failed');

      return {
        success: false,
        results,
        artifacts,
        summary: `Execution failed: ${error}`,
        duration: Date.now() - startTime,
        errors: [...errors, String(error)],
      };
    }
  }

  /**
   * Execute tasks sequentially (one after another)
   */
  private async executeSequential(
    plan: ExecutionPlan,
    team: Team,
    results: Map<string, TaskResult>,
    onProgress?: (event: TeamEvent) => void
  ): Promise<Task[]> {
    const completed: Task[] = [];

    // Sort tasks by dependencies
    const sortedTasks = this.topologicalSort(plan.tasks);

    for (const task of sortedTasks) {
      // Check if dependencies are satisfied
      if (task.dependencies && task.dependencies.length > 0) {
        const unmetDeps = task.dependencies.filter((depId) => !results.has(depId));
        if (unmetDeps.length > 0) {
          throw new Error(`Unmet dependencies for task ${task.id}: ${unmetDeps.join(', ')}`);
        }
      }

      // Execute task
      const result = await this.executeTask(task, team, results);
      results.set(task.id, result);
      completed.push(task);

      if (onProgress) {
        onProgress({
          type: result.status === 'completed' ? 'task_completed' : 'task_failed',
          timestamp: new Date(),
          teamId: team.config.id,
          taskId: task.id,
          data: { result },
        });
      }
    }

    return completed;
  }

  /**
   * Execute tasks in parallel where possible
   */
  private async executeParallel(
    plan: ExecutionPlan,
    team: Team,
    results: Map<string, TaskResult>,
    onProgress?: (event: TeamEvent) => void
  ): Promise<Task[]> {
    const completed: Task[] = [];
    const pending = new Set<Task>(plan.tasks);
    const inProgress = new Set<Task>();

    while (pending.size > 0 || inProgress.size > 0) {
      // Find tasks that are ready (dependencies met)
      const readyTasks = Array.from(pending).filter((task) => {
        if (!task.dependencies || task.dependencies.length === 0) return true;
        return task.dependencies.every((depId) => results.has(depId));
      });

      // Start executing ready tasks
      for (const task of readyTasks) {
        if (inProgress.size >= (team.config.maxParallelAgents || 5)) break;

        pending.delete(task);
        inProgress.add(task);

        // Execute task asynchronously
        this.executeTask(task, team, results).then((result) => {
          results.set(task.id, result);
          completed.push(task);
          inProgress.delete(task);

          if (onProgress) {
            onProgress({
              type: result.status === 'completed' ? 'task_completed' : 'task_failed',
              timestamp: new Date(),
              teamId: team.config.id,
              taskId: task.id,
              data: { result },
            });
          }
        });
      }

      // Wait a bit before checking again
      if (pending.size > 0 || inProgress.size > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return completed;
  }

  /**
   * Execute tasks hierarchically (coordinator manages workers)
   */
  private async executeHierarchical(
    plan: ExecutionPlan,
    team: Team,
    results: Map<string, TaskResult>,
    onProgress?: (event: TeamEvent) => void
  ): Promise<Task[]> {
    // Similar to parallel but with coordinator oversight
    const completed: Task[] = [];
    const pending = new Set<Task>(plan.tasks);
    const coordinator = team.coordinator;

    // Coordinator broadcasts plan to team
    if (coordinator) {
      await agentRouter.sendCoordinationMessage(
        coordinator,
        `Starting execution plan with ${plan.tasks.length} tasks. Strategy: hierarchical.`,
        team,
        { urgency: 'normal' }
      );
    }

    // Execute in waves based on dependencies
    while (pending.size > 0) {
      const readyTasks = Array.from(pending).filter((task) => {
        if (!task.dependencies || task.dependencies.length === 0) return true;
        return task.dependencies.every((depId) => results.has(depId));
      });

      if (readyTasks.length === 0 && pending.size > 0) {
        throw new Error('Circular dependency detected or no tasks ready');
      }

      // Execute current wave
      const waveResults = await Promise.all(
        readyTasks.map(async (task) => {
          pending.delete(task);

          // Send task assignment
          const agent = team.agents.get(task.assignedTo || '');
          if (coordinator && agent) {
            await agentRouter.sendTaskAssignment(
              coordinator,
              agent,
              task.title,
              task.description,
              task.context
            );
          }

          const result = await this.executeTask(task, team, results);
          results.set(task.id, result);
          completed.push(task);

          if (onProgress) {
            onProgress({
              type: result.status === 'completed' ? 'task_completed' : 'task_failed',
              timestamp: new Date(),
              teamId: team.config.id,
              taskId: task.id,
              data: { result },
            });
          }

          return result;
        })
      );

      // Coordinator reviews wave results
      if (coordinator && coordinator.engine) {
        const waveSummary = waveResults.map((r) => `${r.taskId}: ${r.status}`).join(', ');
        const reviewPrompt = `Wave completed. Results: ${waveSummary}. Continue or adjust plan?`;

        const stream = coordinator.engine.submitMessage(reviewPrompt);
        // We don't need the response, just triggering the thought process
        for await (const _ of stream) {
          /* consume stream */
        }
      }
    }

    return completed;
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: Task,
    team: Team,
    previousResults: Map<string, TaskResult>
  ): Promise<TaskResult> {
    const startTime = Date.now();

    const agentId = task.assignedTo;
    if (!agentId) {
      return {
        taskId: task.id,
        agentId: 'none',
        status: 'failed',
        error: 'Task has no assigned agent',
        messages: [],
        duration: 0,
        completedAt: new Date(),
      };
    }

    const agent = team.agents.get(agentId);
    if (!agent || !agent.engine) {
      return {
        taskId: task.id,
        agentId,
        status: 'failed',
        error: 'Agent or engine not found',
        messages: [],
        duration: 0,
        completedAt: new Date(),
      };
    }

    // Update agent status
    agent.status = 'running';
    agent.currentTask = task;
    task.status = 'running';
    task.startedAt = new Date();

    teamManager.emitEvent({
      type: 'task_started',
      timestamp: new Date(),
      teamId: team.config.id,
      agentId,
      data: { taskId: task.id },
    });

    try {
      // Build context from previous results
      let context = task.context || '';
      if (task.dependencies && task.dependencies.length > 0) {
        const depResults = task.dependencies
          .map((depId) => previousResults.get(depId))
          .filter((r): r is TaskResult => r !== undefined);

        if (depResults.length > 0) {
          context += '\n\nResults from previous tasks:\n';
          context += depResults.map((r) => `- ${r.taskId}: ${r.output || 'No output'}`).join('\n');
        }
      }

      // Execute using agent's QueryEngine
      const prompt = `${task.description}\n\n${context ? `Context:\n${context}` : ''}`;

      const stream = agent.engine.submitMessage(prompt);
      const messages: unknown[] = [];
      let output = '';
      let tokenUsage = { input: 0, output: 0 };

      for await (const event of stream) {
        messages.push(event);

        if (event.type === 'content_block_delta' && 'text' in event.delta) {
          output += event.delta.text;
        }

        if (event.type === 'message_stop' && 'usage' in event) {
          const usage = (event as any).usage;
          if (usage) {
            tokenUsage = {
              input: usage.input_tokens || 0,
              output: usage.output_tokens || 0,
            };
          }
        }
      }

      // Update agent status
      agent.status = 'idle';
      agent.currentTask = undefined;
      agent.taskHistory.push({
        taskId: task.id,
        agentId,
        status: 'completed',
        output,
        messages: messages as any,
        tokenUsage,
        duration: Date.now() - startTime,
        completedAt: new Date(),
      });

      task.status = 'completed';
      task.completedAt = new Date();

      return {
        taskId: task.id,
        agentId,
        status: 'completed',
        output,
        messages: messages as any,
        tokenUsage,
        duration: Date.now() - startTime,
        completedAt: new Date(),
      };
    } catch (error) {
      agent.status = 'idle';
      agent.currentTask = undefined;

      task.status = 'failed';

      return {
        taskId: task.id,
        agentId,
        status: 'failed',
        error: String(error),
        messages: [],
        duration: Date.now() - startTime,
        completedAt: new Date(),
      };
    }
  }

  /**
   * Find the best agent for a task
   */
  private findBestAgentForTask(team: Team, plannedTask: PlannedTask): Agent | undefined {
    const availableAgents = Array.from(team.agents.values()).filter(
      (a) => a.status === 'idle' && a.config.role === plannedTask.role
    );

    if (availableAgents.length === 0) {
      // Fallback: any agent with matching role, even if busy
      const roleAgents = Array.from(team.agents.values()).filter(
        (a) => a.config.role === plannedTask.role
      );
      return roleAgents[0];
    }

    // Could add more sophisticated selection here (load balancing, etc.)
    return availableAgents[0];
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(tasks: Task[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const task of tasks) {
      graph.set(task.id, task.dependencies || []);
    }

    return graph;
  }

  /**
   * Topological sort of tasks based on dependencies
   */
  private topologicalSort(tasks: Task[]): Task[] {
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (task: Task) => {
      if (visiting.has(task.id)) {
        throw new Error(`Circular dependency detected involving task ${task.id}`);
      }

      if (visited.has(task.id)) return;

      visiting.add(task.id);

      if (task.dependencies) {
        for (const depId of task.dependencies) {
          const dep = tasks.find((t) => t.id === depId);
          if (dep) visit(dep);
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      sorted.push(task);
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        visit(task);
      }
    }

    return sorted;
  }

  /**
   * Generate execution summary
   */
  private async generateExecutionSummary(
    team: Team,
    plan: ExecutionPlan,
    completedTasks: Task[],
    results: Map<string, TaskResult>
  ): Promise<string> {
    const coordinator = team.coordinator;
    if (!coordinator || !coordinator.engine) {
      // Fallback summary
      const successCount = Array.from(results.values()).filter(
        (r) => r.status === 'completed'
      ).length;
      return `Execution complete. ${successCount}/${plan.tasks.length} tasks succeeded.`;
    }

    const summaryPrompt = `The execution plan has completed. Here are the results:

Tasks: ${completedTasks.length} total
Completed: ${Array.from(results.values()).filter((r) => r.status === 'completed').length}
Failed: ${Array.from(results.values()).filter((r) => r.status === 'failed').length}

Results:
${Array.from(results.values())
  .map((r) => `- ${r.taskId}: ${r.status}`)
  .join('\n')}

Please provide a concise summary (2-3 sentences) of what was accomplished.`;

    const stream = coordinator.engine.submitMessage(summaryPrompt);
    let summary = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && 'text' in event.delta) {
        summary += event.delta.text;
      }
    }

    return summary || 'Execution completed.';
  }

  /**
   * Handle conflicts between agents
   */
  async resolveConflict(
    team: Team,
    conflictingResults: TaskResult[],
    originalTask: Task
  ): Promise<TaskResult> {
    const coordinator = team.coordinator;
    if (!coordinator || !coordinator.engine) {
      // Simple resolution: take first successful result
      const firstSuccess = conflictingResults.find((r) => r.status === 'completed');
      if (firstSuccess) return firstSuccess;
      return conflictingResults[0];
    }

    const conflictPrompt = `Multiple agents have completed the task "${originalTask.title}" with different results:

${conflictingResults.map((r, i) => `Agent ${i + 1} (${r.agentId}):\n${r.output || 'No output'}`).join('\n\n')}

Please synthesize these results into a single coherent answer. Consider:
1. Which result best addresses the task requirements?
2. Are there complementary aspects we can combine?
3. Is there a conflict that needs resolution?

Provide your synthesized result.`;

    const stream = coordinator.engine.submitMessage(conflictPrompt);
    let synthesis = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && 'text' in event.delta) {
        synthesis += event.delta.text;
      }
    }

    return {
      taskId: originalTask.id,
      agentId: coordinator.config.id,
      status: 'completed',
      output: synthesis,
      messages: [],
      duration: conflictingResults.reduce((sum, r) => sum + r.duration, 0),
      completedAt: new Date(),
    };
  }
}

// Export singleton instance
export const coordinationEngine = new TeamCoordinationEngine();
