import { useState } from 'react';
import {
  Terminal,
  Activity,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  Pause,
  Square,
  RefreshCw,
  Settings,
  ChevronRight,
  Search,
  Filter,
  LayoutDashboard,
  Server,
  Shield,
  DollarSign,
  BarChart3,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';

export type SystemStatus = 'healthy' | 'degraded' | 'critical' | 'maintenance';
export type QueueStatus = 'normal' | 'high' | 'backlog';

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  change: number;
  status: 'good' | 'warning' | 'critical';
}

interface QueueInfo {
  queueId: string;
  name: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgWaitTime: number;
  status: QueueStatus;
}

interface ActiveOperation {
  operationId: string;
  type: string;
  description: string;
  progress: number;
  startedAt: string;
  estimatedEnd?: string;
  agentCount: number;
}

interface Alert {
  alertId: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface CommandCenterProps {
  systemStatus: SystemStatus;
  metrics: SystemMetric[];
  queues: QueueInfo[];
  activeOperations: ActiveOperation[];
  alerts: Alert[];
  onPauseSystem: () => void;
  onResumeSystem: () => void;
  onEmergencyStop: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onViewQueue: (queueId: string) => void;
  onViewOperation: (operationId: string) => void;
}

const STATUS_CONFIG: Record<SystemStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  healthy: { label: 'System Healthy', color: 'text-green-700', bg: 'bg-green-100', icon: <CheckCircle className="w-5 h-5" /> },
  degraded: { label: 'Performance Degraded', color: 'text-amber-700', bg: 'bg-amber-100', icon: <AlertTriangle className="w-5 h-5" /> },
  critical: { label: 'Critical Issues', color: 'text-red-700', bg: 'bg-red-100', icon: <AlertTriangle className="w-5 h-5" /> },
  maintenance: { label: 'Maintenance Mode', color: 'text-blue-700', bg: 'bg-blue-100', icon: <Settings className="w-5 h-5" /> },
};

const QUEUE_STATUS_CONFIG: Record<QueueStatus, { color: string; bg: string }> = {
  normal: { color: 'text-green-700', bg: 'bg-green-100' },
  high: { color: 'text-amber-700', bg: 'bg-amber-100' },
  backlog: { color: 'text-red-700', bg: 'bg-red-100' },
};

export function CommandCenter({
  systemStatus,
  metrics,
  queues,
  activeOperations,
  alerts,
  onPauseSystem,
  onResumeSystem,
  onEmergencyStop,
  onAcknowledgeAlert,
  onViewQueue,
  onViewOperation,
}: CommandCenterProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'operations' | 'queues' | 'alerts'>('overview');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'info' | 'warning' | 'critical'>('all');

  const statusConfig = STATUS_CONFIG[systemStatus];
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged);
  const totalPending = queues.reduce((sum, q) => sum + q.pending, 0);
  const totalProcessing = queues.reduce((sum, q) => sum + q.processing, 0);

  const filteredAlerts = alerts.filter((alert) => {
    if (filterSeverity === 'all') return true;
    return alert.severity === filterSeverity;
  });

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-6xl h-[85vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-gray-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            <LayoutDashboard className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Command Center</h2>
            <p className="text-sm text-gray-500">Operational dashboard and control</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg', statusConfig.bg)}>
            {statusConfig.icon}
            <span className={clsx('font-medium', statusConfig.color)}>{statusConfig.label}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPauseSystem}
              className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
            <button
              onClick={onResumeSystem}
              className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
            <button
              onClick={onEmergencyStop}
              className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
            >
              <Square className="w-4 h-4" />
              Emergency Stop
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-6 py-4 grid grid-cols-5 gap-4 border-b border-gray-200 bg-gray-50">
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Pending Tasks</span>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-xl font-bold text-gray-900">{totalPending.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Processing</span>
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-gray-900">{totalProcessing.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Active Operations</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-gray-900">{activeOperations.length}</div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Unacknowledged</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-xl font-bold text-gray-900">{criticalAlerts.length}</div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">System Health</span>
            <Activity className="w-4 h-4 text-green-400" />
          </div>
          <div className={clsx('text-xl font-bold', statusConfig.color)}>
            {systemStatus === 'healthy' ? '100%' : systemStatus === 'degraded' ? '75%' : '50%'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200">
        <div className="flex gap-1">
          {(['overview', 'operations', 'queues', 'alerts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-slate-600 text-slate-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab}
              {tab === 'alerts' && criticalAlerts.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {criticalAlerts.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Metrics */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                System Metrics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {metrics.map((metric) => (
                  <div key={metric.name} className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">{metric.name}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {metric.value.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">{metric.unit}</span>
                    </div>
                    <div className={clsx(
                      'text-xs mt-1',
                      metric.change > 0 ? 'text-red-600' : 'text-green-600'
                    )}>
                      {metric.change > 0 ? '+' : ''}{metric.change}% from last hour
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Alerts */}
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5" />
                Recent Alerts
              </h3>
              <div className="space-y-3">
                {alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.alertId}
                    className={clsx(
                      'p-3 rounded-lg border',
                      alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                      alert.severity === 'warning' ? 'border-amber-200 bg-amber-50' :
                      'border-blue-200 bg-blue-50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className={clsx(
                          'font-medium',
                          alert.severity === 'critical' ? 'text-red-900' :
                          alert.severity === 'warning' ? 'text-amber-900' :
                          'text-blue-900'
                        )}>
                          {alert.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      </div>
                      {!alert.acknowledged && (
                        <button
                          onClick={() => onAcknowledgeAlert(alert.alertId)}
                          className="px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50"
                        >
                          Ack
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Active Operations</h3>
            {activeOperations.length === 0 ? (
              <p className="text-gray-500">No active operations</p>
            ) : (
              activeOperations.map((op) => (
                <div
                  key={op.operationId}
                  onClick={() => onViewOperation(op.operationId)}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-slate-300 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{op.description}</h4>
                      <p className="text-sm text-gray-500">ID: {op.operationId}</p>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                      {op.type}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${op.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {op.agentCount} agents
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Started {formatDistanceToNow(new Date(op.startedAt), { addSuffix: true })}
                    </span>
                    {op.estimatedEnd && (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-4 h-4" />
                        Est. {formatDistanceToNow(new Date(op.estimatedEnd), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'queues' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Task Queues</h3>
            <div className="grid grid-cols-2 gap-4">
              {queues.map((queue) => {
                const queueStatus = QUEUE_STATUS_CONFIG[queue.status];
                return (
                  <div
                    key={queue.queueId}
                    onClick={() => onViewQueue(queue.queueId)}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:border-slate-300 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{queue.name}</h4>
                      <span className={clsx('px-2 py-1 rounded text-xs font-medium', queueStatus.bg, queueStatus.color)}>
                        {queue.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center mb-3">
                      <div>
                        <div className="text-lg font-semibold text-gray-900">{queue.pending}</div>
                        <div className="text-xs text-gray-500">Pending</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-blue-600">{queue.processing}</div>
                        <div className="text-xs text-gray-500">Processing</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-green-600">{queue.completed}</div>
                        <div className="text-xs text-gray-500">Completed</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-red-600">{queue.failed}</div>
                        <div className="text-xs text-gray-500">Failed</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Avg wait time: {Math.round(queue.avgWaitTime / 1000)}s
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">System Alerts</h3>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div className="space-y-3">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.alertId}
                  className={clsx(
                    'p-4 rounded-lg border',
                    alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                    alert.severity === 'warning' ? 'border-amber-200 bg-amber-50' :
                    'border-blue-200 bg-blue-50',
                    alert.acknowledged && 'opacity-50'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={clsx(
                        'w-5 h-5 flex-shrink-0',
                        alert.severity === 'critical' ? 'text-red-500' :
                        alert.severity === 'warning' ? 'text-amber-500' :
                        'text-blue-500'
                      )} />
                      <div>
                        <h4 className={clsx(
                          'font-medium',
                          alert.severity === 'critical' ? 'text-red-900' :
                          alert.severity === 'warning' ? 'text-amber-900' :
                          'text-blue-900'
                        )}>
                          {alert.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          {format(new Date(alert.timestamp), 'PPp')}
                        </p>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => onAcknowledgeAlert(alert.alertId)}
                        className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
