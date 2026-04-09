import { useState, useEffect } from 'react';
import {
  Monitor,
  Activity,
  Users,
  Clock,
  Cpu,
  DollarSign,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Square,
  RefreshCw,
  Filter,
  Search,
  MoreHorizontal,
  Terminal,
  MessageSquare,
  ArrowRight,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';

export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'terminated';
export type AgentStatus = 'online' | 'busy' | 'offline' | 'error';

interface AgentActivity {
  activityId: string;
  type: 'thinking' | 'action' | 'message' | 'tool_call' | 'error' | 'completion';
  message: string;
  timestamp: string;
  metadata?: object;
}

interface SessionAgent {
  agentId: string;
  agentName: string;
  role: string;
  status: AgentStatus;
  currentTask?: string;
  progress: number;
  cost: number;
  activities: AgentActivity[];
}

interface Session {
  sessionId: string;
  name: string;
  description?: string;
  status: SessionStatus;
  companyId: string;
  teamId?: string;
  workItemId?: string;
  workItemTitle?: string;
  agents: SessionAgent[];
  startedAt: string;
  endedAt?: string;
  cost: number;
  budget: number;
  messageCount: number;
  lastActivityAt: string;
  createdBy: string;
}

interface SessionMonitorProps {
  sessions: Session[];
  onViewSession: (sessionId: string) => void;
  onPauseSession: (sessionId: string) => void;
  onResumeSession: (sessionId: string) => void;
  onTerminateSession: (sessionId: string) => void;
  onRefresh: () => void;
}

const SESSION_STATUS_CONFIG: Record<SessionStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  idle: { label: 'Idle', color: 'text-gray-700', bg: 'bg-gray-100', icon: <Clock className="w-4 h-4" /> },
  running: { label: 'Running', color: 'text-green-700', bg: 'bg-green-100', icon: <Play className="w-4 h-4" /> },
  paused: { label: 'Paused', color: 'text-amber-700', bg: 'bg-amber-100', icon: <Pause className="w-4 h-4" /> },
  completed: { label: 'Completed', color: 'text-blue-700', bg: 'bg-blue-100', icon: <CheckCircle className="w-4 h-4" /> },
  error: { label: 'Error', color: 'text-red-700', bg: 'bg-red-100', icon: <XCircle className="w-4 h-4" /> },
  terminated: { label: 'Terminated', color: 'text-gray-700', bg: 'bg-gray-200', icon: <Square className="w-4 h-4" /> },
};

const AGENT_STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  online: { label: 'Online', color: 'text-green-700', bg: 'bg-green-100' },
  busy: { label: 'Busy', color: 'text-blue-700', bg: 'bg-blue-100' },
  offline: { label: 'Offline', color: 'text-gray-700', bg: 'bg-gray-100' },
  error: { label: 'Error', color: 'text-red-700', bg: 'bg-red-100' },
};

export function SessionMonitor({
  sessions,
  onViewSession,
  onPauseSession,
  onResumeSession,
  onTerminateSession,
  onRefresh,
}: SessionMonitorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<SessionStatus | 'all'>('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      !searchTerm ||
      session.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.workItemTitle?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || session.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const runningCount = sessions.filter((s) => s.status === 'running').length;
  const errorCount = sessions.filter((s) => s.status === 'error').length;
  const totalCost = sessions.reduce((sum, s) => sum + s.cost, 0);

  // Auto refresh
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(onRefresh, 5000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, onRefresh]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-6xl h-[85vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Monitor className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Session Monitor</h2>
            <p className="text-sm text-gray-500">
              {runningCount} running • {errorCount} errors • {sessions.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" />
              {errorCount} sessions need attention
            </div>
          )}
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
              isAutoRefresh
                ? 'bg-violet-100 text-violet-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <RefreshCw className={clsx('w-4 h-4', isAutoRefresh && 'animate-spin')} />
            Auto-refresh
          </button>
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Session List */}
        <div className={clsx(
          'border-r border-gray-200 flex flex-col transition-all',
          selectedSession ? 'w-80' : 'w-full'
        )}>
          {/* Filters */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as SessionStatus | 'all')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
              >
                <option value="all">All Statuses</option>
                {Object.entries(SESSION_STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-12">
                <Monitor className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No sessions found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredSessions.map((session) => {
                  const statusConfig = SESSION_STATUS_CONFIG[session.status];
                  const isActive = selectedSession?.sessionId === session.sessionId;

                  return (
                    <div
                      key={session.sessionId}
                      onClick={() => setSelectedSession(session)}
                      className={clsx(
                        'p-4 cursor-pointer transition-colors',
                        isActive ? 'bg-violet-50 border-l-4 border-violet-500' : 'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={clsx('p-1.5 rounded', statusConfig.bg)}>
                            {statusConfig.icon}
                          </div>
                          <span className={clsx('text-xs font-medium', statusConfig.color)}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
                        </span>
                      </div>

                      <h4 className="font-medium text-gray-900 mb-1">{session.name}</h4>
                      {session.workItemTitle && (
                        <p className="text-xs text-gray-500 mb-2">{session.workItemTitle}</p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {session.agents.length} agents
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {session.messageCount} msgs
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ${session.cost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Session Detail */}
        {selectedSession && (
          <div className="flex-1 overflow-y-auto p-6">
            <SessionDetailView
              session={selectedSession}
              onClose={() => setSelectedSession(null)}
              onPause={() => onPauseSession(selectedSession.sessionId)}
              onResume={() => onResumeSession(selectedSession.sessionId)}
              onTerminate={() => onTerminateSession(selectedSession.sessionId)}
              onViewFull={() => onViewSession(selectedSession.sessionId)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionDetailViewProps {
  session: Session;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onTerminate: () => void;
  onViewFull: () => void;
}

function SessionDetailView({
  session,
  onClose,
  onPause,
  onResume,
  onTerminate,
  onViewFull,
}: SessionDetailViewProps) {
  const [selectedAgent, setSelectedAgent] = useState<SessionAgent | null>(null);
  const statusConfig = SESSION_STATUS_CONFIG[session.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={clsx('p-2 rounded-lg', statusConfig.bg)}>
              {statusConfig.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{session.name}</h2>
              <p className="text-sm text-gray-500">ID: {session.sessionId}</p>
            </div>
          </div>
          <p className="text-gray-600">{session.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {session.status === 'running' && (
            <button
              onClick={onPause}
              className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm hover:bg-amber-200"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          {session.status === 'paused' && (
            <button
              onClick={onResume}
              className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}
          {(session.status === 'running' || session.status === 'paused') && (
            <button
              onClick={onTerminate}
              className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
            >
              <Square className="w-4 h-4" />
              Terminate
            </button>
          )}
          <button
            onClick={onViewFull}
            className="flex items-center gap-2 px-3 py-2 bg-violet-100 text-violet-700 rounded-lg text-sm hover:bg-violet-200"
          >
            <Terminal className="w-4 h-4" />
            Full View
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Duration</p>
          <p className="text-lg font-semibold text-gray-900">
            {session.endedAt
              ? formatDistanceToNow(new Date(session.startedAt), { addSuffix: false })
              : formatDistanceToNow(new Date(session.startedAt), { addSuffix: false })}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Cost</p>
          <p className="text-lg font-semibold text-gray-900">
            ${session.cost.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400">
            of ${session.budget.toFixed(2)} budget
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Messages</p>
          <p className="text-lg font-semibold text-gray-900">
            {session.messageCount.toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Agents</p>
          <p className="text-lg font-semibold text-gray-900">
            {session.agents.length}
          </p>
        </div>
      </div>

      {/* Agents */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Active Agents</h3>
        <div className="space-y-3">
          {session.agents.map((agent) => {
            const agentStatus = AGENT_STATUS_CONFIG[agent.status];

            return (
              <div
                key={agent.agentId}
                onClick={() => setSelectedAgent(selectedAgent?.agentId === agent.agentId ? null : agent)}
                className={clsx(
                  'border rounded-lg overflow-hidden cursor-pointer transition-all',
                  selectedAgent?.agentId === agent.agentId
                    ? 'border-violet-500 ring-2 ring-violet-200'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={clsx('w-2 h-2 rounded-full', agentStatus.bg.replace('bg-', 'bg-').replace('100', '500'))} />
                      <span className="font-medium text-gray-900">{agent.agentName}</span>
                      <span className="text-sm text-gray-500">({agent.role})</span>
                    </div>
                    <span className={clsx('px-2 py-1 rounded text-xs font-medium', agentStatus.bg, agentStatus.color)}>
                      {agentStatus.label}
                    </span>
                  </div>

                  {agent.currentTask && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600">{agent.currentTask}</p>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-violet-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${agent.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      ${agent.cost.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {agent.activities.length} activities
                    </span>
                  </div>
                </div>

                {/* Agent Activities */}
                {selectedAgent?.agentId === agent.agentId && agent.activities.length > 0 && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Activities</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {agent.activities.slice(0, 20).map((activity) => (
                        <ActivityItem key={activity.activityId} activity={activity} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: AgentActivity }) {
  const icons: Record<AgentActivity['type'], React.ReactNode> = {
    thinking: <Zap className="w-4 h-4 text-amber-500" />,
    action: <ArrowRight className="w-4 h-4 text-blue-500" />,
    message: <MessageSquare className="w-4 h-4 text-green-500" />,
    tool_call: <Terminal className="w-4 h-4 text-purple-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
    completion: <CheckCircle className="w-4 h-4 text-green-500" />,
  };

  return (
    <div className="flex items-start gap-3 p-2 bg-white rounded border border-gray-200">
      {icons[activity.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">{activity.message}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {format(new Date(activity.timestamp), 'h:mm:ss a')}
        </p>
      </div>
    </div>
  );
}
