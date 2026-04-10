/**
 * Team Session Types
 *
 * Type definitions for Agent Teams functionality.
 * Supports hierarchical team structures, parallel execution, and message routing.
 */

import type { BetaMessage, BetaToolUnion } from '../../types/anthropic-compat.js';
import type { QueryEngine } from '../../QueryEngine.js';

// ============================================================================
// Agent Types
// ============================================================================

export type AgentRole = 'coordinator' | 'worker' | 'reviewer' | 'specialist';

export type AgentStatus =
  | 'idle'
  | 'assigned'
  | 'running'
  | 'waiting'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'killed';

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  model: string;
  systemPrompt: string;
  tools: string[]; // Tool names this agent can use
  parentId?: string; // For hierarchical teams (null = reports to coordinator)
  description?: string;
  maxConcurrentTasks?: number;
  timeout?: number; // milliseconds
  metadata?: Record<string, unknown>;
}

export interface Agent {
  config: AgentConfig;
  engine?: QueryEngine; // The QueryEngine instance for this agent
  status: AgentStatus;
  currentTask?: Task;
  taskHistory: TaskResult[];
  messages: BetaMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Team Types
// ============================================================================

export interface TeamConfig {
  id: string;
  name: string;
  description?: string;
  coordinatorModel: string; // Model for the coordinator agent
  coordinatorSystemPrompt?: string;
  agents: AgentConfig[];
  maxParallelAgents?: number;
  enableMessageRouting?: boolean;
  sharedContext?: boolean; // Whether agents share message history
  metadata?: Record<string, unknown>;
}

export interface Team {
  config: TeamConfig;
  coordinator?: Agent;
  agents: Map<string, Agent>;
  status: TeamStatus;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TeamStatus =
  | 'initializing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'disbanded';

// ============================================================================
// Task Types
// ============================================================================

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type TaskStatus =
  | 'queued'
  | 'assigned'
  | 'running'
  | 'waiting'
  | 'blocked'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Task {
  id: string;
  teamId: string;
  parentTaskId?: string; // For subtasks
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string; // Agent ID
  dependencies?: string[]; // Task IDs that must complete first
  subtasks?: string[]; // Child task IDs
  context?: string; // Additional context for the agent
  maxSteps?: number;
  timeout?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  status: 'completed' | 'failed' | 'cancelled';
  output?: string;
  artifacts?: TaskArtifact[];
  messages: BetaMessage[];
  tokenUsage?: {
    input: number;
    output: number;
  };
  error?: string;
  duration: number; // milliseconds
  completedAt: Date;
}

export interface TaskArtifact {
  id: string;
  type: 'file' | 'code' | 'text' | 'data';
  name: string;
  content: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Message & Communication Types
// ============================================================================

export type MessageType =
  | 'task_assignment'
  | 'task_result'
  | 'status_update'
  | 'question'
  | 'answer'
  | 'broadcast'
  | 'direct_message'
  | 'coordination';

export interface AgentMessage {
  id: string;
  type: MessageType;
  from: string; // Agent ID
  to?: string; // Agent ID (undefined = broadcast)
  timestamp: Date;
  content: string;
  metadata?: {
    taskId?: string;
    urgency?: 'low' | 'normal' | 'high';
    requiresResponse?: boolean;
  };
}

export interface MessageRoute {
  fromAgentId: string;
  toAgentId: string;
  pattern: string; // Regex or keyword pattern for auto-routing
  priority: number;
}

// ============================================================================
// Execution Types
// ============================================================================

export type ExecutionStrategy = 'sequential' | 'parallel' | 'hierarchical';

export interface ExecutionPlan {
  id: string;
  teamId: string;
  strategy: ExecutionStrategy;
  tasks: Task[];
  dependencies: Map<string, string[]>; // taskId -> dependent taskIds
  estimatedDuration?: number;
  createdAt: Date;
}

export interface ExecutionContext {
  teamId: string;
  planId: string;
  sharedMemory: Map<string, unknown>;
  cancellationToken: AbortController;
  checkpoint?: unknown; // For resuming execution
}

// ============================================================================
// Event Types
// ============================================================================

export type TeamEventType =
  | 'team_created'
  | 'team_disbanded'
  | 'agent_joined'
  | 'agent_left'
  | 'agent_status_changed'
  | 'task_created'
  | 'task_assigned'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'message_sent'
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'error';

export interface TeamEvent {
  type: TeamEventType;
  timestamp: Date;
  teamId: string;
  agentId?: string;
  taskId?: string;
  data?: Record<string, unknown>;
}

export type TeamEventHandler = (event: TeamEvent) => void | Promise<void>;

// ============================================================================
// Configuration Types
// ============================================================================

export interface TeamDefaults {
  coordinatorModel: string;
  workerModel: string;
  maxParallelAgents: number;
  defaultTimeout: number;
  enableSharedContext: boolean;
  enableMessageRouting: boolean;
}

export interface TeamPolicies {
  requireReviewerForCode?: boolean;
  autoRetryFailedTasks?: boolean;
  maxRetries: number;
  allowAgentToAgentCommunication: boolean;
  broadcastCompletedTasks: boolean;
}

// ============================================================================
// Session State
// ============================================================================

export interface TeamSessionState {
  teams: Map<string, Team>;
  activeExecutions: Map<string, ExecutionContext>;
  messageRoutes: MessageRoute[];
  eventHandlers: Set<TeamEventHandler>;
  defaults: TeamDefaults;
  policies: TeamPolicies;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface CreateTeamRequest {
  name: string;
  description?: string;
  agents: Omit<AgentConfig, 'id'>[];
  coordinatorModel?: string;
}

export interface CreateTeamResponse {
  team: Team;
  agents: Agent[];
  sessionId: string;
}

export interface AssignTaskRequest {
  title: string;
  description: string;
  priority?: TaskPriority;
  assignedTo?: string;
  dependencies?: string[];
  context?: string;
}

export interface TeamStatusResponse {
  teamId: string;
  status: TeamStatus;
  agents: {
    id: string;
    name: string;
    role: AgentRole;
    status: AgentStatus;
    currentTask?: string;
  }[];
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type AgentFilter = {
  roles?: AgentRole[];
  statuses?: AgentStatus[];
  availableOnly?: boolean;
};

export type TaskFilter = {
  statuses?: TaskStatus[];
  priorities?: TaskPriority[];
  assignedTo?: string;
  includeSubtasks?: boolean;
};

export interface TeamMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  totalTokensUsed: {
    input: number;
    output: number;
  };
  agentUtilization: Map<string, number>; // agentId -> percentage
}
