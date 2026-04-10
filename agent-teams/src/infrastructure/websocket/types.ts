import type { WebSocket } from 'ws';
import type { EventEmitter } from 'events';

/**
 * WebSocket Event Types for Agent Teams
 * Real-time communication between agents and UI
 */

export interface AgentTeamWebSocketEvents {
  // Agent lifecycle events
  'agent:spawned': {
    agentId: string;
    agentName: string;
    teamName: string;
    color: string;
    timestamp: string;
  };

  'agent:progress': {
    agentId: string;
    teamName: string;
    toolName?: string;
    description: string;
    status: 'running' | 'completed' | 'error';
    tokenCount?: number;
    timestamp: string;
  };

  'agent:completed': {
    agentId: string;
    teamName: string;
    result: string;
    durationMs: number;
    tokenCount: number;
    timestamp: string;
  };

  'agent:failed': {
    agentId: string;
    teamName: string;
    error: string;
    timestamp: string;
  };

  'agent:idle': {
    agentId: string;
    teamName: string;
    timestamp: string;
  };

  'agent:shutdown': {
    agentId: string;
    teamName: string;
    reason?: string;
    approved: boolean;
    timestamp: string;
  };

  // Task events
  'task:created': {
    taskId: string;
    teamName: string;
    subject: string;
    description?: string;
    status: string;
    timestamp: string;
  };

  'task:claimed': {
    taskId: string;
    teamName: string;
    agentId: string;
    agentName: string;
    timestamp: string;
  };

  'task:completed': {
    taskId: string;
    teamName: string;
    agentId: string;
    result?: string;
    timestamp: string;
  };

  'task:blocked': {
    taskId: string;
    teamName: string;
    blockedBy: string[];
    reason?: string;
    timestamp: string;
  };

  'task:unblocked': {
    taskId: string;
    teamName: string;
    timestamp: string;
  };

  // Message events
  'message:received': {
    messageId: string;
    teamName: string;
    fromAgentId: string;
    fromAgentName: string;
    toAgentId: string;
    summary?: string;
    content?: string;
    messageType: string;
    timestamp: string;
  };

  'message:broadcast': {
    teamName: string;
    fromAgentId: string;
    fromAgentName: string;
    summary: string;
    content?: string;
    timestamp: string;
  };

  'message:read': {
    messageId: string;
    teamName: string;
    readAt: string;
  };

  // Plan approval events
  'plan:submitted': {
    agentId: string;
    teamName: string;
    planContent: string;
    requestId: string;
    timestamp: string;
  };

  'plan:approved': {
    agentId: string;
    teamName: string;
    requestId: string;
    feedback?: string;
    timestamp: string;
  };

  'plan:rejected': {
    agentId: string;
    teamName: string;
    requestId: string;
    feedback: string;
    timestamp: string;
  };

  // Team lifecycle events
  'team:created': {
    teamId: string;
    teamName: string;
    leadAgentId: string;
    timestamp: string;
  };

  'team:deleted': {
    teamId: string;
    teamName: string;
    reason?: string;
    timestamp: string;
  };

  'team:cleanup': {
    teamName: string;
    activeMembers: number;
    timestamp: string;
  };

  // Session events
  'session:state_changed': {
    sessionId: string;
    agentId: string;
    teamName: string;
    fromState: string;
    toState: string;
    timestamp: string;
  };

  'session:error': {
    sessionId: string;
    agentId: string;
    teamName: string;
    error: string;
    timestamp: string;
  };
}

/**
 * Client subscription types
 */
export type SubscriptionType =
  | `team:${string}` // Subscribe to specific team
  | `agent:${string}` // Subscribe to specific agent
  | 'global'; // Subscribe to all events

/**
 * WebSocket message envelope
 */
export interface WebSocketMessage<T = unknown> {
  type: keyof AgentTeamWebSocketEvents;
  payload: T;
  timestamp: string;
  id: string; // Unique message ID for deduplication
}

/**
 * Client connection state
 */
export interface ClientConnection {
  id: string;
  socket: WebSocket;
  subscriptions: Set<SubscriptionType>;
  connectedAt: Date;
  lastPingAt: Date;
  metadata?: {
    userId?: string;
    teamName?: string;
    agentId?: string;
  };
}

/**
 * WebSocket server configuration
 */
export interface WebSocketServerConfig {
  port: number;
  path: string;
  pingIntervalMs: number;
  pongTimeoutMs: number;
  maxConnections: number;
  enableCompression: boolean;
}

/**
 * Event publisher interface for broadcasting
 */
export interface IEventPublisher {
  publish<K extends keyof AgentTeamWebSocketEvents>(
    type: K,
    payload: AgentTeamWebSocketEvents[K]
  ): Promise<void>;

  publishToTeam<K extends keyof AgentTeamWebSocketEvents>(
    teamName: string,
    type: K,
    payload: AgentTeamWebSocketEvents[K]
  ): Promise<void>;

  publishToAgent<K extends keyof AgentTeamWebSocketEvents>(
    agentId: string,
    type: K,
    payload: AgentTeamWebSocketEvents[K]
  ): Promise<void>;
}

/**
 * WebSocket authentication result
 */
export interface WebSocketAuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  totalConnections: number;
  connectionsByTeam: Record<string, number>;
  connectionsByAgent: Record<string, number>;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
}
