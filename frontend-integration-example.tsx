/**
 * Frontend Integration für Agent Teams in OpenCode
 *
 * Diese Datei zeigt, wie das Agent Teams Frontend in die bestehende
 * React-Struktur von OpenCode integriert wird.
 */

// ============================================================================
// 1. API CLIENT SETUP (zu frontend/src/lib/api.ts hinzufügen)
// ============================================================================

// Erweiterung der bestehenden API-Client-Konfiguration
export const agentTeamsApi = {
  // Teams
  createTeam: (data: { team_name: string; description?: string; agent_type?: string }) =>
    api.post('/teams', data),

  getTeam: (teamId: string) => api.get(`/teams/${teamId}`),

  getTeams: () => api.get('/teams'),

  deleteTeam: (teamId: string) => api.delete(`/teams/${teamId}`),

  // Tasks
  createTask: (
    teamId: string,
    data: { subject: string; description: string; blockedBy?: string[] }
  ) => api.post(`/teams/${teamId}/tasks`, data),

  getTasks: (teamId: string, params?: { status?: string; owner?: string }) =>
    api.get(`/teams/${teamId}/tasks`, { params }),

  updateTask: (teamId: string, taskId: string, data: { status?: string; owner?: string | null }) =>
    api.patch(`/teams/${teamId}/tasks/${taskId}`, data),

  // Messages
  sendMessage: (teamId: string, data: { to: string; message: string | object; summary?: string }) =>
    api.post(`/teams/${teamId}/messages`, data),

  getMessages: (teamId: string, params?: { to?: string; unread?: boolean }) =>
    api.get(`/teams/${teamId}/messages`, { params }),

  markMessageRead: (teamId: string, messageId: string) =>
    api.patch(`/teams/${teamId}/messages/${messageId}/read`),

  // Agents
  spawnAgent: (
    teamId: string,
    data: { name: string; prompt: string; description: string; mode?: string }
  ) => api.post(`/teams/${teamId}/agents`, data),

  requestShutdown: (teamId: string, agentId: string, reason?: string) =>
    api.post(`/teams/${teamId}/agents/${agentId}/shutdown`, { reason }),
};

// ============================================================================
// 2. REACT CONTEXT PROVIDER (neu erstellen: frontend/src/contexts/AgentTeamsContext.tsx)
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { agentTeamsApi } from '../lib/api';

// Types
interface Team {
  teamId: string;
  teamName: string;
  description?: string;
  leadAgentId: string;
  members: TeamMember[];
}

interface TeamMember {
  agentId: string;
  name: string;
  color?: string;
  isActive: boolean;
  isLeader: boolean;
}

interface Task {
  taskId: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  ownerAgentId?: string;
  blockedBy: string[];
  isBlocked: boolean;
  canClaim: boolean;
}

interface AgentTeamsContextType {
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;
  members: TeamMember[];
  tasks: Task[];
  isLoading: boolean;
  isConnected: boolean;
  unreadCount: number;
  refreshTasks: () => Promise<void>;
  claimTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  createTask: (subject: string, description: string) => Promise<void>;
  sendMessage: (to: string, message: string, summary?: string) => Promise<void>;
  spawnAgent: (name: string, prompt: string, description: string) => Promise<void>;
}

const AgentTeamsContext = createContext<AgentTeamsContextType | undefined>(undefined);

// WebSocket URL aus Umgebung
const WS_URL = import.meta.env.VITE_AGENT_TEAMS_WS_URL || 'ws://localhost:3001';

export const AgentTeamsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket Connection
  useEffect(() => {
    if (!currentTeam) return;

    const ws = new WebSocket(`${WS_URL}?team=${currentTeam.teamName}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Agent Teams WebSocket connected');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('Agent Teams WebSocket disconnected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketEvent(data);
    };

    return () => ws.close();
  }, [currentTeam?.teamName]);

  // Event Handler
  const handleWebSocketEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'task:created':
      case 'task:claimed':
      case 'task:completed':
      case 'task:blocked':
      case 'task:unblocked':
        refreshTasks();
        break;
      case 'message:received':
        setUnreadCount((prev) => prev + 1);
        break;
    }
  }, []);

  // API Actions
  const refreshTasks = useCallback(async () => {
    if (!currentTeam) return;
    setIsLoading(true);
    try {
      const { data } = await agentTeamsApi.getTasks(currentTeam.teamId);
      setTasks(data.data.tasks);
    } catch (error) {
      console.error('Failed to refresh tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTeam]);

  const claimTask = useCallback(
    async (taskId: string) => {
      if (!currentTeam) return;
      await agentTeamsApi.updateTask(currentTeam.teamId, taskId, { status: 'in_progress' });
      await refreshTasks();
    },
    [currentTeam, refreshTasks]
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      if (!currentTeam) return;
      await agentTeamsApi.updateTask(currentTeam.teamId, taskId, { status: 'completed' });
      await refreshTasks();
    },
    [currentTeam, refreshTasks]
  );

  const createTask = useCallback(
    async (subject: string, description: string) => {
      if (!currentTeam) return;
      await agentTeamsApi.createTask(currentTeam.teamId, { subject, description });
      await refreshTasks();
    },
    [currentTeam, refreshTasks]
  );

  const sendMessage = useCallback(
    async (to: string, message: string, summary?: string) => {
      if (!currentTeam) return;
      await agentTeamsApi.sendMessage(currentTeam.teamId, { to, message, summary });
    },
    [currentTeam]
  );

  const spawnAgent = useCallback(
    async (name: string, prompt: string, description: string) => {
      if (!currentTeam) return;
      await agentTeamsApi.spawnAgent(currentTeam.teamId, { name, prompt, description });
    },
    [currentTeam]
  );

  const value: AgentTeamsContextType = {
    currentTeam,
    setCurrentTeam,
    members,
    tasks,
    isLoading,
    isConnected,
    unreadCount,
    refreshTasks,
    claimTask,
    completeTask,
    createTask,
    sendMessage,
    spawnAgent,
  };

  return <AgentTeamsContext.Provider value={value}>{children}</AgentTeamsContext.Provider>;
};

export const useAgentTeams = () => {
  const context = useContext(AgentTeamsContext);
  if (!context) throw new Error('useAgentTeams must be used within AgentTeamsProvider');
  return context;
};

// ============================================================================
// 3. ROUTE KONFIGURATION (zu frontend/src/App.tsx oder Router-Config hinzufügen)
// ============================================================================

/**
 * import { AgentTeamsProvider } from './contexts/AgentTeamsContext';
 * import { TeamDashboard } from './pages/teams/TeamDashboard';
 *
 * function App() {
 *   return (
 *     <AgentTeamsProvider>
 *       <BrowserRouter>
 *         <Routes>
 *           ... bestehende Routes ...
 *
 *           // NEU: Agent Teams Routes
 *           <Route path="/teams" element={<TeamsListPage />} />
 *           <Route path="/teams/:teamId" element={<TeamDashboard />} />
 *         </Routes>
 *       </BrowserRouter>
 *     </AgentTeamsProvider>
 *   );
 * }
 */

// ============================================================================
// 4. TEAM DASHBOARD PAGE (neu erstellen: frontend/src/pages/teams/TeamDashboard.tsx)
// ============================================================================

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAgentTeams } from '../../contexts/AgentTeamsContext';
import { TaskList } from '../../components/teams/TaskList';
import { TeamHeader } from '../../components/teams/TeamHeader';
import { MemberList } from '../../components/teams/MemberList';

export function TeamDashboard() {
  const { teamId } = useParams<{ teamId: string }>();
  const { currentTeam, setCurrentTeam, members, isConnected, refreshTasks } = useAgentTeams();

  // Load team data
  useEffect(() => {
    if (teamId) {
      agentTeamsApi.getTeam(teamId).then(({ data }) => {
        setCurrentTeam(data.data);
        refreshTasks();
      });
    }
  }, [teamId]);

  if (!currentTeam) {
    return <div className="p-8 text-center">Loading team...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <TeamHeader team={currentTeam} isConnected={isConnected} memberCount={members.length} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Task List */}
        <div className="w-1/3 bg-white border-r border-gray-200 overflow-hidden">
          <TaskList />
        </div>

        {/* Center: Activity */}
        <div className="flex-1 bg-white overflow-hidden">
          <ActivityFeed teamId={teamId!} />
        </div>

        {/* Right: Members */}
        <div className="w-64 bg-gray-50 border-l border-gray-200 overflow-y-auto">
          <MemberList members={members} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. ENVIRONMENT VARIABLES (zu frontend/.env hinzufügen)
// ============================================================================

/**
 * VITE_AGENT_TEAMS_WS_URL=ws://localhost:3001
 * VITE_API_URL=http://localhost:3000/api/v1
 */

// ============================================================================
// 6. NAVIGATION ERWEITERUNG (zu bestehender Navigation hinzufügen)
// ============================================================================

/**
 * // In der Sidebar oder Navigation
 * <NavLink to="/teams" icon={UsersIcon}>
 *   Agent Teams
 *   {unreadCount > 0 && (
 *     <Badge>{unreadCount}</Badge>
 *   )}
 * </NavLink>
 */

// ============================================================================
// 7. TYPESCRIPT TYPES (frontend/src/types/agent-teams.ts)
// ============================================================================

export interface CreateTeamRequest {
  team_name: string;
  description?: string;
  agent_type?: string;
}

export interface CreateTeamResponse {
  team_name: string;
  team_id: string;
  lead_agent_id: string;
}

export interface CreateTaskRequest {
  subject: string;
  description: string;
  blockedBy?: string[];
}

export interface SpawnAgentRequest {
  name: string;
  prompt: string;
  description: string;
  mode?: 'default' | 'plan' | 'bypassPermissions';
}

export interface SendMessageRequest {
  to: string;
  message: string | object;
  summary?: string;
}

// ============================================================================
// 8. TAILWIND CONFIG (falls nötig erweitern)
// ============================================================================

/**
 * Keine Änderungen nötig - verwendet bestehende Tailwind-Konfiguration
 *
 * Optional: Custom Colors für Agent Teams
 * colors: {
 *   'team': {
 *     50: '#f0f9ff',
 *     100: '#e0f2fe',
 *     500: '#0ea5e9',
 *     600: '#0284c7',
 *   }
 * }
 */
