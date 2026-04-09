import { useState, useCallback } from 'react';
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
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Shield,
  Plus,
  Save,
  X,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  ChevronRight,
  Settings,
  AlertTriangle,
  Code,
  Eye,
  Copy,
  Check,
  GripVertical,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export type PolicyStatus = 'draft' | 'active' | 'paused' | 'archived';
export type ConditionOperator = 'and' | 'or' | 'not';
export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'startsWith' | 'endsWith';
export type ActionType = 'allow' | 'deny' | 'escalate' | 'notify' | 'log' | 'modify';

interface PolicyCondition {
  conditionId: string;
  field: string;
  operator: ComparisonOperator;
  value: string | number | boolean | string[];
}

interface PolicyRule {
  ruleId: string;
  name: string;
  description: string;
  priority: number;
  conditions: PolicyCondition[];
  conditionOperator: ConditionOperator;
  actions: {
    type: ActionType;
    config?: Record<string, unknown>;
  }[];
  isActive: boolean;
}

interface Policy {
  policyId: string;
  name: string;
  description: string;
  status: PolicyStatus;
  scope: 'company' | 'division' | 'department' | 'team' | 'agent';
  targetId?: string;
  rules: PolicyRule[];
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Node Components for Visual Editor
interface RuleNodeData {
  rule: PolicyRule;
  onEdit: (rule: PolicyRule) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (ruleId: string) => void;
}

const RuleNode = ({ data }: { data: RuleNodeData }) => {
  const { rule, onEdit, onDelete, onToggle } = data;

  return (
    <div
      className={clsx(
        'relative w-80 bg-white rounded-lg border-2 shadow-sm transition-all',
        rule.isActive
          ? 'border-indigo-500 ring-2 ring-indigo-200'
          : 'border-gray-300 opacity-60'
      )}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500" />

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Priority {rule.priority}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToggle(rule.ruleId)}
              className={clsx(
                'w-8 h-4 rounded-full transition-colors relative',
                rule.isActive ? 'bg-indigo-500' : 'bg-gray-300'
              )}
            >
              <span className={clsx(
                'absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform',
                rule.isActive ? 'left-4.5' : 'left-0.5'
              )} />
            </button>
            <button
              onClick={() => onEdit(rule)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={() => onDelete(rule.ruleId)}
              className="p-1 hover:bg-red-100 text-red-500 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h4 className="font-medium text-gray-900 mb-1">{rule.name}</h4>
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{rule.description}</p>

        {/* Conditions Preview */}
        <div className="bg-gray-50 rounded p-2 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">IF</span>
            <span className="text-xs text-indigo-600 font-medium uppercase">
              {rule.conditionOperator}
            </span>
          </div>
          <div className="space-y-1">
            {rule.conditions.slice(0, 2).map((cond, i) => (
              <div key={i} className="text-xs text-gray-600 font-mono">
                {cond.field} {cond.operator} {JSON.stringify(cond.value).slice(0, 20)}
              </div>
            ))}
            {rule.conditions.length > 2 && (
              <div className="text-xs text-gray-400">
                +{rule.conditions.length - 2} more
              </div>
            )}
          </div>
        </div>

        {/* Actions Preview */}
        <div className="flex flex-wrap gap-1">
          {rule.actions.map((action, i) => (
            <span
              key={i}
              className={clsx(
                'px-2 py-0.5 rounded text-xs font-medium',
                action.type === 'allow' ? 'bg-green-100 text-green-700' :
                action.type === 'deny' ? 'bg-red-100 text-red-700' :
                action.type === 'escalate' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              )}
            >
              {action.type}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  rule: RuleNode,
};

interface PolicyDesignerProps {
  policy?: Policy | null;
  availableTargets: { id: string; name: string; type: string }[];
  onSave: (policy: Partial<Policy>) => void;
  onCancel: () => void;
  onTest: (policyId: string, testContext: object) => Promise<{ allowed: boolean; actions: string[]; matchedRules: string[] }>;
}

export function PolicyDesigner({
  policy,
  availableTargets,
  onSave,
  onCancel,
  onTest,
}: PolicyDesignerProps) {
  const [rules, setRules] = useState<PolicyRule[]>(policy?.rules || []);
  const [selectedRule, setSelectedRule] = useState<PolicyRule | null>(null);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [policyName, setPolicyName] = useState(policy?.name || '');
  const [policyDescription, setPolicyDescription] = useState(policy?.description || '');
  const [policyScope, setPolicyScope] = useState<Policy['scope']>(policy?.scope || 'company');
  const [policyTargetId, setPolicyTargetId] = useState(policy?.targetId || '');
  const [policyStatus, setPolicyStatus] = useState<PolicyStatus>(policy?.status || 'draft');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Build visual graph from rules
  const buildGraph = useCallback(() => {
    const newNodes: Node[] = rules.map((rule, index) => ({
      id: rule.ruleId,
      type: 'rule',
      position: { x: 250, y: index * 200 },
      data: {
        rule,
        onEdit: (r: PolicyRule) => {
          setSelectedRule(r);
          setShowRuleModal(true);
        },
        onDelete: (id: string) => {
          setRules((prev) => prev.filter((r) => r.ruleId !== id));
        },
        onToggle: (id: string) => {
          setRules((prev) =>
            prev.map((r) =>
              r.ruleId === id ? { ...r, isActive: !r.isActive } : r
            )
          );
        },
      },
    }));

    const newEdges: Edge[] = rules.slice(0, -1).map((rule, index) => ({
      id: `edge-${rule.ruleId}-${rules[index + 1].ruleId}`,
      source: rule.ruleId,
      target: rules[index + 1].ruleId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  }, [rules, setNodes, setEdges]);

  // Rebuild graph when rules change
  const updateGraph = useCallback(() => {
    buildGraph();
  }, [buildGraph]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const handleAddRule = () => {
    const newRule: PolicyRule = {
      ruleId: `rule-${Date.now()}`,
      name: `Rule ${rules.length + 1}`,
      description: '',
      priority: rules.length + 1,
      conditions: [],
      conditionOperator: 'and',
      actions: [{ type: 'allow' }],
      isActive: true,
    };
    setRules([...rules, newRule]);
    setSelectedRule(newRule);
    setShowRuleModal(true);
  };

  const handleSaveRule = (ruleData: Partial<PolicyRule>) => {
    if (selectedRule) {
      setRules((prev) =>
        prev.map((r) =>
          r.ruleId === selectedRule.ruleId ? { ...r, ...ruleData } : r
        )
      );
    }
    setShowRuleModal(false);
    setSelectedRule(null);
  };

  const handleSavePolicy = () => {
    onSave({
      ...policy,
      policyId: policy?.policyId || `policy-${Date.now()}`,
      name: policyName,
      description: policyDescription,
      scope: policyScope,
      targetId: policyTargetId,
      status: policyStatus,
      rules,
      version: (policy?.version || 0) + 1,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-6xl h-[85vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Shield className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <input
              type="text"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              placeholder="Policy Name"
              className="text-lg font-semibold text-gray-900 bg-transparent border-none focus:ring-0 p-0 placeholder-gray-400"
            />
            <p className="text-sm text-gray-500">{rules.length} rules • {rules.filter(r => r.isActive).length} active</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={policyStatus}
            onChange={(e) => setPolicyStatus(e.target.value as PolicyStatus)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        <button
          onClick={handleAddRule}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
        <div className="h-6 w-px bg-gray-300 mx-2" />
        <select
          value={policyScope}
          onChange={(e) => setPolicyScope(e.target.value as Policy['scope'])}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="company">Company-wide</option>
          <option value="division">Division</option>
          <option value="department">Department</option>
          <option value="team">Team</option>
          <option value="agent">Agent</option>
        </select>
        {policyScope !== 'company' && (
          <select
            value={policyTargetId}
            onChange={(e) => setPolicyTargetId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select target...</option>
            {availableTargets
              .filter((t) => t.type === policyScope)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>
        )}
        <div className="flex-1" />
        <button
          onClick={updateGraph}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Refresh View
        </button>
      </div>

      {/* Canvas */}
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
          <MiniMap className="bg-white border border-gray-200 rounded-lg shadow-sm" />
        </ReactFlow>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Rules are evaluated in priority order (top to bottom)
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSavePolicy}
            disabled={!policyName || rules.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Policy
          </button>
        </div>
      </div>

      {/* Rule Edit Modal */}
      {showRuleModal && selectedRule && (
        <RuleEditModal
          rule={selectedRule}
          onSave={handleSaveRule}
          onCancel={() => {
            setShowRuleModal(false);
            setSelectedRule(null);
          }}
        />
      )}
    </div>
  );
}

interface RuleEditModalProps {
  rule: PolicyRule;
  onSave: (data: Partial<PolicyRule>) => void;
  onCancel: () => void;
}

function RuleEditModal({ rule, onSave, onCancel }: RuleEditModalProps) {
  const [formData, setFormData] = useState({
    name: rule.name,
    description: rule.description,
    priority: rule.priority,
    conditionOperator: rule.conditionOperator,
    isActive: rule.isActive,
  });
  const [conditions, setConditions] = useState<PolicyCondition[]>(rule.conditions);
  const [actions, setActions] = useState(rule.actions);
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [newCondition, setNewCondition] = useState<Partial<PolicyCondition>>({
    operator: 'eq',
  });

  const operators: { value: ComparisonOperator; label: string }[] = [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not Equals' },
    { value: 'gt', label: 'Greater Than' },
    { value: 'gte', label: 'Greater or Equal' },
    { value: 'lt', label: 'Less Than' },
    { value: 'lte', label: 'Less or Equal' },
    { value: 'in', label: 'In List' },
    { value: 'contains', label: 'Contains' },
    { value: 'startsWith', label: 'Starts With' },
    { value: 'endsWith', label: 'Ends With' },
  ];

  const actionTypes: { value: ActionType; label: string; color: string }[] = [
    { value: 'allow', label: 'Allow', color: 'green' },
    { value: 'deny', label: 'Deny', color: 'red' },
    { value: 'escalate', label: 'Escalate', color: 'amber' },
    { value: 'notify', label: 'Notify', color: 'blue' },
    { value: 'log', label: 'Log', color: 'gray' },
    { value: 'modify', label: 'Modify', color: 'purple' },
  ];

  const addCondition = () => {
    if (newCondition.field && newCondition.operator) {
      setConditions([...conditions, {
        conditionId: `cond-${Date.now()}`,
        field: newCondition.field,
        operator: newCondition.operator as ComparisonOperator,
        value: newCondition.value || '',
      }]);
      setNewCondition({ operator: 'eq' });
      setShowConditionForm(false);
    }
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.conditionId !== id));
  };

  const addAction = (type: ActionType) => {
    setActions([...actions, { type, config: {} }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-indigo-50">
          <h3 className="text-lg font-semibold text-gray-900">Edit Rule</h3>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">Conditions</label>
                <select
                  value={formData.conditionOperator}
                  onChange={(e) => setFormData({ ...formData, conditionOperator: e.target.value as ConditionOperator })}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="and">Match ALL (AND)</option>
                  <option value="or">Match ANY (OR)</option>
                  <option value="not">Match NONE (NOT)</option>
                </select>
              </div>

              <div className="space-y-2 mb-3">
                {conditions.map((cond) => (
                  <div key={cond.conditionId} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <code className="text-xs bg-white px-2 py-1 rounded border">{cond.field}</code>
                    <span className="text-xs text-gray-500">{cond.operator}</span>
                    <code className="text-xs bg-white px-2 py-1 rounded border flex-1 truncate">
                      {JSON.stringify(cond.value)}
                    </code>
                    <button
                      onClick={() => removeCondition(cond.conditionId)}
                      className="p-1 hover:bg-red-100 text-red-500 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {showConditionForm ? (
                <div className="p-3 border border-indigo-200 rounded-lg bg-indigo-50">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Field (e.g., cost)"
                      value={newCondition.field || ''}
                      onChange={(e) => setNewCondition({ ...newCondition, field: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <select
                      value={newCondition.operator}
                      onChange={(e) => setNewCondition({ ...newCondition, operator: e.target.value as ComparisonOperator })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {operators.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Value"
                      value={String(newCondition.value || '')}
                      onChange={(e) => setNewCondition({ ...newCondition, value: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addCondition}
                      className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowConditionForm(false)}
                      className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowConditionForm(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                >
                  + Add Condition
                </button>
              )}
            </div>

            {/* Actions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Actions</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {actionTypes.map((actionType) => (
                  <button
                    key={actionType.value}
                    onClick={() => addAction(actionType.value)}
                    className={clsx(
                      'px-3 py-1.5 border rounded-lg text-sm capitalize transition-colors',
                      `border-${actionType.color}-300 hover:bg-${actionType.color}-50 text-${actionType.color}-700`
                    )}
                  >
                    + {actionType.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {actions.map((action, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'flex items-center justify-between p-2 rounded-lg',
                      action.type === 'allow' ? 'bg-green-50' :
                      action.type === 'deny' ? 'bg-red-50' :
                      action.type === 'escalate' ? 'bg-amber-50' :
                      'bg-blue-50'
                    )}
                  >
                    <span className={clsx(
                      'text-sm font-medium capitalize',
                      action.type === 'allow' ? 'text-green-700' :
                      action.type === 'deny' ? 'text-red-700' :
                      action.type === 'escalate' ? 'text-amber-700' :
                      'text-blue-700'
                    )}>
                      {action.type}
                    </span>
                    <button
                      onClick={() => removeAction(i)}
                      className="p-1 hover:bg-white/50 rounded"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ))}
              </div>
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
            onClick={() => onSave({ ...formData, conditions, actions })}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Save Rule
          </button>
        </div>
      </div>
    </div>
  );
}
