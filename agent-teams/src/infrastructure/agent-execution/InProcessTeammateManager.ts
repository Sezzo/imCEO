/**
 * InProcessTeammateManager - Spawns and manages in-process teammates
 *
 * Ported from Claude Code's spawnInProcess and inProcessRunner
 * Creates and manages agent execution within the same Node.js process
 */

import { randomUUID } from 'crypto';
import { AgentRunner, AgentRunnerConfig } from './AgentRunner';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TeammateIdentity {
  agentId: string;
  agentName: string;
  teamName: string;
  color?: string;
  planModeRequired: boolean;
  parentSessionId?: string;
}

export interface SpawnTeammateConfig {
  name: string;
  teamName: string;
  prompt: string;
  description?: string;
  color?: string;
  model?: string;
  planModeRequired?: boolean;
  agentType?: string;
  allowedTools?: string[];
  invokingRequestId?: string;
}

export interface SpawnTeammateResult {
  success: boolean;
  teammateId: string;
  agentId: string;
  taskId: string;
  error?: string;
}

export interface TeammateTaskState {
  taskId: string;
  agentId: string;
  agentName: string;
  teamName: string;
  status: 'running' | 'completed' | 'failed' | 'killed' | 'idle';
  prompt: string;
  abortController: AbortController;
  abortFn?: () => void;
}

export interface InProcessManagerContext {
  prisma: any;
  webSocket: {
    publishToTeam: (teamName: string, type: string, payload: any) => Promise<void>;
    publishToAgent: (agentId: string, type: string, payload: any) => Promise<void>;
  };
  anthropicClient: any;
  toolRegistry: any;
  logger: {
    info: (msg: string, meta?: any) => void;
    debug: (msg: string, meta?: any) => void;
    error: (msg: string, err?: any) => void;
    warn: (msg: string, meta?: any) => void;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function formatAgentId(name: string, teamName: string): string {
  return `${sanitizeAgentName(name)}@${sanitizeTeamName(teamName)}`;
}

function sanitizeAgentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function assignTeammateColor(index: number = 0): string {
  const colors = [
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
  return colors[index % colors.length];
}

// ============================================================================
// InProcessTeammateManager
// ============================================================================

export class InProcessTeammateManager {
  private context: InProcessManagerContext;
  private activeTasks: Map<string, TeammateTaskState> = new Map();
  private cleanupHandlers: Map<string, () => void> = new Map();

  constructor(context: InProcessManagerContext) {
    this.context = context;
  }

  /**
   * Spawn a new in-process teammate
   */
  async spawnTeammate(config: SpawnTeammateConfig): Promise<SpawnTeammateResult> {
    const { prisma, logger } = this.context;

    // Generate deterministic agent ID
    const agentId = formatAgentId(config.name, config.teamName);
    const taskId = randomUUID();

    logger.info(`Spawning in-process teammate ${agentId}`, { taskId });

    try {
      // 1. Verify team exists
      const team = await prisma.agentTeam.findUnique({
        where: { teamName: config.teamName },
      });

      if (!team) {
        throw new Error(`Team "${config.teamName}" does not exist`);
      }

      // 2. Check for name collision
      const existingMember = await prisma.agentTeamMember.findFirst({
        where: {
          teamId: team.teamId,
          name: config.name,
        },
      });

      if (existingMember) {
        throw new Error(`Teammate "${config.name}" already exists in team "${config.teamName}"`);
      }

      // 3. Create independent AbortController
      const abortController = new AbortController();

      // 4. Create team member record
      const color = config.color || assignTeammateColor(team.members?.length || 1);

      await prisma.agentTeamMember.create({
        data: {
          teamId: team.teamId,
          agentId,
          name: config.name,
          agentType: config.agentType,
          model: config.model,
          color,
          backendType: 'in_process',
          isActive: true,
          isLeader: false,
          planModeRequired: config.planModeRequired || false,
        },
      });

      // 5. Create initial session record
      await prisma.agentTeamSession.create({
        data: {
          teamId: team.teamId,
          agentId,
          parentSessionId: config.invokingRequestId,
          prompt: config.prompt,
          description: config.description || `${config.name}: ${config.prompt.substring(0, 50)}...`,
          executionState: config.planModeRequired ? 'waiting_for_plan_approval' : 'running',
          awaitingPlanApproval: config.planModeRequired || false,
        },
      });

      // 6. Store task state
      const taskState: TeammateTaskState = {
        taskId,
        agentId,
        agentName: config.name,
        teamName: config.teamName,
        status: 'running',
        prompt: config.prompt,
        abortController,
      };

      this.activeTasks.set(taskId, taskState);

      // 7. Start agent execution (fire-and-forget)
      this.startTeammateExecution(taskState, config);

      logger.info(`Successfully spawned teammate ${agentId}`, { taskId });

      return {
        success: true,
        teammateId: agentId,
        agentId,
        taskId,
      };
    } catch (error) {
      logger.error(`Failed to spawn teammate ${agentId}`, error);

      // Cleanup on failure
      await this.cleanupFailedSpawn(agentId, config.teamName);

      return {
        success: false,
        teammateId: agentId,
        agentId,
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error during spawn',
      };
    }
  }

  /**
   * Start teammate execution loop
   */
  private async startTeammateExecution(
    taskState: TeammateTaskState,
    config: SpawnTeammateConfig
  ): Promise<void> {
    const { logger, webSocket } = this.context;
    const { taskId, agentId, agentName, teamName } = taskState;

    // Build runner config
    const runnerConfig: AgentRunnerConfig = {
      agentId,
      agentName,
      teamName,
      prompt: config.prompt,
      description: config.description,
      model: config.model,
      planModeRequired: config.planModeRequired,
      parentSessionId: config.invokingRequestId,
      allowedTools: config.allowedTools,
    };

    // Build runner context
    const runnerContext = {
      prisma: this.context.prisma,
      webSocket: this.context.webSocket,
      anthropicClient: this.context.anthropicClient,
      toolRegistry: this.context.toolRegistry,
      logger: this.context.logger,
      abortController: taskState.abortController,
    };

    try {
      // Run agent
      const result = await new AgentRunner(runnerContext, runnerConfig).run();

      // Update final state
      if (result.success) {
        taskState.status = 'completed';

        // Update member status
        await this.context.prisma.agentTeamMember.updateMany({
          where: { agentId, team: { teamName } },
          data: { isActive: false, leftAt: new Date() },
        });

        // Publish completion
        await webSocket.publishToTeam(teamName, 'agent:completed', {
          agentId,
          teamName,
          result: result.result,
          durationMs: result.durationMs,
          tokenCount: result.tokenCount,
          timestamp: new Date().toISOString(),
        });
      } else {
        taskState.status = result.error?.includes('abort') ? 'killed' : 'failed';

        await webSocket.publishToTeam(teamName, 'agent:failed', {
          agentId,
          teamName,
          error: result.error || 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error(`Teammate ${agentId} execution error`, error);
      taskState.status = 'failed';

      await webSocket.publishToTeam(teamName, 'agent:failed', {
        agentId,
        teamName,
        error: error instanceof Error ? error.message : 'Execution error',
        timestamp: new Date().toISOString(),
      });
    } finally {
      // Cleanup
      this.activeTasks.delete(taskId);
      this.cleanupHandlers.delete(taskId);
    }
  }

  /**
   * Request teammate shutdown
   */
  async requestShutdown(agentId: string, teamName: string, reason?: string): Promise<boolean> {
    const { prisma, logger, webSocket } = this.context;

    logger.info(`Requesting shutdown for ${agentId}`, { reason });

    // Find active task
    const task = Array.from(this.activeTasks.values()).find(
      (t) => t.agentId === agentId && t.teamName === teamName
    );

    if (!task) {
      logger.warn(`No active task found for ${agentId}`);
      return false;
    }

    // Update session to mark shutdown requested
    await prisma.agentTeamSession.updateMany({
      where: {
        agentId,
        team: { teamName },
      },
      data: {
        shutdownRequested: true,
      },
    });

    // Write to mailbox
    const team = await prisma.agentTeam.findUnique({ where: { teamName } });
    if (team) {
      await prisma.teamMailbox.create({
        data: {
          teamId: team.teamId,
          toAgentId: task.agentName,
          fromAgentId: 'team-lead',
          messageType: 'shutdown_request',
          content: JSON.stringify({
            type: 'shutdown_request',
            requestId: `shutdown-${agentId}-${Date.now()}`,
            reason,
            timestamp: new Date().toISOString(),
          }),
          summary: reason ? `Shutdown requested: ${reason}` : 'Shutdown requested',
          isRead: false,
          isProcessed: false,
        },
      });
    }

    // Publish event
    await webSocket.publishToTeam(teamName, 'agent:shutdown', {
      agentId,
      teamName,
      reason,
      approved: false,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Kill teammate immediately (forceful termination)
   */
  async killTeammate(agentId: string, teamName: string): Promise<boolean> {
    const { logger } = this.context;

    logger.info(`Killing teammate ${agentId}`);

    // Find active task
    const task = Array.from(this.activeTasks.values()).find(
      (t) => t.agentId === agentId && t.teamName === teamName
    );

    if (!task) {
      logger.warn(`No active task found for ${agentId}`);
      return false;
    }

    // Abort execution
    task.abortController.abort();

    // Update state
    task.status = 'killed';

    // Update database
    await this.context.prisma.agentTeamSession.updateMany({
      where: {
        agentId,
        team: { teamName },
      },
      data: {
        executionState: 'killed',
        endedAt: new Date(),
      },
    });

    await this.context.prisma.agentTeamMember.updateMany({
      where: {
        agentId,
        team: { teamName },
      },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    // Cleanup
    this.activeTasks.delete(task.taskId);

    return true;
  }

  /**
   * Check if teammate is active
   */
  isTeammateActive(agentId: string, teamName: string): boolean {
    const task = Array.from(this.activeTasks.values()).find(
      (t) => t.agentId === agentId && t.teamName === teamName
    );

    return task !== undefined && task.status === 'running';
  }

  /**
   * Get all active teammates for a team
   */
  getActiveTeammates(teamName: string): TeammateTaskState[] {
    return Array.from(this.activeTasks.values()).filter(
      (t) => t.teamName === teamName && t.status === 'running'
    );
  }

  /**
   * Get task state by ID
   */
  getTaskState(taskId: string): TeammateTaskState | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Cleanup after failed spawn
   */
  private async cleanupFailedSpawn(agentId: string, teamName: string): Promise<void> {
    try {
      // Remove member record if created
      await this.context.prisma.agentTeamMember.deleteMany({
        where: {
          agentId,
          team: { teamName },
        },
      });

      // Remove session if created
      await this.context.prisma.agentTeamSession.deleteMany({
        where: {
          agentId,
          team: { teamName },
        },
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Graceful shutdown of all active teammates
   */
  async shutdownAll(): Promise<void> {
    const { logger } = this.context;

    logger.info(`Shutting down ${this.activeTasks.size} active teammates`);

    const shutdownPromises = Array.from(this.activeTasks.values()).map(async (task) => {
      try {
        // Request graceful shutdown
        await this.requestShutdown(task.agentId, task.teamName, 'Server shutting down');

        // Wait up to 5 seconds for graceful exit
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (!this.activeTasks.has(task.taskId)) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);

          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 5000);
        });

        // Force kill if still running
        if (this.activeTasks.has(task.taskId)) {
          await this.killTeammate(task.agentId, task.teamName);
        }
      } catch (error) {
        logger.error(`Error shutting down teammate ${task.agentId}`, error);
      }
    });

    await Promise.all(shutdownPromises);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let managerInstance: InProcessTeammateManager | null = null;

export function initializeInProcessManager(
  context: InProcessManagerContext
): InProcessTeammateManager {
  if (!managerInstance) {
    managerInstance = new InProcessTeammateManager(context);
  }
  return managerInstance;
}

export function getInProcessManager(): InProcessTeammateManager | null {
  return managerInstance;
}

export async function shutdownInProcessManager(): Promise<void> {
  if (managerInstance) {
    await managerInstance.shutdownAll();
    managerInstance = null;
  }
}
