import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRightLeft,
  Send,
  X,
  Clock,
  User,
  Users,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  History,
  Target,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Eye,
  Ban,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import type { WorkItem } from '../../api/client';

export type DelegationStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';

interface Delegation {
  delegationId: string;
  workItemId: string;
  workItemTitle: string;
  workItemType: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  toTeamId: string;
  toTeamName: string;
  status: DelegationStatus;
  reason: string;
  instructions: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completionNotes?: string;
}

const delegationSchema = z.object({
  workItemId: z.string().min(1, 'Work item is required'),
  toAgentId: z.string().min(1, 'Target agent is required'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
  instructions: z.string().max(2000, 'Instructions too long').optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

type DelegationFormData = z.infer<typeof delegationSchema>;

interface DelegationUIProps {
  delegations: Delegation[];
  availableWorkItems: WorkItem[];
  availableAgents: { agentId: string; displayName: string; teamId: string; teamName: string; status: string }[];
  currentAgentId: string;
  onCreateDelegation: (data: DelegationFormData) => void;
  onAcceptDelegation: (delegationId: string) => void;
  onRejectDelegation: (delegationId: string, reason: string) => void;
  onCompleteDelegation: (delegationId: string, notes: string) => void;
  onCancelDelegation: (delegationId: string) => void;
}

const STATUS_CONFIG: Record<DelegationStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', icon: <Clock className="w-4 h-4" /> },
  accepted: { label: 'Accepted', color: 'text-blue-700', bg: 'bg-blue-50', icon: <CheckCircle className="w-4 h-4" /> },
  in_progress: { label: 'In Progress', color: 'text-purple-700', bg: 'bg-purple-50', icon: <RotateCcw className="w-4 h-4" /> },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-50', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50', icon: <Ban className="w-4 h-4" /> },
  cancelled: { label: 'Cancelled', color: 'text-gray-700', bg: 'bg-gray-50', icon: <Ban className="w-4 h-4" /> },
};

export function DelegationUI({
  delegations,
  availableWorkItems,
  availableAgents,
  currentAgentId,
  onCreateDelegation,
  onAcceptDelegation,
  onRejectDelegation,
  onCompleteDelegation,
  onCancelDelegation,
}: DelegationUIProps) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'create'>('incoming');
  const [selectedDelegation, setSelectedDelegation] = useState<Delegation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<DelegationStatus | 'all'>('all');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DelegationFormData>({
    resolver: zodResolver(delegationSchema),
    defaultValues: {
      priority: 'medium',
    },
  });

  const incomingDelegations = delegations.filter((d) => d.toAgentId === currentAgentId);
  const outgoingDelegations = delegations.filter((d) => d.fromAgentId === currentAgentId);

  const filteredDelegations = (activeTab === 'incoming' ? incomingDelegations : outgoingDelegations).filter(
    (d) => {
      const matchesSearch =
        !searchTerm ||
        d.workItemTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.fromAgentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.toAgentName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || d.status === filterStatus;

      return matchesSearch && matchesStatus;
    }
  );

  const onSubmit = (data: DelegationFormData) => {
    onCreateDelegation(data);
    reset();
    setActiveTab('outgoing');
  };

  const handleReject = () => {
    if (selectedDelegation && rejectionReason) {
      onRejectDelegation(selectedDelegation.delegationId, rejectionReason);
      setShowRejectionModal(false);
      setRejectionReason('');
      setSelectedDelegation(null);
    }
  };

  const handleComplete = () => {
    if (selectedDelegation) {
      onCompleteDelegation(selectedDelegation.delegationId, completionNotes);
      setShowCompletionModal(false);
      setCompletionNotes('');
      setSelectedDelegation(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Delegation Center</h2>
            <p className="text-sm text-gray-500">
              {incomingDelegations.filter(d => d.status === 'pending').length} pending incoming • {outgoingDelegations.length} outgoing
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200">
        <div className="flex gap-1">
          {(['incoming', 'outgoing', 'create'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab === 'incoming' && (
                <span className="flex items-center gap-2">
                  Incoming
                  {incomingDelegations.filter(d => d.status === 'pending').length > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                      {incomingDelegations.filter(d => d.status === 'pending').length}
                    </span>
                  )}
                </span>
              )}
              {tab === 'outgoing' && 'Outgoing'}
              {tab === 'create' && (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  New Delegation
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {(activeTab === 'incoming' || activeTab === 'outgoing') && (
          <div className="h-full flex flex-col">
            {/* Filters */}
            <div className="p-4 border-b border-gray-200 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search delegations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as DelegationStatus | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                {Object.keys(STATUS_CONFIG).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_CONFIG[status as DelegationStatus].label}
                  </option>
                ))}
              </select>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredDelegations.length === 0 ? (
                <div className="text-center py-12">
                  <ArrowRightLeft className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    No {activeTab} delegations
                  </h3>
                  <p className="text-sm text-gray-500">
                    {activeTab === 'incoming'
                      ? 'You have no delegated work items awaiting your response'
                      : 'You haven\'t delegated any work items yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDelegations.map((delegation) => {
                    const statusConfig = STATUS_CONFIG[delegation.status];
                    const isPending = delegation.status === 'pending';
                    const isIncoming = activeTab === 'incoming';

                    return (
                      <div
                        key={delegation.delegationId}
                        className={clsx(
                          'border rounded-lg p-4 transition-all',
                          isPending && isIncoming
                            ? 'border-blue-300 bg-blue-50/30'
                            : 'border-gray-200 hover:border-blue-300'
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={clsx('p-2 rounded-lg', statusConfig.bg)}>
                              {statusConfig.icon}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{delegation.workItemTitle}</h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <span>{delegation.workItemType}</span>
                                <span>•</span>
                                <span>ID: {delegation.delegationId.slice(0, 6)}</span>
                              </div>
                            </div>
                          </div>
                          <span className={clsx('px-2 py-1 rounded text-xs font-medium', statusConfig.bg, statusConfig.color)}>
                            {statusConfig.label}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">From:</span>
                            <span className="font-medium text-gray-900">{delegation.fromAgentName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">To:</span>
                            <span className="font-medium text-gray-900">{delegation.toAgentName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Team:</span>
                            <span className="font-medium text-gray-900">{delegation.toTeamName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Created:</span>
                            <span className="font-medium text-gray-900">
                              {format(new Date(delegation.createdAt), 'MMM d, h:mm a')}
                            </span>
                          </div>
                        </div>

                        {/* Reason & Instructions */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-start gap-2 text-sm">
                            <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <span className="text-gray-500">Reason: </span>
                              <span className="text-gray-700">{delegation.reason}</span>
                            </div>
                          </div>
                          {delegation.instructions && (
                            <div className="flex items-start gap-2 text-sm">
                              <Target className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <span className="text-gray-500">Instructions: </span>
                                <span className="text-gray-700">{delegation.instructions}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                          {isIncoming && isPending && (
                            <>
                              <button
                                onClick={() => onAcceptDelegation(delegation.delegationId)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Accept
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDelegation(delegation);
                                  setShowRejectionModal(true);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                              >
                                <Ban className="w-4 h-4" />
                                Reject
                              </button>
                            </>
                          )}
                          {isIncoming && delegation.status === 'in_progress' && (
                            <button
                              onClick={() => {
                                setSelectedDelegation(delegation);
                                setShowCompletionModal(true);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Mark Complete
                            </button>
                          )}
                          {!isIncoming && isPending && (
                            <button
                              onClick={() => onCancelDelegation(delegation.delegationId)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                            >
                              <Ban className="w-4 h-4" />
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedDelegation(delegation)}
                            className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium ml-auto"
                          >
                            <Eye className="w-4 h-4" />
                            Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="p-6 overflow-y-auto">
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
              {/* Work Item Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Item <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('workItemId')}
                  className={clsx(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500',
                    errors.workItemId ? 'border-red-300' : 'border-gray-300'
                  )}
                >
                  <option value="">Select a work item...</option>
                  {availableWorkItems
                    .filter((w) => !w.assignedAgentId || w.assignedAgentId === currentAgentId)
                    .map((item) => (
                      <option key={item.workItemId} value={item.workItemId}>
                        {item.type}: {item.title}
                      </option>
                    ))}
                </select>
                {errors.workItemId && (
                  <p className="mt-1 text-sm text-red-500">{errors.workItemId.message}</p>
                )}
              </div>

              {/* Target Agent Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delegate To <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('toAgentId')}
                  className={clsx(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500',
                    errors.toAgentId ? 'border-red-300' : 'border-gray-300'
                  )}
                >
                  <option value="">Select an agent...</option>
                  {availableAgents
                    .filter((a) => a.agentId !== currentAgentId)
                    .map((agent) => (
                      <option key={agent.agentId} value={agent.agentId}>
                        {agent.displayName} ({agent.teamName}) - {agent.status}
                      </option>
                    ))}
                </select>
                {errors.toAgentId && (
                  <p className="mt-1 text-sm text-red-500">{errors.toAgentId.message}</p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                    <label
                      key={p}
                      className={clsx(
                        'flex items-center justify-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors',
                        watch('priority') === p
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="radio"
                        {...register('priority')}
                        value={p}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium capitalize">{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  {...register('dueDate')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Delegation <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('reason')}
                  rows={3}
                  className={clsx(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500',
                    errors.reason ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="Explain why you're delegating this work item..."
                />
                {errors.reason && (
                  <p className="mt-1 text-sm text-red-500">{errors.reason.message}</p>
                )}
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructions (Optional)
                </label>
                <textarea
                  {...register('instructions')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Provide any specific instructions for completing this work item..."
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('incoming')}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Sending...' : 'Send Delegation'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectionModal && selectedDelegation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Reject Delegation
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Please provide a reason for rejecting this delegation.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRejectionModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Reject Delegation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletionModal && selectedDelegation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Complete Delegation
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Add any notes about the completion of this delegated work.
            </p>
            <textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Completion notes (optional)..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCompletionModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
