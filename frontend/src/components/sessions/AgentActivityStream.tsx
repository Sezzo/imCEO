import { useState, useRef, useEffect } from 'react';
import {
  Activity,
  Filter,
  Search,
  RefreshCw,
  Clock,
  Zap,
  MessageSquare,
  Terminal,
  CheckCircle,
  AlertCircle,
  Code,
  FileText,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Trash2,
  Download,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';

export type ActivityLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type ActivityCategory = 'system' | 'agent' | 'session' | 'task' | 'delegation' | 'cost' | 'policy';

interface ActivityEvent {
  eventId: string;
  timestamp: string;
  level: ActivityLevel;
  category: ActivityCategory;
  agentId?: string;
  agentName?: string;
  sessionId?: string;
  message: string;
  details?: object;
  metadata?: {
    cost?: number;
    duration?: number;
    workItemId?: string;
    artifactId?: string;
  };
}

interface AgentActivityStreamProps {
  activities: ActivityEvent[];
  isConnected: boolean;
  onClear: () => void;
  onExport: () => void;
}

const LEVEL_CONFIG: Record<ActivityLevel, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  debug: { label: 'Debug', color: 'text-gray-600', bg: 'bg-gray-100', icon: <Code className="w-3 h-3" /> },
  info: { label: 'Info', color: 'text-blue-600', bg: 'bg-blue-100', icon: <MessageSquare className="w-3 h-3" /> },
  warning: { label: 'Warning', color: 'text-amber-600', bg: 'bg-amber-100', icon: <AlertCircle className="w-3 h-3" /> },
  error: { label: 'Error', color: 'text-red-600', bg: 'bg-red-100', icon: <AlertCircle className="w-3 h-3" /> },
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-200', icon: <AlertCircle className="w-3 h-3" /> },
};

const CATEGORY_CONFIG: Record<ActivityCategory, { label: string; icon: React.ReactNode }> = {
  system: { label: 'System', icon: <Terminal className="w-4 h-4" /> },
  agent: { label: 'Agent', icon: <Zap className="w-4 h-4" /> },
  session: { label: 'Session', icon: <Activity className="w-4 h-4" /> },
  task: { label: 'Task', icon: <CheckCircle className="w-4 h-4" /> },
  delegation: { label: 'Delegation', icon: <ArrowRight className="w-4 h-4" /> },
  cost: { label: 'Cost', icon: <Clock className="w-4 h-4" /> },
  policy: { label: 'Policy', icon: <FileText className="w-4 h-4" /> },
};

export function AgentActivityStream({
  activities,
  isConnected,
  onClear,
  onExport,
}: AgentActivityStreamProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<ActivityLevel | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<ActivityCategory | 'all'>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      !searchTerm ||
      activity.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.agentName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = filterLevel === 'all' || activity.level === filterLevel;
    const matchesCategory = filterCategory === 'all' || activity.category === filterCategory;

    return matchesSearch && matchesLevel && matchesCategory;
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (shouldAutoScroll && !isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities, shouldAutoScroll, isPaused]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShouldAutoScroll(isAtBottom);
    }
  };

  const stats = {
    total: activities.length,
    errors: activities.filter((a) => a.level === 'error' || a.level === 'critical').length,
    warnings: activities.filter((a) => a.level === 'warning').length,
    lastHour: activities.filter((a) => new Date(a.timestamp) > new Date(Date.now() - 3600000)).length,
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-5xl h-[85vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-sky-50 to-cyan-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-100 rounded-lg">
            <Activity className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Activity Stream</h2>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              {stats.total} events
              <span className={clsx('w-2 h-2 rounded-full', isConnected ? 'bg-green-500' : 'bg-red-500')} />
              {isConnected ? 'Live' : 'Disconnected'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats */}
          <div className="flex items-center gap-3 mr-4">
            {stats.errors > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                {stats.errors} Errors
              </span>
            )}
            {stats.warnings > 0 && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                {stats.warnings} Warnings
              </span>
            )}
          </div>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              isPaused ? 'bg-amber-100 text-amber-700' : 'hover:bg-gray-100 text-gray-600'
            )}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsCompact(!isCompact)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
            title={isCompact ? 'Expand' : 'Compact'}
          >
            {isCompact ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onExport}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
            title="Export"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClear}
            className="p-2 hover:bg-red-100 text-red-600 rounded-lg"
            title="Clear"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value as ActivityLevel | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
        >
          <option value="all">All Levels</option>
          {Object.entries(LEVEL_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as ActivityCategory | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* Activity List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm"
      >
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No activities to display</p>
          </div>
        ) : (
          filteredActivities.map((activity) => {
            const levelConfig = LEVEL_CONFIG[activity.level];
            const categoryConfig = CATEGORY_CONFIG[activity.category];
            const isExpanded = expandedEvent === activity.eventId;

            return (
              <div
                key={activity.eventId}
                onClick={() => setExpandedEvent(isExpanded ? null : activity.eventId)}
                className={clsx(
                  'group rounded-lg border transition-all cursor-pointer',
                  isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50',
                  activity.level === 'critical' ? 'border-red-300 bg-red-50/30' :
                  activity.level === 'error' ? 'border-red-200' :
                  activity.level === 'warning' ? 'border-amber-200' :
                  'border-gray-200'
                )}
              >
                <div className={clsx(
                  'flex items-start gap-3 p-3',
                  isCompact && 'py-2'
                )}>
                  {/* Timestamp */}
                  <div className="text-xs text-gray-400 flex-shrink-0 w-20">
                    {format(new Date(activity.timestamp), 'HH:mm:ss')}
                  </div>

                  {/* Level Badge */}
                  <div className={clsx('px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0', levelConfig.bg, levelConfig.color)}>
                    {levelConfig.label}
                  </div>

                  {/* Category Icon */}
                  <div className="text-gray-400 flex-shrink-0">
                    {categoryConfig.icon}
                  </div>

                  {/* Agent Name */}
                  {activity.agentName && (
                    <div className="text-xs text-purple-600 flex-shrink-0 w-24 truncate">
                      {activity.agentName}
                    </div>
                  )}

                  {/* Message */}
                  <div className="flex-1 text-gray-700">
                    {activity.message}
                  </div>

                  {/* Expand Icon */}
                  {activity.details && (
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && activity.details && (
                  <div className="px-3 pb-3 pl-32">
                    <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(activity.details, null, 2)}
                    </pre>
                    {activity.metadata && (
                      <div className="mt-2 flex gap-4 text-xs text-gray-500">
                        {activity.metadata.cost && (
                          <span>Cost: ${activity.metadata.cost.toFixed(4)}</span>
                        )}
                        {activity.metadata.duration && (
                          <span>Duration: {activity.metadata.duration}ms</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* New Activity Indicator */}
        {!shouldAutoScroll && !isPaused && (
          <button
            onClick={() => {
              setShouldAutoScroll(true);
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-full shadow-lg hover:bg-sky-700 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            New activities
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>Showing {filteredActivities.length} of {activities.length} events</span>
          {isPaused && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">
              Stream paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx('w-2 h-2 rounded-full', isConnected ? 'bg-green-500' : 'bg-red-500')} />
          <span>{isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}</span>
        </div>
      </div>
    </div>
  );
}
