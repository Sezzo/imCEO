import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Handle,
  Position,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  AlertTriangle,
  Save,
  Plus,
  Trash2,
  Play,
  AlertCircle,
  Clock,
  Users,
  Zap,
  Settings,
  X,
  ArrowUp,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

// Types
interface EscalationRule {
  ruleId: string;
  name: string;
  description: string;
  triggerType: 'cost_exceeded' | 'time_exceeded' | 'error_rate' | 'manual' | 'risk_score';
  threshold: number;
  timeWindow?: number;
  condition: '>' | '<' | '>=' | '<=' | '==';
  autoEscalate: boolean;
  notifyChannels: string[];
}

interface EscalationLevel {
  levelId: string;
  level: number;
  name: string;
  description: string;
  targetRoleId?: string;
  targetTeamId?: string;
  targetAgentId?: string;
  rules: EscalationRule[];
  timeoutMinutes: number;
  notifyImmediately: boolean;
}

interface EscalationChain {
  chainId: string;
  name: string;
  description: string;
  companyId: string;
  levels: EscalationLevel[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mock data
const MOCK_TRIGGERS: EscalationRule['triggerType'][] = [
  'cost_exceeded',
  'time_exceeded',
  'error_rate',
  'manual',
  'risk_score',
];

const TRIGGER_ICONS: Record<EscalationRule['triggerType'], React.ReactNode> = {
  cost_exceeded: <DollarIcon className="w-4 h-4" />,
  time_exceeded: <Clock className="w-4 h-4" />,
  error_rate: <AlertCircle className="w-4 h-4" />,
  manual: <Users className="w-4 h-4" />,
  risk_score: <AlertTriangle className="w-4 h-4" />,
};

const TRIGGER_LABELS: Record<EscalationRule['triggerType'], string> = {
  cost_exceeded: 'Cost Exceeded',
  time_exceeded: 'Time Exceeded',
  error_rate: 'Error Rate',
  manual: 'Manual Escalation',
  risk_score: 'Risk Score',
};

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M8 10h8M8 14h8" />
    </svg>
  );
}

// Node Components
interface LevelNodeData {
  level: EscalationLevel;
  onEdit: (level: EscalationLevel) => void;
  onDelete: (levelId: string) => void;
  onAddRule: (levelId: string) => void;
  isSelected: boolean;
}

const LevelNode = ({ data }: { data: LevelNodeData }) => {
  const { level, onEdit, onDelete, onAddRule, isSelected } = data;

  return (
    <div
      className={clsx(
        'relative w-72 bg-white rounded-lg border-2 shadow-sm transition-all',
        isSelected
          ? 'border-amber-500 ring-2 ring-amber-200'
          : 'border-gray-200 hover:border-amber-300'
      )}
    >
      {/* Target handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />

      {/* Source handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">
            {level.level}
          </div>
          <span className="font-semibold text-sm text-gray-900 truncate">{level.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(level)}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            <Settings className="w-3 h-3 text-gray-500" />
          </button>
          <button
            onClick={() => onDelete(level.levelId)}
            className="p-1 hover:bg-red-100 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3 text-red-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-500 line-clamp-2">{level.description}</p>

        {/* Target */}
        <div className="flex items-center gap-2 text-xs">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-gray-600">
            {level.targetRoleId || level.targetTeamId || level.targetAgentId || 'No target set'}
          </span>
        </div>

        {/* Timeout */}
        <div className="flex items-center gap-2 text-xs">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-gray-600">Timeout: {level.timeoutMinutes} min</span>
        </div>

        {/* Rules */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Rules ({level.rules.length})</span>
            <button
              onClick={() => onAddRule(level.levelId)}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              <Plus className="w-3 h-3 text-gray-400" />
            </button>
          </div>
          <div className="space-y-1">
            {level.rules.slice(0, 2).map((rule) => (
              <div
                key={rule.ruleId}
                className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded text-xs"
              >
                {TRIGGER_ICONS[rule.triggerType]}
                <span className="text-gray-600 truncate">{rule.name}</span>
              </div>
            ))}
            {level.rules.length > 2 && (
              <div className="text-xs text-gray-400 pl-2">
                +{level.rules.length - 2} more
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  level: LevelNode,
};

interface EscalationChainEditorProps {
  chain?: EscalationChain | null;
  companyId: string;
  availableRoles: { roleId: string; name: string; hierarchyLevel: string }[];
  availableTeams: { teamId: string; name: string }[];
  onSave: (chain: Partial<EscalationChain>) => void;
  onCancel: () => void;
  onTest?: (chainId: string) => void;
}

export function EscalationChainEditor({
  chain,
  companyId,
  availableRoles,
  availableTeams,
  onSave,
  onCancel,
  onTest,
}: EscalationChainEditorProps) {
  const [levels, setLevels] = useState<EscalationLevel[]>(chain?.levels || []);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState<EscalationLevel | null>(null);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  // Build nodes and edges from levels
  const buildGraph = useCallback(() => {
    const newNodes: Node[] = levels.map((level, index) => ({
      id: level.levelId,
      type: 'level',
      position: { x: 300, y: index * 250 },
      data: {
        level,
        onEdit: (l: EscalationLevel) => {
          setEditingLevel(l);
          setShowLevelModal(true);
        },
        onDelete: (id: string) => {
          setLevels((prev) => prev.filter((l) => l.levelId !== id));
        },
        onAddRule: (levelId: string) => {
          setSelectedLevelId(levelId);
          setEditingRule(null);
          setShowRuleModal(true);
        },
        isSelected: selectedLevelId === level.levelId,
      },
    }));

    const newEdges: Edge[] = levels.slice(0, -1).map((level, index) => ({
      id: `edge-${level.levelId}-${levels[index + 1].levelId}`,
      source: level.levelId,
      target: levels[index + 1].levelId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#f59e0b', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#f59e0b' },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  }, [levels, selectedLevelId, setNodes, setEdges]);

  // Rebuild graph when levels change
  useMemo(() => {
    buildGraph();
  }, [buildGraph]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const handleAddLevel = () => {
    const newLevel: EscalationLevel = {
      levelId: `level-${Date.now()}`,
      level: levels.length + 1,
      name: `Level ${levels.length + 1}`,
      description: 'Escalation level',
      rules: [],
      timeoutMinutes: 30,
      notifyImmediately: true,
    };
    setLevels([...levels, newLevel]);
  };

  const handleSaveLevel = (levelData: Partial<EscalationLevel>) => {
    if (editingLevel) {
      setLevels((prev) =>
        prev.map((l) =>
          l.levelId === editingLevel.levelId ? { ...l, ...levelData } : l
        )
      );
    }
    setShowLevelModal(false);
    setEditingLevel(null);
  };

  const handleSaveRule = (ruleData: Partial<EscalationRule>) => {
    if (!selectedLevelId) return;

    setLevels((prev) =>
      prev.map((l) => {
        if (l.levelId !== selectedLevelId) return l;

        if (editingRule) {
          return {
            ...l,
            rules: l.rules.map((r) =>
              r.ruleId === editingRule.ruleId ? { ...r, ...ruleData } : r
            ),
          };
        } else {
          const newRule: EscalationRule = {
            ruleId: `rule-${Date.now()}`,
            name: ruleData.name || 'New Rule',
            description: ruleData.description || '',
            triggerType: ruleData.triggerType || 'manual',
            threshold: ruleData.threshold || 0,
            condition: ruleData.condition || '>',
            autoEscalate: ruleData.autoEscalate || false,
            notifyChannels: ruleData.notifyChannels || [],
          };
          return { ...l, rules: [...l.rules, newRule] };
        }
      })
    );

    setShowRuleModal(false);
    setEditingRule(null);
    setSelectedLevelId(null);
  };

  const handleSaveChain = () => {
    onSave({
      ...chain,
      chainId: chain?.chainId || `chain-${Date.now()}`,
      companyId,
      levels,
      isActive: true,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-6xl h-[80vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <ArrowUp className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {chain ? 'Edit Escalation Chain' : 'Create Escalation Chain'}
            </h2>
            <p className="text-sm text-gray-500">
              {levels.length} levels configured
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onTest && chain && (
            <button
              onClick={() => onTest(chain.chainId)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Test Chain
            </button>
          )}
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        <button
          onClick={handleAddLevel}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Level
        </button>
        <div className="h-6 w-px bg-gray-300 mx-2" />
        <span className="text-sm text-gray-500">
          Drag nodes to reposition • Connect levels to define flow
        </span>
      </div>

      {/* Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
          className="bg-gray-50"
        >
          <Background color="#e5e7eb" gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-white border border-gray-200 rounded-lg shadow-sm"
          />
          <Panel position="top-left" className="bg-white/90 border border-gray-200 rounded-lg p-3 shadow-sm">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Legend</h4>
            <div className="space-y-1.5">
              {Object.entries(TRIGGER_LABELS).map(([type, label]) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-600">{TRIGGER_ICONS[type as EscalationRule['triggerType']]}</span>
                  <span className="text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end items-center gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveChain}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
        >
          <Save className="w-4 h-4" />
          Save Chain
        </button>
      </div>

      {/* Level Edit Modal */}
      {showLevelModal && editingLevel && (
        <LevelEditModal
          level={editingLevel}
          availableRoles={availableRoles}
          availableTeams={availableTeams}
          onSave={handleSaveLevel}
          onCancel={() => {
            setShowLevelModal(false);
            setEditingLevel(null);
          }}
        />
      )}

      {/* Rule Edit Modal */}
      {showRuleModal && (
        <RuleEditModal
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => {
            setShowRuleModal(false);
            setEditingRule(null);
            setSelectedLevelId(null);
          }}
        />
      )}
    </div>
  );
}

// Level Edit Modal Component
interface LevelEditModalProps {
  level: EscalationLevel;
  availableRoles: { roleId: string; name: string; hierarchyLevel: string }[];
  availableTeams: { teamId: string; name: string }[];
  onSave: (data: Partial<EscalationLevel>) => void;
  onCancel: () => void;
}

function LevelEditModal({
  level,
  availableRoles,
  availableTeams,
  onSave,
  onCancel,
}: LevelEditModalProps) {
  const [formData, setFormData] = useState({
    name: level.name,
    description: level.description,
    targetRoleId: level.targetRoleId || '',
    targetTeamId: level.targetTeamId || '',
    timeoutMinutes: level.timeoutMinutes,
    notifyImmediately: level.notifyImmediately,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit Escalation Level</h3>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Level Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Role</label>
            <select
              value={formData.targetRoleId}
              onChange={(e) => setFormData({ ...formData, targetRoleId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select a role...</option>
              {availableRoles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.name} ({role.hierarchyLevel})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Team</label>
            <select
              value={formData.targetTeamId}
              onChange={(e) => setFormData({ ...formData, targetTeamId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select a team...</option>
              {availableTeams.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timeout (minutes)
            </label>
            <input
              type="number"
              value={formData.timeoutMinutes}
              onChange={(e) => setFormData({ ...formData, timeoutMinutes: parseInt(e.target.value) })}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.notifyImmediately}
              onChange={(e) => setFormData({ ...formData, notifyImmediately: e.target.checked })}
              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
            />
            <span className="text-sm text-gray-700">Notify immediately on escalation</span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// Rule Edit Modal Component
interface RuleEditModalProps {
  rule: EscalationRule | null;
  onSave: (data: Partial<EscalationRule>) => void;
  onCancel: () => void;
}

function RuleEditModal({ rule, onSave, onCancel }: RuleEditModalProps) {
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    triggerType: rule?.triggerType || 'cost_exceeded',
    threshold: rule?.threshold || 100,
    condition: rule?.condition || '>',
    autoEscalate: rule?.autoEscalate || false,
    notifyChannels: rule?.notifyChannels || ['email'],
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {rule ? 'Edit Rule' : 'Add Rule'}
          </h3>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Cost Limit Exceeded"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
            <div className="grid grid-cols-2 gap-2">
              {MOCK_TRIGGERS.map((trigger) => (
                <label
                  key={trigger}
                  className={clsx(
                    'flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors',
                    formData.triggerType === trigger
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <input
                    type="radio"
                    name="triggerType"
                    value={trigger}
                    checked={formData.triggerType === trigger}
                    onChange={(e) => setFormData({ ...formData, triggerType: e.target.value as EscalationRule['triggerType'] })}
                    className="sr-only"
                  />
                  {TRIGGER_ICONS[trigger]}
                  <span className="text-sm">{TRIGGER_LABELS[trigger]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value as EscalationRule['condition'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option value=">">&gt; (Greater than)</option>
                <option value="<">&lt; (Less than)</option>
                <option value=">=">&gt;= (Greater or equal)</option>
                <option value="<=">&lt;= (Less or equal)</option>
                <option value="==">== (Equal to)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Threshold</label>
              <input
                type="number"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.autoEscalate}
              onChange={(e) => setFormData({ ...formData, autoEscalate: e.target.checked })}
              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Auto-escalate</span>
              <p className="text-xs text-gray-500">Automatically escalate when this rule triggers</p>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notification Channels</label>
            <div className="flex flex-wrap gap-2">
              {['email', 'slack', 'webhook', 'sms'].map((channel) => (
                <label
                  key={channel}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 border rounded-full text-sm cursor-pointer transition-colors',
                    formData.notifyChannels.includes(channel)
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={formData.notifyChannels.includes(channel)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, notifyChannels: [...formData.notifyChannels, channel] });
                      } else {
                        setFormData({ ...formData, notifyChannels: formData.notifyChannels.filter((c) => c !== channel) });
                      }
                    }}
                    className="sr-only"
                  />
                  <CheckCircle className={clsx('w-3 h-3', formData.notifyChannels.includes(channel) ? 'opacity-100' : 'opacity-0')} />
                  {channel.charAt(0).toUpperCase() + channel.slice(1)}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            {rule ? 'Save Changes' : 'Add Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
