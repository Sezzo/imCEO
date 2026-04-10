import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * Agent Teams Context - React Context for Agent Teams state management
 */

// ============================================================================
// Types
// ============================================================================

export interface Team {
  teamId: string;
  teamName: string;
  description?: string;
  leadAgentId: string;
  currentState: string;
  members: TeamMember[];
}

export interface TeamMember {
  agentId: string;
  name: string;
  agentType?: string;
  color?: string;
  isActive: boolean;
  isLeader: boolean;
  planModeRequired: boolean;
}

export interface Task {
  taskId: string;
  subject: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  ownerAgentId?: string;
  ownerAgentName?: string;
  blockedBy: string[];
  blocks: string[];
  isBlocked: boolean;
  canClaim: boolean;
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
}

export interface Message {
  messageId: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  messageType: string;
  content: string;
  summary?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AgentSession {
  sessionId: string;
  agentId: string;
  agentName: string;
  executionState: string;
  awaitingPlanApproval?: boolean;
  planSubmitted?: boolean;
  planApproved?: boolean;
  accumulatedTokens: number;
  startedAt?: string;
}

interface AgentTeamsContextType {
  // Current team
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;

  // Members
  members: TeamMember[];
  setMembers: (members: TeamMember[]) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  refreshTasks: () => Promise<void>;

  // Messages
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  unreadCount: number;

  // Sessions
  sessions: AgentSession[];
  setSessions: (sessions: AgentSession[]) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Actions
  claimTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  sendMessage: (to: string, message: string, summary?: string) => Promise<void>;
  createTask: (subject: string, description: string) => Promise<void>;
  spawnAgent: (name: string, prompt: string, description: string) => Promise<void>;

  // WebSocket
  isConnected: boolean;
  lastEvent: any | null;
}

// ============================================================================
// Context
// ============================================================================

const AgentTeamsContext = createContext<AgentTeamsContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

export interface AgentTeamsProviderProps {
  children: React.ReactNode;
  apiBaseUrl: string;
  webSocketUrl: string;
}

export function AgentTeamsProvider({
  children,
  apiBaseUrl,
  webSocketUrl,
}: AgentTeamsProviderProps) {
  // State
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<any | null>(null);

  // WebSocket ref
  const wsRef = React.useRef<WebSocket | null>(null);

  // Computed
  const unreadCount = messages.filter((m) => !m.isRead && m.toAgentId === 'team-lead').length;

  // ============================================================================
  // WebSocket Connection
  // ============================================================================

  useEffect(() => {
    if (!currentTeam) return;

    const ws = new WebSocket(`${webSocketUrl}?team=${currentTeam.teamName}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to Agent Teams WebSocket');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('Disconnected from Agent Teams WebSocket');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastEvent(data);
      handleWebSocketEvent(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [currentTeam?.teamName, webSocketUrl]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleWebSocketEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'team:created':
        // Refresh team data
        break;

      case 'task:created':
        setTasks((prev) => [event.payload, ...prev]);
        break;

      case 'task:claimed':
      case 'task:completed':
      case 'task:blocked':
      case 'task:unblocked':
        refreshTasks();
        break;

      case 'message:received':
      case 'message:broadcast':
        setMessages((prev) => [event.payload, ...prev]);
        break;

      case 'agent:spawned':
      case 'agent:completed':
      case 'agent:failed':
      case 'agent:shutdown':
        refreshSessions();
        break;

      case 'plan:submitted':
      case 'plan:approved':
      case 'plan:rejected':
        refreshSessions();
        break;
    }
  }, []);

  // ============================================================================
  // API Actions
  // ============================================================================

  const refreshTasks = useCallback(async () => {
    if (!currentTeam) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/teams/${currentTeam.teamId}/tasks`);
      const data = await response.json();
      if (data.success) {
        setTasks(data.data.tasks);
      }
    } catch (error) {
      console.error('Failed to refresh tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTeam, apiBaseUrl]);

  const refreshSessions = useCallback(async () => {
    // Implementation would fetch sessions from API
  }, [currentTeam, apiBaseUrl]);

  const claimTask = useCallback(
    async (taskId: string) => {
      if (!currentTeam) return;

      try {
        const response = await fetch(`${apiBaseUrl}/teams/${currentTeam.teamId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'in_progress' }),
        });

        if (!response.ok) throw new Error('Failed to claim task');
        await refreshTasks();
      } catch (error) {
        console.error('Failed to claim task:', error);
        throw error;
      }
    },
    [currentTeam, apiBaseUrl, refreshTasks]
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      if (!currentTeam) return;

      try {
        const response = await fetch(`${apiBaseUrl}/teams/${currentTeam.teamId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        });

        if (!response.ok) throw new Error('Failed to complete task');
        await refreshTasks();
      } catch (error) {
        console.error('Failed to complete task:', error);
        throw error;
      }
    },
    [currentTeam, apiBaseUrl, refreshTasks]
  );

  const sendMessage = useCallback(
    async (to: string, message: string, summary?: string) => {
      if (!currentTeam) return;

      try {
        const response = await fetch(`${apiBaseUrl}/teams/${currentTeam.teamId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, message, summary }),
        });

        if (!response.ok) throw new Error('Failed to send message');
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    },
    [currentTeam, apiBaseUrl]
  );

  const createTask = useCallback(
    async (subject: string, description: string) => {
      if (!currentTeam) return;

      try {
        const response = await fetch(`${apiBaseUrl}/teams/${currentTeam.teamId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, description }),
        });

        if (!response.ok) throw new Error('Failed to create task');
        await refreshTasks();
      } catch (error) {
        console.error('Failed to create task:', error);
        throw error;
      }
    },
    [currentTeam, apiBaseUrl, refreshTasks]
  );

  const spawnAgent = useCallback(
    async (name: string, prompt: string, description: string) => {
      if (!currentTeam) return;

      try {
        const response = await fetch(`${apiBaseUrl}/teams/${currentTeam.teamId}/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, prompt, description }),
        });

        if (!response.ok) throw new Error('Failed to spawn agent');
      } catch (error) {
        console.error('Failed to spawn agent:', error);
        throw error;
      }
    },
    [currentTeam, apiBaseUrl]
  );

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: AgentTeamsContextType = {
    currentTeam,
    setCurrentTeam,
    members,
    setMembers,
    tasks,
    setTasks,
    refreshTasks,
    messages,
    setMessages,
    unreadCount,
    sessions,
    setSessions,
    isLoading,
    setIsLoading,
    claimTask,
    completeTask,
    sendMessage,
    createTask,
    spawnAgent,
    isConnected,
    lastEvent,
  };

  return <AgentTeamsContext.Provider value={value}>{children}</AgentTeamsContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAgentTeams(): AgentTeamsContextType {
  const context = useContext(AgentTeamsContext);
  if (context === undefined) {
    throw new Error('useAgentTeams must be used within an AgentTeamsProvider');
  }
  return context;
}

export function useCurrentTeam(): Team | null {
  const { currentTeam } = useAgentTeams();
  return currentTeam;
}

export function useTeamTasks(): { tasks: Task[]; refresh: () => Promise<void> } {
  const { tasks, refreshTasks } = useAgentTeams();
  return { tasks, refresh: refreshTasks };
}

export function useTeamMessages(): { messages: Message[]; unreadCount: number } {
  const { messages, unreadCount } = useAgentTeams();
  return { messages, unreadCount };
}
