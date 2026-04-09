import { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  PieChart,
  BarChart3,
  Calendar,
  Filter,
  Download,
  Settings,
  ChevronDown,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Zap,
  Users,
  Target,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

// Mock chart components - in real implementation use recharts
const SimpleBarChart = ({ data, color }: { data: number[]; color: string }) => (
  <div className="flex items-end gap-1 h-24">
    {data.map((value, i) => (
      <div
        key={i}
        className={clsx('flex-1 rounded-t transition-all', color)}
        style={{ height: `${Math.max(10, (value / Math.max(...data)) * 100)}%` }}
      />
    ))}
  </div>
);

const SimpleLineChart = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((value, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - ((value - min) / range) * 80 - 10,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-32">
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} />
      ))}
    </svg>
  );
};

interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
  change: number;
}

interface DailyCost {
  date: string;
  amount: number;
  requests: number;
  tokens: number;
}

interface AgentCost {
  agentId: string;
  agentName: string;
  teamName: string;
  cost: number;
  requests: number;
  efficiency: number;
}

interface TeamBudget {
  teamId: string;
  teamName: string;
  budget: number;
  spent: number;
  remaining: number;
  percentage: number;
}

interface CostAlert {
  alertId: string;
  type: 'threshold' | 'anomaly' | 'budget' | 'efficiency';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

interface CostDashboardProps {
  totalCost: number;
  budgetAmount: number;
  costChange: number; // percentage
  period: 'day' | 'week' | 'month' | 'quarter';
  onPeriodChange: (period: 'day' | 'week' | 'month' | 'quarter') => void;
  dailyCosts: DailyCost[];
  costBreakdown: CostBreakdown[];
  agentCosts: AgentCost[];
  teamBudgets: TeamBudget[];
  alerts: CostAlert[];
}

export function CostDashboard({
  totalCost,
  budgetAmount,
  costChange,
  period,
  onPeriodChange,
  dailyCosts,
  costBreakdown,
  agentCosts,
  teamBudgets,
  alerts,
}: CostDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'agents' | 'budgets' | 'alerts'>('overview');
  const [selectedTeam, setSelectedTeam] = useState<string | 'all'>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d');

  const budgetUsedPercentage = (totalCost / budgetAmount) * 100;
  const isOverBudget = totalCost > budgetAmount;

  const filteredAgentCosts = selectedTeam === 'all'
    ? agentCosts
    : agentCosts.filter((a) => a.teamName === selectedTeam);

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-6xl h-[85vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cost Dashboard</h2>
            <p className="text-sm text-gray-500">
              {period.charAt(0).toUpperCase() + period.slice(1)}ly spending overview
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Download className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4 border-b border-gray-200">
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={clsx('flex items-center gap-1 text-sm mt-1', costChange >= 0 ? 'text-red-600' : 'text-green-600')}>
            {costChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(costChange).toFixed(1)}% vs last period
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Budget Used</span>
            <Target className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {budgetUsedPercentage.toFixed(1)}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={clsx('h-2 rounded-full transition-all', isOverBudget ? 'bg-red-500' : 'bg-blue-500')}
              style={{ width: `${Math.min(100, budgetUsedPercentage)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            ${(budgetAmount - totalCost).toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">API Calls</span>
            <Zap className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {dailyCosts.reduce((sum, d) => sum + d.requests, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {(dailyCosts.reduce((sum, d) => sum + d.tokens, 0) / 1000000).toFixed(2)}M tokens
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Active Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{alerts.length}</div>
          <div className="flex items-center gap-2 mt-1">
            {criticalAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                {criticalAlerts.length} Critical
              </span>
            )}
            {warningAlerts.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                {warningAlerts.length} Warnings
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200">
        <div className="flex gap-1">
          {(['overview', 'breakdown', 'agents', 'budgets', 'alerts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab === 'overview' && <BarChart3 className="w-4 h-4 inline mr-1" />}
              {tab === 'breakdown' && <PieChart className="w-4 h-4 inline mr-1" />}
              {tab === 'agents' && <Users className="w-4 h-4 inline mr-1" />}
              {tab === 'budgets' && <Target className="w-4 h-4 inline mr-1" />}
              {tab === 'alerts' && <AlertTriangle className="w-4 h-4 inline mr-1" />}
              {tab}
              {tab === 'alerts' && alerts.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {alerts.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Cost Trend */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Cost Trend</h3>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
              </div>
              <SimpleLineChart
                data={dailyCosts.map((d) => d.amount)}
                color="#10b981"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                {dailyCosts.map((d, i) => (
                  <span key={i}>{format(new Date(d.date), 'MMM d')}</span>
                )).slice(0, 7)}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Average Daily</p>
                <p className="text-xl font-semibold text-gray-900">
                  ${(totalCost / dailyCosts.length).toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Most Expensive Day</p>
                <p className="text-xl font-semibold text-gray-900">
                  ${Math.max(...dailyCosts.map((d) => d.amount)).toFixed(2)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Cost per Request</p>
                <p className="text-xl font-semibold text-gray-900">
                  ${(totalCost / dailyCosts.reduce((sum, d) => sum + d.requests, 0)).toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'breakdown' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Cost by Category</h3>
              <SimpleBarChart
                data={costBreakdown.map((c) => c.amount)}
                color="bg-emerald-500"
              />
              <div className="space-y-2 mt-4">
                {costBreakdown.map((item) => (
                  <div key={item.category} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-emerald-500" />
                      <span className="text-gray-700">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-900 font-medium">
                        ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className={clsx('text-xs', item.change > 0 ? 'text-red-600' : 'text-green-600')}>
                        {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Cost Distribution</h3>
              <div className="space-y-3">
                {costBreakdown.map((item) => (
                  <div key={item.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{item.category}</span>
                      <span className="text-gray-500">{item.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Cost by Agent</h3>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="all">All Teams</option>
                {teamBudgets.map((t) => (
                  <option key={t.teamId} value={t.teamName}>{t.teamName}</option>
                ))}
              </select>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Agent</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Team</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Cost</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Requests</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAgentCosts.map((agent) => (
                    <tr key={agent.agentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{agent.agentName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{agent.teamName}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        ${agent.cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {agent.requests.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={clsx(
                          'px-2 py-1 rounded text-xs font-medium',
                          agent.efficiency >= 0.8 ? 'bg-green-100 text-green-700' :
                          agent.efficiency >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        )}>
                          {(agent.efficiency * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'budgets' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Team Budgets</h3>
            {teamBudgets.map((team) => (
              <div key={team.teamId} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{team.teamName}</h4>
                    <p className="text-sm text-gray-500">
                      ${team.spent.toLocaleString('en-US', { minimumFractionDigits: 2 })} of ${team.budget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <span className={clsx(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    team.percentage > 90 ? 'bg-red-100 text-red-700' :
                    team.percentage > 75 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  )}>
                    {team.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={clsx(
                      'h-3 rounded-full transition-all',
                      team.percentage > 90 ? 'bg-red-500' :
                      team.percentage > 75 ? 'bg-amber-500' :
                      'bg-green-500'
                    )}
                    style={{ width: `${Math.min(100, team.percentage)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  ${team.remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No cost alerts at this time</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.alertId}
                  className={clsx(
                    'border rounded-lg p-4',
                    alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                    alert.severity === 'warning' ? 'border-amber-200 bg-amber-50' :
                    'border-blue-200 bg-blue-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={clsx(
                      'w-5 h-5 flex-shrink-0',
                      alert.severity === 'critical' ? 'text-red-500' :
                      alert.severity === 'warning' ? 'text-amber-500' :
                      'text-blue-500'
                    )} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className={clsx(
                          'font-medium',
                          alert.severity === 'critical' ? 'text-red-900' :
                          alert.severity === 'warning' ? 'text-amber-900' :
                          'text-blue-900'
                        )}>
                          {alert.message}
                        </h4>
                        <span className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium uppercase',
                          alert.severity === 'critical' ? 'bg-red-200 text-red-800' :
                          alert.severity === 'warning' ? 'bg-amber-200 text-amber-800' :
                          'bg-blue-200 text-blue-800'
                        )}>
                          {alert.severity}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span>Value: ${alert.value.toFixed(2)}</span>
                        <span>Threshold: ${alert.threshold.toFixed(2)}</span>
                        <span>{format(new Date(alert.timestamp), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
