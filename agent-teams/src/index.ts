/**
 * Agent Teams Module - Main Entry Point
 *
 * Claude Code Agent Teams Feature Port for OpenCode
 *
 * This module provides:
 * - Team management (TeamCreateTool, TeamDeleteTool)
 * - Task coordination (TaskCreateTool, TaskListTool, TaskGetTool, TaskUpdateTool)
 * - Inter-agent messaging (SendMessageTool)
 * - Agent spawning and execution (AgentTool, AgentRunner, InProcessTeammateManager)
 * - Real-time communication (WebSocketServer)
 *
 * Usage:
 * ```typescript
 * import { initializeAgentTeams } from './agent-teams';
 *
 * const agentTeams = initializeAgentTeams({
 *   prisma,
 *   anthropicClient,
 *   toolRegistry,
 *   logger,
 * });
 *
 * // Register Fastify routes
 * await fastify.register(agentTeamRoutes, { prefix: '/api/v1' });
 * ```
 */

// Export tools
export { TeamCreateTool, teamCreateTool } from './tools/TeamCreateTool/TeamCreateTool';
export { TeamDeleteTool, teamDeleteTool } from './tools/TeamDeleteTool/TeamDeleteTool';
export { TaskCreateTool, taskCreateTool } from './tools/TaskCreateTool/TaskCreateTool';
export { TaskListTool, taskListTool } from './tools/TaskListTool/TaskListTool';
export { TaskGetTool, taskGetTool } from './tools/TaskGetTool/TaskGetTool';
export { TaskUpdateTool, taskUpdateTool } from './tools/TaskUpdateTool/TaskUpdateTool';
export { SendMessageTool, sendMessageTool } from './tools/SendMessageTool/SendMessageTool';
export { AgentTool, agentTool } from './tools/AgentTool/AgentTool';

// Export infrastructure
export { AgentRunner, runAgent } from './infrastructure/agent-execution/AgentRunner';
export {
  InProcessTeammateManager,
  initializeInProcessManager,
  getInProcessManager,
  shutdownInProcessManager,
} from './infrastructure/agent-execution/InProcessTeammateManager';

export {
  AgentTeamWebSocketServer,
  initializeWebSocketServer,
  getWebSocketServer,
  stopWebSocketServer,
} from './infrastructure/websocket/WebSocketServer';

export type {
  AgentTeamWebSocketEvents,
  WebSocketMessage,
  ClientConnection,
  SubscriptionType,
  IEventPublisher,
} from './infrastructure/websocket/types';

// Export routes
export { agentTeamRoutes } from './interface/http/routes/agent-team.routes';

// Export types
export type {
  TeamCreateInput,
  TeamCreateOutput,
  TeamDeleteInput,
  TeamDeleteOutput,
} from './tools/TeamCreateTool/TeamCreateTool';

export type {
  TaskCreateInput,
  TaskCreateOutput,
  TaskListInput,
  TaskListOutput,
  TaskGetInput,
  TaskGetOutput,
  TaskUpdateInput,
  TaskUpdateOutput,
} from './tools/TaskCreateTool/TaskCreateTool';

export type {
  SendMessageInput,
  SendMessageOutput,
  StructuredMessage,
  MessageType,
  ResponseType,
} from './tools/SendMessageTool/SendMessageTool';

export type {
  AgentToolInput,
  AgentToolOutput,
  TeammateSpawnedOutput,
} from './tools/AgentTool/AgentTool';

export type {
  AgentRunnerConfig,
  AgentExecutionResult,
  AgentContext,
  ToolContext,
  Tool,
  ToolResult,
  Message,
  ContentBlock,
} from './infrastructure/agent-execution/AgentRunner';

export type {
  SpawnTeammateConfig,
  SpawnTeammateResult,
  TeammateIdentity,
  InProcessManagerContext,
} from './infrastructure/agent-execution/InProcessTeammateManager';

// ============================================================================
// Initialization
// ============================================================================

import type { PrismaClient } from '@prisma/client';
import { initializeWebSocketServer } from './infrastructure/websocket/WebSocketServer';
import { initializeInProcessManager } from './infrastructure/agent-execution/InProcessTeammateManager';

export interface AgentTeamsConfig {
  prisma: PrismaClient;
  anthropicClient: any;
  toolRegistry: any;
  logger?: {
    info: (msg: string, meta?: any) => void;
    debug: (msg: string, meta?: any) => void;
    error: (msg: string, err?: any) => void;
    warn: (msg: string, meta?: any) => void;
  };
  webSocketPort?: number;
}

export interface AgentTeamsInstance {
  webSocketServer: ReturnType<typeof initializeWebSocketServer>;
  inProcessManager: ReturnType<typeof initializeInProcessManager>;
}

/**
 * Initialize the Agent Teams module
 */
export function initializeAgentTeams(config: AgentTeamsConfig): AgentTeamsInstance {
  const logger = config.logger || console;

  // Initialize WebSocket server
  const webSocketServer = initializeWebSocketServer({
    port: config.webSocketPort || 3001,
    path: '/ws/agent-teams',
  });

  // Initialize in-process manager
  const inProcessManager = initializeInProcessManager({
    prisma: config.prisma,
    webSocket: webSocketServer,
    anthropicClient: config.anthropicClient,
    toolRegistry: config.toolRegistry,
    logger,
  });

  logger.info('Agent Teams module initialized', {
    webSocketPort: config.webSocketPort || 3001,
  });

  return {
    webSocketServer,
    inProcessManager,
  };
}

/**
 * Graceful shutdown of Agent Teams module
 */
export async function shutdownAgentTeams(): Promise<void> {
  const manager = getInProcessManager();
  if (manager) {
    await manager.shutdownAll();
  }

  await stopWebSocketServer();
}
