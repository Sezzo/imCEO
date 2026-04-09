import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plug,
  Plus,
  Search,
  Settings,
  Trash2,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Terminal,
  Save,
  X,
  Play,
  Copy,
  ChevronRight,
  Server,
  Shield,
  Clock,
  Activity,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export type MCPStatus = 'connected' | 'disconnected' | 'error' | 'testing';
export type MCPAuthType = 'none' | 'api_key' | 'oauth' | 'basic';

interface MCPCapability {
  name: string;
  description: string;
  parameters?: object;
}

interface MCPConnection {
  mcpId: string;
  name: string;
  description: string;
  serverUrl: string;
  status: MCPStatus;
  authType: MCPAuthType;
  authConfig?: {
    apiKey?: string;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
  };
  capabilities: MCPCapability[];
  timeout: number;
  retryCount: number;
  lastConnected?: string;
  lastError?: string;
  usageCount: number;
  healthScore: number;
  createdAt: string;
  updatedAt: string;
}

const mcpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  serverUrl: z.string().url('Must be a valid URL'),
  authType: z.enum(['none', 'api_key', 'oauth', 'basic']),
  authConfig: z.object({
    apiKey: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  }).optional(),
  timeout: z.number().min(1).max(300).default(30),
  retryCount: z.number().min(0).max(10).default(3),
});

type MCPFormData = z.infer<typeof mcpSchema>;

interface MCPRegistryProps {
  mcps: MCPConnection[];
  onCreateMCP: (data: MCPFormData) => void;
  onUpdateMCP: (mcpId: string, data: Partial<MCPFormData>) => void;
  onDeleteMCP: (mcpId: string) => void;
  onTestMCP: (mcpId: string) => Promise<{ success: boolean; capabilities?: MCPCapability[]; error?: string }>;
  onConnectMCP: (mcpId: string) => Promise<boolean>;
  onDisconnectMCP: (mcpId: string) => void;
}

const STATUS_CONFIG: Record<MCPStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  connected: { label: 'Connected', color: 'text-green-700', bg: 'bg-green-100', icon: <CheckCircle className="w-4 h-4" /> },
  disconnected: { label: 'Disconnected', color: 'text-gray-700', bg: 'bg-gray-100', icon: <XCircle className="w-4 h-4" /> },
  error: { label: 'Error', color: 'text-red-700', bg: 'bg-red-100', icon: <AlertCircle className="w-4 h-4" /> },
  testing: { label: 'Testing...', color: 'text-blue-700', bg: 'bg-blue-100', icon: <RefreshCw className="w-4 h-4 animate-spin" /> },
};

const AUTH_CONFIG: Record<MCPAuthType, { label: string; description: string }> = {
  none: { label: 'No Authentication', description: 'Open access to the server' },
  api_key: { label: 'API Key', description: 'Simple key-based authentication' },
  oauth: { label: 'OAuth 2.0', description: 'Standard OAuth flow' },
  basic: { label: 'Basic Auth', description: 'Username and password' },
};

export function MCPRegistry({
  mcps,
  onCreateMCP,
  onUpdateMCP,
  onDeleteMCP,
  onTestMCP,
  onConnectMCP,
  onDisconnectMCP,
}: MCPRegistryProps) {
  const [activeTab, setActiveTab] = useState<'browse' | 'create' | 'detail'>('browse');
  const [selectedMCP, setSelectedMCP] = useState<MCPConnection | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<MCPStatus | 'all'>('all');
  const [testResult, setTestResult] = useState<{ success: boolean; capabilities?: MCPCapability[]; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<MCPFormData>({
    resolver: zodResolver(mcpSchema),
    defaultValues: {
      authType: 'none',
      timeout: 30,
      retryCount: 3,
    },
  });

  const filteredMCPs = mcps.filter((mcp) => {
    const matchesSearch =
      !searchTerm ||
      mcp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mcp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mcp.serverUrl.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || mcp.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const connectedCount = mcps.filter((m) => m.status === 'connected').length;
  const errorCount = mcps.filter((m) => m.status === 'error').length;

  const onSubmit = (data: MCPFormData) => {
    if (selectedMCP) {
      onUpdateMCP(selectedMCP.mcpId, data);
    } else {
      onCreateMCP(data);
    }
    setActiveTab('browse');
    setSelectedMCP(null);
    reset();
  };

  const handleTest = async (mcp: MCPConnection) => {
    setIsTesting(true);
    setTestResult(null);
    const result = await onTestMCP(mcp.mcpId);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleConnect = async (mcp: MCPConnection) => {
    setIsConnecting(true);
    const success = await onConnectMCP(mcp.mcpId);
    setIsConnecting(false);
    if (success && selectedMCP?.mcpId === mcp.mcpId) {
      setSelectedMCP({ ...mcp, status: 'connected' });
    }
  };

  const handleEdit = (mcp: MCPConnection) => {
    setSelectedMCP(mcp);
    setValue('name', mcp.name);
    setValue('description', mcp.description);
    setValue('serverUrl', mcp.serverUrl);
    setValue('authType', mcp.authType);
    setValue('timeout', mcp.timeout);
    setValue('retryCount', mcp.retryCount);
    setActiveTab('create');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-6xl h-[85vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Plug className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">MCP Registry</h2>
            <p className="text-sm text-gray-500">
              {connectedCount} connected • {errorCount} errors • {mcps.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" />
              {errorCount} Errors
            </div>
          )}
          <button
            onClick={() => {
              setSelectedMCP(null);
              reset();
              setActiveTab('create');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Add MCP
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200">
        <div className="flex gap-1">
          {(['browse', 'create'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'browse') {
                  setSelectedMCP(null);
                }
              }}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab === 'browse' ? (
                <span className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Connections
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {selectedMCP ? 'Edit MCP' : 'New Connection'}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'browse' && (
          <div className="h-full flex flex-col">
            {/* Filters */}
            <div className="p-4 border-b border-gray-200 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search MCP connections..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as MCPStatus | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredMCPs.length === 0 ? (
                <div className="text-center py-12">
                  <Plug className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No MCP connections found</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Add your first Model Context Protocol connection
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Add MCP Connection
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredMCPs.map((mcp) => {
                    const statusConfig = STATUS_CONFIG[mcp.status];

                    return (
                      <div
                        key={mcp.mcpId}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={clsx('p-2 rounded-lg', statusConfig.bg)}>
                              <Plug className={clsx('w-5 h-5', statusConfig.color)} />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{mcp.name}</h4>
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">{mcp.serverUrl}</p>
                            </div>
                          </div>
                          <span className={clsx('px-2 py-1 rounded text-xs font-medium', statusConfig.bg, statusConfig.color)}>
                            {statusConfig.label}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{mcp.description}</p>

                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            <span className="capitalize">{mcp.authType.replace('_', ' ')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{mcp.timeout}s timeout</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            <span>{mcp.usageCount} calls</span>
                          </div>
                        </div>

                        {mcp.lastError && (
                          <div className="p-2 bg-red-50 text-red-700 text-xs rounded mb-3">
                            {mcp.lastError}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            {mcp.status === 'connected' ? (
                              <button
                                onClick={() => onDisconnectMCP(mcp.mcpId)}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                              >
                                Disconnect
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect(mcp)}
                                disabled={isConnecting}
                                className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                              >
                                {isConnecting ? 'Connecting...' : 'Connect'}
                              </button>
                            )}
                            <button
                              onClick={() => handleTest(mcp)}
                              disabled={isTesting}
                              className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                            >
                              {isTesting ? 'Testing...' : 'Test'}
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedMCP(mcp);
                                setActiveTab('detail');
                              }}
                              className="p-1.5 hover:bg-gray-100 text-gray-600 rounded"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {testResult && selectedMCP?.mcpId === mcp.mcpId && (
                          <div className={clsx(
                            'mt-3 p-3 rounded-lg',
                            testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                          )}>
                            <div className="flex items-center gap-2 mb-2">
                              {testResult.success ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-red-600" />
                              )}
                              <span className={clsx('text-sm font-medium', testResult.success ? 'text-green-700' : 'text-red-700')}>
                                {testResult.success ? 'Test Successful' : 'Test Failed'}
                              </span>
                            </div>
                            {testResult.capabilities && (
                              <div className="text-xs text-gray-600">
                                <p className="font-medium mb-1">Capabilities:</p>
                                <ul className="list-disc list-inside">
                                  {testResult.capabilities.map((cap, i) => (
                                    <li key={i}>{cap.name}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {testResult.error && (
                              <p className="text-xs text-red-600">{testResult.error}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="h-full overflow-y-auto p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Connection Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('name')}
                  className={clsx(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500',
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="e.g., GitHub MCP Server"
                />
                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="What does this MCP server provide?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Server URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('serverUrl')}
                  className={clsx(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500',
                    errors.serverUrl ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="https://api.example.com/mcp or http://localhost:3000/mcp"
                />
                {errors.serverUrl && <p className="mt-1 text-sm text-red-500">{errors.serverUrl.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Authentication</label>
                <div className="space-y-2">
                  {(['none', 'api_key', 'oauth', 'basic'] as const).map((type) => (
                    <label
                      key={type}
                      className={clsx(
                        'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                        watch('authType') === type
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="radio"
                        {...register('authType')}
                        value={type}
                        className="sr-only"
                      />
                      <div>
                        <span className="font-medium text-sm text-gray-900">{AUTH_CONFIG[type].label}</span>
                        <p className="text-xs text-gray-500">{AUTH_CONFIG[type].description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {watch('authType') === 'api_key' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    {...register('authConfig.apiKey')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Enter API key"
                  />
                </div>
              )}

              {watch('authType') === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      {...register('authConfig.username')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      {...register('authConfig.password')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              )}

              {watch('authType') === 'oauth' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                    <input
                      type="text"
                      {...register('authConfig.clientId')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                    <input
                      type="password"
                      {...register('authConfig.clientSecret')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (seconds)</label>
                  <input
                    type="number"
                    {...register('timeout', { valueAsNumber: true })}
                    min={1}
                    max={300}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Retry Count</label>
                  <input
                    type="number"
                    {...register('retryCount', { valueAsNumber: true })}
                    min={0}
                    max={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('browse');
                    setSelectedMCP(null);
                    reset();
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Saving...' : selectedMCP ? 'Update Connection' : 'Add Connection'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'detail' && selectedMCP && (
          <MCPDetailView
            mcp={selectedMCP}
            onBack={() => setActiveTab('browse')}
            onEdit={() => handleEdit(selectedMCP)}
            onDelete={() => onDeleteMCP(selectedMCP.mcpId)}
            onConnect={() => handleConnect(selectedMCP)}
            onDisconnect={() => onDisconnectMCP(selectedMCP.mcpId)}
            onTest={() => handleTest(selectedMCP)}
            isConnecting={isConnecting}
            isTesting={isTesting}
          />
        )}
      </div>
    </div>
  );
}

interface MCPDetailViewProps {
  mcp: MCPConnection;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onTest: () => void;
  isConnecting: boolean;
  isTesting: boolean;
}

function MCPDetailView({
  mcp,
  onBack,
  onEdit,
  onDelete,
  onConnect,
  onDisconnect,
  onTest,
  isConnecting,
  isTesting,
}: MCPDetailViewProps) {
  const statusConfig = STATUS_CONFIG[mcp.status];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
            Back to list
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Settings className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className={clsx('p-3 rounded-lg', statusConfig.bg)}>
              <Plug className={clsx('w-6 h-6', statusConfig.color)} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{mcp.name}</h1>
              <p className="text-gray-500">{mcp.serverUrl}</p>
            </div>
            <span className={clsx('px-3 py-1 rounded-full text-sm font-medium', statusConfig.bg, statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>

          <p className="text-gray-600 mb-6">{mcp.description}</p>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-xl font-bold text-gray-900">{mcp.usageCount}</div>
              <div className="text-xs text-gray-500">Total Calls</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-xl font-bold text-gray-900">{mcp.healthScore}%</div>
              <div className="text-xs text-gray-500">Health Score</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-xl font-bold text-gray-900">{mcp.timeout}s</div>
              <div className="text-xs text-gray-500">Timeout</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="text-xl font-bold text-gray-900">{mcp.retryCount}</div>
              <div className="text-xs text-gray-500">Retries</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {mcp.status === 'connected' ? (
              <button
                onClick={onDisconnect}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <XCircle className="w-4 h-4" />
                Disconnect
              </button>
            ) : (
              <button
                onClick={onConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            )}
            <button
              onClick={onTest}
              disabled={isTesting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>

        {/* Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Configuration</h3>
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Authentication</span>
              <span className="font-medium text-gray-900 capitalize">{mcp.authType.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Timeout</span>
              <span className="font-medium text-gray-900">{mcp.timeout} seconds</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Retry Count</span>
              <span className="font-medium text-gray-900">{mcp.retryCount} attempts</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Created</span>
              <span className="font-medium text-gray-900">{format(new Date(mcp.createdAt), 'PPP')}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Last Updated</span>
              <span className="font-medium text-gray-900">{format(new Date(mcp.updatedAt), 'PPP')}</span>
            </div>
          </div>
        </div>

        {/* Capabilities */}
        {mcp.capabilities.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Capabilities</h3>
            <div className="space-y-3">
              {mcp.capabilities.map((cap, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">{cap.name}</h4>
                  <p className="text-sm text-gray-600">{cap.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Log */}
        {mcp.lastError && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Last Error</h3>
            <p className="text-sm text-red-700">{mcp.lastError}</p>
            {mcp.lastConnected && (
              <p className="text-xs text-red-500 mt-2">
                Last successful connection: {format(new Date(mcp.lastConnected), 'PPP')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
