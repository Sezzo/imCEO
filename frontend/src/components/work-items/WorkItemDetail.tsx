import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X,
  Save,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  History,
  GitBranch,
  Paperclip,
  MessageSquare,
  Tag,
  User,
  Users,
  Building,
  Target,
  Calendar,
  Flag,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import type { WorkItem, WorkItemType, WorkItemState } from '../../api/client';

const WORK_ITEM_TYPES: WorkItemType[] = [
  'Vision', 'Goal', 'Initiative', 'Program', 'Workstream',
  'Epic', 'Story', 'Task', 'Subtask',
  'Bug', 'Spike', 'ReviewTask', 'TestTask', 'ReleaseTask'
];

const WORK_ITEM_STATES: WorkItemState[] = [
  'Draft', 'Proposed', 'Approved', 'Planned', 'Ready', 'InProgress',
  'WaitingOnDependency', 'InReview', 'ChangesRequested', 'InTest',
  'AwaitingApproval', 'ApprovedForCompletion', 'Done', 'Archived',
  'Reopened', 'Rejected', 'Cancelled', 'Blocked'
];

const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const SEVERITIES = ['critical', 'major', 'minor', 'trivial'];

const TYPE_COLORS: Record<WorkItemType, string> = {
  Vision: 'bg-red-100 text-red-700',
  Goal: 'bg-orange-100 text-orange-700',
  Initiative: 'bg-amber-100 text-amber-700',
  Program: 'bg-yellow-100 text-yellow-700',
  Workstream: 'bg-lime-100 text-lime-700',
  Epic: 'bg-green-100 text-green-700',
  Story: 'bg-emerald-100 text-emerald-700',
  Task: 'bg-teal-100 text-teal-700',
  Subtask: 'bg-cyan-100 text-cyan-700',
  Bug: 'bg-rose-100 text-rose-700',
  Spike: 'bg-blue-100 text-blue-700',
  ReviewTask: 'bg-indigo-100 text-indigo-700',
  TestTask: 'bg-violet-100 text-violet-700',
  ReleaseTask: 'bg-purple-100 text-purple-700',
};

const STATE_COLORS: Record<WorkItemState, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Proposed: 'bg-gray-100 text-gray-700',
  Approved: 'bg-blue-100 text-blue-700',
  Planned: 'bg-blue-100 text-blue-700',
  Ready: 'bg-green-100 text-green-700',
  InProgress: 'bg-yellow-100 text-yellow-700',
  WaitingOnDependency: 'bg-amber-100 text-amber-700',
  InReview: 'bg-purple-100 text-purple-700',
  ChangesRequested: 'bg-orange-100 text-orange-700',
  InTest: 'bg-cyan-100 text-cyan-700',
  AwaitingApproval: 'bg-indigo-100 text-indigo-700',
  ApprovedForCompletion: 'bg-teal-100 text-teal-700',
  Done: 'bg-green-100 text-green-700',
  Archived: 'bg-gray-100 text-gray-500',
  Reopened: 'bg-rose-100 text-rose-700',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-100 text-gray-500',
  Blocked: 'bg-red-100 text-red-700',
};

const workItemSchema = z.object({
  type: z.enum(['Vision', 'Goal', 'Initiative', 'Program', 'Workstream', 'Epic', 'Story', 'Task', 'Subtask', 'Bug', 'Spike', 'ReviewTask', 'TestTask', 'ReleaseTask']),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),
  state: z.enum(['Draft', 'Proposed', 'Approved', 'Planned', 'Ready', 'InProgress', 'WaitingOnDependency', 'InReview', 'ChangesRequested', 'InTest', 'AwaitingApproval', 'ApprovedForCompletion', 'Done', 'Archived', 'Reopened', 'Rejected', 'Cancelled', 'Blocked']),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  severity: z.enum(['critical', 'major', 'minor', 'trivial']).optional(),
  parentWorkItemId: z.string().optional(),
  owningTeamId: z.string().optional(),
  assignedAgentId: z.string().optional(),
  estimatedEffort: z.number().min(0).optional(),
  actualEffort: z.number().min(0).optional(),
  costLimit: z.number().min(0).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  dueAt: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

type WorkItemFormData = z.infer<typeof workItemSchema>;

interface WorkItemDetailProps {
  workItem: WorkItem | null;
  isCreating?: boolean;
  parentId?: string | null;
  availableParents: WorkItem[];
  availableTeams: { teamId: string; name: string }[];
  availableAgents: { agentId: string; displayName: string; teamId: string }[];
  onSave: (data: WorkItemFormData) => void;
  onCancel: () => void;
  onDelete?: (workItemId: string) => void;
  onTransition?: (workItemId: string, toState: WorkItemState, reason?: string) => void;
}

export function WorkItemDetail({
  workItem,
  isCreating = false,
  parentId,
  availableParents,
  availableTeams,
  availableAgents,
  onSave,
  onCancel,
  onDelete,
  onTransition,
}: WorkItemDetailProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'comments' | 'artifacts'>('details');
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionState, setTransitionState] = useState<WorkItemState | null>(null);
  const [transitionReason, setTransitionReason] = useState('');

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<WorkItemFormData>({
    resolver: zodResolver(workItemSchema),
    defaultValues: {
      type: 'Story',
      title: '',
      description: '',
      state: 'Draft',
      priority: 'medium',
      severity: 'minor',
      tags: [],
      estimatedEffort: undefined,
      actualEffort: undefined,
      costLimit: undefined,
      riskScore: undefined,
      dueAt: undefined,
    },
  });

  const watchedType = watch('type');
  const watchedState = watch('state');
  const watchedTeamId = watch('owningTeamId');

  useEffect(() => {
    if (workItem) {
      setValue('type', workItem.type);
      setValue('title', workItem.title);
      setValue('description', workItem.description || '');
      setValue('state', workItem.state);
      setValue('priority', workItem.priority as any);
      setValue('severity', workItem.severity as any);
      setValue('owningTeamId', workItem.owningTeamId || '');
      setValue('assignedAgentId', workItem.assignedAgentId || '');
      setValue('estimatedEffort', workItem.estimatedEffort || undefined);
      setValue('actualEffort', workItem.actualEffort || undefined);
      setValue('costLimit', workItem.costLimit || undefined);
      setValue('riskScore', workItem.riskScore || undefined);
      setValue('dueAt', workItem.dueAt || '');
    }
  }, [workItem, setValue]);

  useEffect(() => {
    if (parentId) {
      setValue('parentWorkItemId', parentId);
    }
  }, [parentId, setValue]);

  const filteredAgents = availableAgents.filter(
    (agent) => !watchedTeamId || agent.teamId === watchedTeamId
  );

  const onSubmit = (data: WorkItemFormData) => {
    onSave(data);
  };

  const handleTransition = (toState: WorkItemState) => {
    setTransitionState(toState);
    setShowTransitionModal(true);
  };

  const confirmTransition = () => {
    if (transitionState && workItem && onTransition) {
      onTransition(workItem.workItemId, transitionState, transitionReason);
      setShowTransitionModal(false);
      setTransitionState(null);
      setTransitionReason('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className={clsx(
        'px-6 py-4 border-b border-gray-200 flex items-center justify-between',
        TYPE_COLORS[watchedType]?.split(' ')[0] || 'bg-gray-50'
      )}>
        <div className="flex items-center gap-3">
          <div className={clsx('p-2 rounded-lg bg-white/80', TYPE_COLORS[watchedType]?.split(' ')[1])}>
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isCreating ? 'Create Work Item' : 'Edit Work Item'}
            </h2>
            <p className="text-sm text-gray-500">
              {workItem ? `ID: ${workItem.workItemId}` : 'Define a new work item'}
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-white/50 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200">
        <div className="flex gap-1">
          {(['details', 'history', 'comments', 'artifacts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          {activeTab === 'details' && (
            <div className="p-6 space-y-6">
              {/* Type & State */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('type')}
                    className={clsx(
                      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500',
                      errors.type ? 'border-red-300' : 'border-gray-300'
                    )}
                  >
                    {WORK_ITEM_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <select
                    {...register('state')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {WORK_ITEM_STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('title')}
                  className={clsx(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500',
                    errors.title ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="Enter work item title..."
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  placeholder="Describe the work item, requirements, acceptance criteria..."
                />
              </div>

              {/* Priority & Severity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    {...register('priority')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select priority...</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p} className={clsx(
                        p === 'critical' ? 'text-red-600' :
                        p === 'high' ? 'text-orange-600' :
                        p === 'medium' ? 'text-yellow-600' : 'text-gray-600'
                      )}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Severity
                  </label>
                  <select
                    {...register('severity')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select severity...</option>
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Parent & Assignment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent Work Item
                  </label>
                  <select
                    {...register('parentWorkItemId')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">No parent (top-level)</option>
                    {availableParents
                      .filter((p) => p.workItemId !== workItem?.workItemId)
                      .map((parent) => (
                        <option key={parent.workItemId} value={parent.workItemId}>
                          {parent.type}: {parent.title.slice(0, 50)}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owning Team
                  </label>
                  <select
                    {...register('owningTeamId')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select team...</option>
                    {availableTeams.map((team) => (
                      <option key={team.teamId} value={team.teamId}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned Agent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Agent
                </label>
                <select
                  {...register('assignedAgentId')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  disabled={!watchedTeamId}
                >
                  <option value="">Unassigned</option>
                  {filteredAgents.map((agent) => (
                    <option key={agent.agentId} value={agent.agentId}>
                      {agent.displayName}
                    </option>
                  ))}
                </select>
                {!watchedTeamId && (
                  <p className="mt-1 text-xs text-gray-500">Select a team first to see available agents</p>
                )}
              </div>

              {/* Estimates & Limits */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Effort (hours)
                  </label>
                  <input
                    type="number"
                    {...register('estimatedEffort', { valueAsNumber: true })}
                    min={0}
                    step={0.5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost Limit ($)
                  </label>
                  <input
                    type="number"
                    {...register('costLimit', { valueAsNumber: true })}
                    min={0}
                    step={0.01}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Score (0-100)
                  </label>
                  <input
                    type="number"
                    {...register('riskScore', { valueAsNumber: true })}
                    min={0}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="datetime-local"
                  {...register('dueAt')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'history' && workItem && (
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Created</p>
                    <p className="text-xs text-gray-500">{format(new Date(workItem.createdAt), 'PPP p')}</p>
                  </div>
                </div>
                {workItem.startedAt && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <ArrowRight className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Started</p>
                      <p className="text-xs text-gray-500">{format(new Date(workItem.startedAt), 'PPP p')}</p>
                    </div>
                  </div>
                )}
                {workItem.completedAt && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Completed</p>
                      <p className="text-xs text-gray-500">{format(new Date(workItem.completedAt), 'PPP p')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="p-6">
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Comments coming soon</p>
              </div>
            </div>
          )}

          {activeTab === 'artifacts' && (
            <div className="p-6">
              <div className="text-center py-12 text-gray-500">
                <Paperclip className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Artifacts coming soon</p>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
        <div className="flex gap-2">
          {!isCreating && onDelete && workItem && (
            <button
              onClick={() => onDelete(workItem.workItemId)}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          {!isCreating && onTransition && workItem && (
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
                <ArrowRight className="w-4 h-4" />
                Transition To
              </button>
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                {WORK_ITEM_STATES.filter(s => s !== workItem?.state).map((state) => (
                  <button
                    key={state}
                    onClick={() => handleTransition(state)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={!isDirty || isSubmitting}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              isDirty && !isSubmitting
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : isCreating ? 'Create Work Item' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Transition Confirmation Modal */}
      {showTransitionModal && transitionState && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Transition to {transitionState}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Add an optional reason for this state change.
            </p>
            <textarea
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
              placeholder="Reason for transition..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowTransitionModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmTransition}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Confirm Transition
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
