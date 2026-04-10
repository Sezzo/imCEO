/**
 * Core Types for OpenCode Agent Teams Plugin
 */

import type { Client, $ as BunShell } from '@opencode-ai/plugin';

// ============================================================================
// Storage Types
// ============================================================================

export interface Team {
  teamName: string;
  description?: string;
  createdAt: string;
  leadAgentId: string;
  members: Record<string, TeamMember>;
}

export interface TeamMember {
  agentId: string;
  name: string;
  agentType?: string;
  color?: string;
  model?: string;
  planModeRequired: boolean;
  isActive: boolean;
  isLeader: boolean;
  joinedAt: string;
  leftAt?: string;
  backendType: 'in_process' | 'subprocess' | 'tmux' | 'iterm2';
}

export interface Task {
  taskId: string;
  subject: string;
  description?: string;
  activeForm?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  ownerAgentId?: string;
  blockedBy: string[];
  blocks: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
}

export interface Message {
  messageId: string;
  fromAgentId: string;
  toAgentId: string;
  messageType:
    | 'text'
    | 'shutdown_request'
    | 'shutdown_response'
    | 'plan_approval_request'
    | 'plan_approval_response'
    | 'delegation_request'
    | 'delegation_response'
    | 'broadcast';
  content: string;
  summary?: string;
  isRead: boolean;
  isProcessed: boolean;
  requestId?: string;
  responseType?: 'approve' | 'reject';
  feedback?: string;
  createdAt: string;
}

export interface AgentSession {
  sessionId: string;
  agentId: string;
  agentName: string;
  teamName: string;
  prompt: string;
  status: 'running' | 'completed' | 'failed' | 'killed' | 'idle';
  executionState: string;
  awaitingPlanApproval?: boolean;
  planSubmitted?: boolean;
  planApproved?: boolean;
  shutdownRequested?: boolean;
  shutdownApproved?: boolean;
  tokenCount: number;
  startedAt?: string;
  endedAt?: string;
}

export interface Delegation {
  delegationId: string;
  fromTeam: string;
  fromAgentId: string;
  toTeam: string;
  toAgentId: string;
  taskId: string;
  subject: string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt: string;
  respondedAt?: string;
  feedback?: string;
}

// ============================================================================
// Tool Context
// ============================================================================

export interface ToolContext {
  storage: LocalStorage;
  client: Client;
  $: typeof BunShell;
  directory: string;
  worktree: string;
  logger: {
    info: (msg: string, meta?: Record<string, any>) => void;
    error: (msg: string, error?: any) => void;
    debug: (msg: string, meta?: Record<string, any>) => void;
  };
  session: {
    agentId: string;
    agentName: string;
    projectName: string;
    isUser: boolean;
    currentTeam?: string;
  };
}

// ============================================================================
// Storage Interface
// ============================================================================

export interface LocalStorage {
  initialize(): Promise<void>;

  // Teams
  saveTeam(team: Team): Promise<void>;
  getTeam(teamName: string): Promise<Team | null>;
  getAllTeams(): Promise<Team[]>;
  getTeamByLead(leadAgentId: string): Promise<Team | null>;
  deleteTeam(teamName: string): Promise<void>;

  // Tasks
  saveTask(teamName: string, task: Task): Promise<void>;
  getTasks(teamName: string): Promise<Task[]>;
  getTask(teamName: string, taskId: string): Promise<Task | null>;
  updateTask(teamName: string, taskId: string, updates: Partial<Task>): Promise<void>;
  deleteTask(teamName: string, taskId: string): Promise<void>;

  // Mailbox
  saveMessage(teamName: string, toAgent: string, message: Message): Promise<void>;
  getMessages(teamName: string, toAgent: string, unreadOnly?: boolean): Promise<Message[]>;
  markMessageRead(teamName: string, toAgent: string, messageId: string): Promise<void>;
  markMessageProcessed(teamName: string, toAgent: string, messageId: string): Promise<void>;

  // Sessions
  saveSession(session: AgentSession): Promise<void>;
  getSession(sessionId: string): Promise<AgentSession | null>;
  getActiveAgents(teamName: string): Promise<AgentSession[]>;
  updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<void>;

  // Delegations
  saveDelegation(delegation: Delegation): Promise<void>;
  getDelegations(teamName: string): Promise<Delegation[]>;
  updateDelegation(delegationId: string, updates: Partial<Delegation>): Promise<void>;

  // Notifications
  notifyTeamMembers(teamName: string): Promise<void>;
}

// ============================================================================
// Tool Input/Output Types
// ============================================================================

export interface TeamCreateInput {
  team_name: string;
  description?: string;
  agent_type?: string;
}

export interface TeamCreateOutput {
  success: boolean;
  team_name: string;
  team_id: string;
  lead_agent_id: string;
}

export interface TeamDeleteOutput {
  success: boolean;
  message: string;
  team_name?: string;
  active_members?: number;
}

export interface TaskCreateInput {
  team_name: string;
  subject: string;
  description: string;
  blocked_by?: string[];
  active_form?: string;
}

export interface TaskCreateOutput {
  task: {
    id: string;
    subject: string;
    status: string;
  };
}

export interface TaskListInput {
  team_name: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  owner?: string;
}

export interface TaskListOutput {
  tasks: Array<{
    id: string;
    subject: string;
    description?: string;
    status: string;
    ownerAgentId?: string;
    blockedBy: string[];
    isBlocked: boolean;
    canClaim: boolean;
    createdAt: string;
  }>;
  total: number;
  byStatus: Record<string, number>;
}

export interface TaskUpdateInput {
  team_name: string;
  task_id: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  owner?: string | null;
}

export interface TaskUpdateOutput {
  task: {
    id: string;
    subject: string;
    status: string;
    ownerAgentId?: string;
    previousStatus?: string;
    unblockedTasks?: string[];
  };
}

export interface SendMessageInput {
  team_name: string;
  to: string;
  message: string | StructuredMessage;
  summary?: string;
}

export type StructuredMessage =
  | { type: 'shutdown_request'; reason?: string }
  | { type: 'shutdown_response'; request_id: string; approve: boolean; reason?: string }
  | { type: 'plan_approval_request'; request_id: string; plan_content: string }
  | { type: 'plan_approval_response'; request_id: string; approve: boolean; feedback?: string }
  | {
      type: 'delegation_request';
      from_team: string;
      task_id: string;
      subject: string;
      description: string;
      artifacts?: string[];
    }
  | { type: 'delegation_response'; delegation_id: string; accept: boolean; feedback?: string };

export interface SendMessageOutput {
  success: boolean;
  message: string;
  request_id?: string;
  routing?: {
    sender: string;
    target: string;
    summary?: string;
  };
}

export interface SpawnAgentInput {
  team_name: string;
  name: string;
  prompt: string;
  description: string;
  mode?: 'default' | 'plan' | 'bypassPermissions';
  model?: 'sonnet' | 'opus' | 'haiku';
}

export interface SpawnAgentOutput {
  success: boolean;
  teammate_id: string;
  agent_id: string;
  name: string;
  team_name: string;
  color?: string;
  plan_mode_required?: boolean;
  model?: string;
  prompt: string;
}
