/**
 * Team Manager Service
 *
 * Core service for managing agent teams:
 * - Team creation and lifecycle
 * - Agent management
 * - Task assignment and tracking
 * - Event coordination
 */

import { randomUUID } from 'crypto';
import { QueryEngine } from '../../QueryEngine.js';
import type { Tools } from '../../Tool.js';
import { logForDebugging } from '../../utils/debug.js';
import type {
  Agent,
  AgentConfig,
  CreateTeamRequest,
  CreateTeamResponse,
  Task,
  TaskPriority,
  TaskResult,
  TaskStatus,
  Team,
  TeamConfig,
  TeamDefaults,
  TeamEvent,
  TeamEventHandler,
  TeamEventType,
  TeamPolicies,
  TeamSessionState,
  TeamStatus,
  TeamStatusResponse,
} from './types.js';

export class TeamManager {
  private state: TeamSessionState;

  constructor() {
    this.state = {
      teams: new Map(),
      activeExecutions: new Map(),
      messageRoutes: [],
      eventHandlers: new Set(),
      defaults: {
        coordinatorModel: 'opencode-opus-4',
        workerModel: 'opencode-sonnet-4',
        maxParallelAgents: 5,
        defaultTimeout: 600000, // 10 minutes
        enableSharedContext: true,
        enableMessageRouting: true,
      },
      policies: {
        maxRetries: 3,
        allowAgentToAgentCommunication: true,
        broadcastCompletedTasks: true,
        autoRetryFailedTasks: false,
        requireReviewerForCode: false,
      },
    };
  }

  /**
   * Create a new agent team
   */
  async createTeam(request: CreateTeamRequest, tools: Tools): Promise<CreateTeamResponse> {
    const teamId = randomUUID();
    const sessionId = randomUUID();

    logForDebugging(`[TeamManager] Creating team: ${request.name} (${teamId})`);

    // Create agent configurations with IDs
    const agentConfigs: AgentConfig[] = request.agents.map((agent, index) => ({
      ...agent,
      id: `agent-${index}-${randomUUID().slice(0, 8)}`,
      role: agent.role || 'worker',
      tools: agent.tools || [],
    }));

    // Create team configuration
    const teamConfig: TeamConfig = {
      id: teamId,
      name: request.name,
      description: request.description,
      coordinatorModel: request.coordinatorModel || this.state.defaults.coordinatorModel,
      coordinatorSystemPrompt: this.getDefaultCoordinatorPrompt(),
      agents: agentConfigs,
      maxParallelAgents: this.state.defaults.maxParallelAgents,
      enableMessageRouting: this.state.defaults.enableMessageRouting,
      sharedContext: this.state.defaults.enableSharedContext,
    };

    // Create the team
    const team: Team = {
      config: teamConfig,
      agents: new Map(),
      status: 'initializing',
      sessionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Initialize agents
    const agents: Agent[] = [];
    for (const config of agentConfigs) {
      const agent = await this.initializeAgent(config, teamId, tools);
      team.agents.set(config.id, agent);
      agents.push(agent);
    }

    // Initialize coordinator agent
    const coordinatorConfig: AgentConfig = {
      id: `coordinator-${randomUUID().slice(0, 8)}`,
      name: 'Coordinator',
      role: 'coordinator',
      model: teamConfig.coordinatorModel,
      systemPrompt: teamConfig.coordinatorSystemPrompt || this.getDefaultCoordinatorPrompt(),
      tools: [], // Coordinator doesn't use tools directly
      description: 'Team coordinator that plans and delegates tasks',
    };

    const coordinator = await this.initializeAgent(coordinatorConfig, teamId, tools);
    team.coordinator = coordinator;
    team.agents.set(coordinator.id, coordinator);

    // Update status
    team.status = 'ready';
    this.state.teams.set(teamId, team);

    // Emit event
    this.emitEvent({
      type: 'team_created',
      timestamp: new Date(),
      teamId,
      data: { agentCount: agents.length },
    });

    logForDebugging(`[TeamManager] Team created: ${teamId} with ${agents.length} agents`);

    return {
      team,
      agents,
      sessionId,
    };
  }

  /**
   * Initialize an agent with its QueryEngine
   */
  private async initializeAgent(config: AgentConfig, teamId: string, tools: Tools): Promise<Agent> {
    // Filter tools based on agent's allowed tools
    const agentTools = this.filterToolsForAgent(tools, config.tools);

    // Create QueryEngine for this agent
    const engine = new QueryEngine({
      tools: agentTools,
      systemPrompt: config.systemPrompt,
      model: config.model,
    });

    return {
      config,
      engine,
      status: 'idle',
      taskHistory: [],
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Filter tools based on agent configuration
   */
  private filterToolsForAgent(allTools: Tools, allowedToolNames: string[]): Tools {
    if (!allowedToolNames || allowedToolNames.length === 0) {
      return allTools;
    }

    const filtered: Tools = {};
    for (const [name, tool] of Object.entries(allTools)) {
      if (allowedToolNames.includes(name)) {
        filtered[name] = tool;
      }
    }
    return filtered;
  }

  /**
   * Get the default system prompt for the coordinator
   */
  private getDefaultCoordinatorPrompt(): string {
    return `You are the coordinator of an AI agent team. Your responsibilities:

1. Plan complex tasks and break them down into subtasks
2. Assign tasks to appropriate team members based on their skills
3. Monitor progress and handle dependencies between tasks
4. Synthesize results from multiple agents
5. Make high-level decisions about execution strategy

When planning:
- Break complex tasks into 2-5 concrete subtasks
- Consider dependencies (what needs to happen first)
- Assign to agents based on their role and capabilities
- Set clear expectations for each subtask

Available agent roles:
- worker: General-purpose task execution
- reviewer: Code review, quality assurance
- specialist: Domain-specific expertise

Always provide clear, actionable instructions.`;
  }

  /**
   * Get a team by ID
   */
  getTeam(teamId: string): Team | undefined {
    return this.state.teams.get(teamId);
  }

  /**
   * Get all teams
   */
  getAllTeams(): Team[] {
    return Array.from(this.state.teams.values());
  }

  /**
   * Get team status summary
   */
  getTeamStatus(teamId: string): TeamStatusResponse | undefined {
    const team = this.state.teams.get(teamId);
    if (!team) return undefined;

    const agents = Array.from(team.agents.values());
    const allTasks = agents.flatMap((a) => a.taskHistory);
    const activeTasks = agents.filter((a) => a.status === 'running').length;

    return {
      teamId,
      status: team.status,
      agents: agents.map((a) => ({
        id: a.config.id,
        name: a.config.name,
        role: a.config.role,
        status: a.status,
        currentTask: a.currentTask?.id,
      })),
      activeTasks,
      completedTasks: allTasks.filter((t) => t.status === 'completed').length,
      failedTasks: allTasks.filter((t) => t.status === 'failed').length,
    };
  }

  /**
   * Disband a team
   */
  async disbandTeam(teamId: string): Promise<void> {
    const team = this.state.teams.get(teamId);
    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }

    logForDebugging(`[TeamManager] Disbanding team: ${teamId}`);

    // Stop all running agents
    for (const agent of team.agents.values()) {
      if (agent.status === 'running') {
        agent.status = 'blocked';
        // Cancel any running tasks
        if (agent.engine) {
          // QueryEngine cancellation would go here
        }
      }
    }

    team.status = 'disbanded';
    team.updatedAt = new Date();

    // Remove from state after a delay to allow cleanup
    setTimeout(() => {
      this.state.teams.delete(teamId);
    }, 60000); // 1 minute delay

    this.emitEvent({
      type: 'team_disbanded',
      timestamp: new Date(),
      teamId,
    });

    logForDebugging(`[TeamManager] Team disbanded: ${teamId}`);
  }

  /**
   * Create a task for the team
   */
  createTask(
    teamId: string,
    title: string,
    description: string,
    options: {
      priority?: TaskPriority;
      assignedTo?: string;
      dependencies?: string[];
      context?: string;
      timeout?: number;
    } = {}
  ): Task {
    const team = this.state.teams.get(teamId);
    if (!team) {
      throw new Error(`Team not found: ${teamId}`);
    }

    const task: Task = {
      id: `task-${randomUUID().slice(0, 8)}`,
      teamId,
      title,
      description,
      priority: options.priority || 'medium',
      status: 'queued',
      assignedTo: options.assignedTo,
      dependencies: options.dependencies,
      context: options.context,
      timeout: options.timeout || this.state.defaults.defaultTimeout,
      createdAt: new Date(),
    };

    // If assigned to a specific agent, update their current task
    if (options.assignedTo) {
      const agent = team.agents.get(options.assignedTo);
      if (agent) {
        agent.currentTask = task;
      }
    }

    this.emitEvent({
      type: 'task_created',
      timestamp: new Date(),
      teamId,
      data: { taskId: task.id, title, assignedTo: options.assignedTo },
    });

    logForDebugging(`[TeamManager] Task created: ${task.id} for team ${teamId}`);

    return task;
  }

  /**
   * Assign a task to an agent
   */
  async assignTask(task: Task, agentId: string): Promise<void> {
    const team = this.state.teams.get(task.teamId);
    if (!team) {
      throw new Error(`Team not found: ${task.teamId}`);
    }

    const agent = team.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (agent.status === 'running') {
      throw new Error(`Agent ${agentId} is already busy`);
    }

    task.assignedTo = agentId;
    task.status = 'assigned';
    agent.currentTask = task;
    agent.status = 'assigned';
    agent.updatedAt = new Date();

    this.emitEvent({
      type: 'task_assigned',
      timestamp: new Date(),
      teamId: task.teamId,
      agentId,
      data: { taskId: task.id },
    });

    logForDebugging(`[TeamManager] Task ${task.id} assigned to agent ${agentId}`);
  }

  /**
   * Update task status
   */
  updateTaskStatus(teamId: string, taskId: string, status: TaskStatus, result?: TaskResult): void {
    const team = this.state.teams.get(teamId);
    if (!team) return;

    // Find the task in any agent's current task
    for (const agent of team.agents.values()) {
      if (agent.currentTask?.id === taskId) {
        agent.currentTask.status = status;

        if (status === 'completed' || status === 'failed') {
          agent.currentTask.completedAt = new Date();

          if (result) {
            agent.taskHistory.push(result);
          }

          agent.status = 'idle';
          agent.currentTask = undefined;
          agent.updatedAt = new Date();

          this.emitEvent({
            type: status === 'completed' ? 'task_completed' : 'task_failed',
            timestamp: new Date(),
            teamId,
            agentId: agent.config.id,
            data: { taskId, result },
          });
        }

        break;
      }
    }
  }

  /**
   * Get an agent by ID
   */
  getAgent(teamId: string, agentId: string): Agent | undefined {
    const team = this.state.teams.get(teamId);
    if (!team) return undefined;
    return team.agents.get(agentId);
  }

  /**
   * Get all agents in a team
   */
  getTeamAgents(teamId: string): Agent[] {
    const team = this.state.teams.get(teamId);
    if (!team) return [];
    return Array.from(team.agents.values());
  }

  /**
   * Get available (idle) agents
   */
  getAvailableAgents(teamId: string): Agent[] {
    const team = this.state.teams.get(teamId);
    if (!team) return [];
    return Array.from(team.agents.values()).filter((a) => a.status === 'idle');
  }

  /**
   * Subscribe to team events
   */
  onEvent(handler: TeamEventHandler): () => void {
    this.state.eventHandlers.add(handler);
    return () => {
      this.state.eventHandlers.delete(handler);
    };
  }

  /**
   * Emit an event to all subscribers
   */
  private emitEvent(event: TeamEvent): void {
    for (const handler of this.state.eventHandlers) {
      try {
        void handler(event);
      } catch (error) {
        logForDebugging(`[TeamManager] Event handler error: ${error}`);
      }
    }
  }

  /**
   * Update team status
   */
  updateTeamStatus(teamId: string, status: TeamStatus): void {
    const team = this.state.teams.get(teamId);
    if (!team) return;

    team.status = status;
    team.updatedAt = new Date();
  }

  /**
   * Get default configuration
   */
  getDefaults(): TeamDefaults {
    return { ...this.state.defaults };
  }

  /**
   * Get policies
   */
  getPolicies(): TeamPolicies {
    return { ...this.state.policies };
  }

  /**
   * Update policies
   */
  updatePolicies(policies: Partial<TeamPolicies>): void {
    this.state.policies = { ...this.state.policies, ...policies };
  }
}

// Export singleton instance
export const teamManager = new TeamManager();
