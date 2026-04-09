import { useState } from 'react';
import {
  Inbox,
  CheckCircle,
  XCircle,
  ArrowUpCircle,
  Clock,
  Filter,
  Search,
  Eye,
  FileText,
  User,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Calendar,
  MessageSquare,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export type ApprovalType = 'work_item' | 'cost_limit' | 'policy_change' | 'deployment' | 'access_request' | 'emergency';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated' | 'auto_approved';

interface ApprovalRequest {
  approvalId: string;
  type: ApprovalType;
  title: string;
  description: string;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  approverId: string;
  approverName: string;
  status: ApprovalStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  costAmount?: number;
  relatedWorkItemId?: string;
  relatedWorkItemTitle?: string;
  relatedArtifactId?: string;
  justification: string;
  conditions?: string[];
  expiresAt?: string;
  createdAt: string;
  decidedAt?: string;
  decisionReason?: string;
}

interface ApprovalInboxProps {
  approvals: ApprovalRequest[];
  currentAgentId: string;
  currentAgentRole: string;
  onApprove: (approvalId: string, reason?: string) => void;
  onReject: (approvalId: string, reason: string) => void;
  onEscalate: (approvalId: string, reason: string) => void;
  onViewDetails: (approvalId: string) => void;
}

const TYPE_CONFIG: Record<ApprovalType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  work_item: { label: 'Work Item', icon: <FileText className="w-4 h-4" />, color: 'text-blue-700', bg: 'bg-blue-100' },
  cost_limit: { label: 'Cost Limit', icon: <DollarSign className="w-4 h-4" />, color: 'text-green-700', bg: 'bg-green-100' },
  policy_change: { label: 'Policy Change', icon: <FileText className="w-4 h-4" />, color: 'text-purple-700', bg: 'bg-purple-100' },
  deployment: { label: 'Deployment', icon: <ExternalLink className="w-4 h-4" />, color: 'text-amber-700', bg: 'bg-amber-100' },
  access_request: { label: 'Access Request', icon: <User className="w-4 h-4" />, color: 'text-indigo-700', bg: 'bg-indigo-100' },
  emergency: { label: 'Emergency', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-700', bg: 'bg-red-100' },
};

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', icon: <Clock className="w-4 h-4" /> },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50', icon: <XCircle className="w-4 h-4" /> },
  escalated: { label: 'Escalated', color: 'text-orange-700', bg: 'bg-orange-50', icon: <ArrowUpCircle className="w-4 h-4" /> },
  auto_approved: { label: 'Auto-Approved', color: 'text-blue-700', bg: 'bg-blue-50', icon: <CheckCircle className="w-4 h-4" /> },
};

const PRIORITY_CONFIG = {
  low: { color: 'text-gray-600', bg: 'bg-gray-100' },
  medium: { color: 'text-blue-600', bg: 'bg-blue-100' },
  high: { color: 'text-orange-600', bg: 'bg-orange-100' },
  critical: { color: 'text-red-600', bg: 'bg-red-100' },
};

export function ApprovalInbox({
  approvals,
  currentAgentId,
  currentAgentRole,
  onApprove,
  onReject,
  onEscalate,
  onViewDetails,
}: ApprovalInboxProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ApprovalType | 'all'>('all');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState<'approve' | 'reject' | 'escalate' | null>(null);
  const [decisionReason, setDecisionReason] = useState('');

  const myApprovals = approvals.filter((a) => a.approverId === currentAgentId);

  const filteredApprovals = myApprovals.filter((a) => {
    const matchesSearch =
      !searchTerm ||
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || a.type === filterType;
    const matchesTab =
      activeTab === 'all' ? true :
      activeTab === 'pending' ? a.status === 'pending' :
      activeTab === 'approved' ? (a.status === 'approved' || a.status === 'auto_approved') :
      activeTab === 'rejected' ? (a.status === 'rejected' || a.status === 'escalated') :
      true;

    return matchesSearch && matchesType && matchesTab;
  });

  const pendingCount = myApprovals.filter((a) => a.status === 'pending').length;
  const criticalPendingCount = myApprovals.filter((a) => a.status === 'pending' && a.priority === 'critical').length;

  const handleDecision = () => {
    if (!selectedApproval || !decisionType) return;

    switch (decisionType) {
      case 'approve':
        onApprove(selectedApproval.approvalId, decisionReason);
        break;
      case 'reject':
        onReject(selectedApproval.approvalId, decisionReason);
        break;
      case 'escalate':
        onEscalate(selectedApproval.approvalId, decisionReason);
        break;
    }

    setShowDecisionModal(false);
    setDecisionType(null);
    setDecisionReason('');
    setSelectedApproval(null);
  };

  const openDecisionModal = (approval: ApprovalRequest, type: 'approve' | 'reject' | 'escalate') => {
    setSelectedApproval(approval);
    setDecisionType(type);
    setShowDecisionModal(true);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-5xl h-[80vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Inbox className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Approval Inbox</h2>
            <p className="text-sm text-gray-500">
              {pendingCount} pending • {criticalPendingCount} critical
            </p>
          </div>
        </div>
        {criticalPendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            {criticalPendingCount} Critical
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200">
        <div className="flex gap-1">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
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
              {tab}
              {tab === 'pending' && pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-200 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search approvals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ApprovalType | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredApprovals.length === 0 ? (
          <div className="text-center py-12">
            <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No approvals found</h3>
            <p className="text-sm text-gray-500">
              {activeTab === 'pending'
                ? 'You have no pending approvals. Great job!'
                : `No ${activeTab} approvals match your filters`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApprovals.map((approval) => {
              const typeConfig = TYPE_CONFIG[approval.type];
              const statusConfig = STATUS_CONFIG[approval.status];
              const priorityConfig = PRIORITY_CONFIG[approval.priority];
              const isPending = approval.status === 'pending';

              return (
                <div
                  key={approval.approvalId}
                  className={clsx(
                    'border rounded-lg p-4 transition-all',
                    isPending && approval.priority === 'critical'
                      ? 'border-red-300 bg-red-50/30'
                      : isPending
                      ? 'border-emerald-200 bg-emerald-50/10 hover:border-emerald-300'
                      : 'border-gray-200'
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={clsx('p-2 rounded-lg', typeConfig.bg)}>
                        {typeConfig.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{approval.title}</h4>
                          <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', priorityConfig.bg, priorityConfig.color)}>
                            {approval.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span className={clsx('font-medium', typeConfig.color)}>{typeConfig.label}</span>
                          <span>•</span>
                          <span>ID: {approval.approvalId.slice(0, 6)}</span>
                        </div>
                      </div>
                    </div>
                    <span className={clsx('px-2 py-1 rounded text-xs font-medium', statusConfig.bg, statusConfig.color)}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{approval.description}</p>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Requester:</span>
                      <span className="font-medium text-gray-900">{approval.requesterName}</span>
                      <span className="text-xs text-gray-400">({approval.requesterRole})</span>
                    </div>
                    {approval.costAmount && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Amount:</span>
                        <span className="font-medium text-gray-900">${approval.costAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {approval.relatedWorkItemTitle && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Related:</span>
                        <span className="font-medium text-gray-900 truncate">{approval.relatedWorkItemTitle}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Created:</span>
                      <span className="font-medium text-gray-900">
                        {format(new Date(approval.createdAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>

                  {/* Justification */}
                  <div className="p-3 bg-gray-50 rounded-lg mb-3">
                    <p className="text-xs text-gray-500 mb-1">Justification:</p>
                    <p className="text-sm text-gray-700">{approval.justification}</p>
                  </div>

                  {/* Conditions */}
                  {approval.conditions && approval.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {approval.conditions.map((condition, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full"
                        >
                          {condition}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expiry Warning */}
                  {approval.expiresAt && isPending && (
                    <div className={clsx(
                      'flex items-center gap-2 text-sm mb-3',
                      new Date(approval.expiresAt) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                        ? 'text-red-600'
                        : 'text-amber-600'
                    )}>
                      <Clock className="w-4 h-4" />
                      <span>
                        Expires: {format(new Date(approval.expiresAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {isPending && (
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => openDecisionModal(approval, 'approve')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => openDecisionModal(approval, 'reject')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => openDecisionModal(approval, 'escalate')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200"
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                        Escalate
                      </button>
                      <button
                        onClick={() => onViewDetails(approval.approvalId)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium ml-auto"
                      >
                        <Eye className="w-4 h-4" />
                        Details
                      </button>
                    </div>
                  )}

                  {/* Decision Info */}
                  {!isPending && approval.decidedAt && (
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100 text-sm">
                      <span className="text-gray-500">
                        {approval.status === 'approved' || approval.status === 'auto_approved'
                          ? 'Approved'
                          : approval.status === 'rejected'
                          ? 'Rejected'
                          : 'Escalated'}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500">
                        {format(new Date(approval.decidedAt), 'MMM d, h:mm a')}
                      </span>
                      {approval.decisionReason && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-600">{approval.decisionReason}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {showDecisionModal && selectedApproval && decisionType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              {decisionType === 'approve' && (
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              )}
              {decisionType === 'reject' && (
                <div className="p-2 bg-red-100 rounded-full">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              )}
              {decisionType === 'escalate' && (
                <div className="p-2 bg-amber-100 rounded-full">
                  <ArrowUpCircle className="w-6 h-6 text-amber-600" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {decisionType === 'approve' ? 'Approve Request' :
                   decisionType === 'reject' ? 'Reject Request' :
                   'Escalate Request'}
                </h3>
                <p className="text-sm text-gray-500">{selectedApproval.title}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {decisionType === 'approve' ? 'Comment (Optional)' : 'Reason Required'}
              </label>
              <textarea
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder={
                  decisionType === 'approve'
                    ? 'Add an optional comment...'
                    : 'Explain why you are rejecting this request...'
                }
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDecisionModal(false);
                  setDecisionType(null);
                  setDecisionReason('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDecision}
                disabled={decisionType !== 'approve' && !decisionReason}
                className={clsx(
                  'px-4 py-2 rounded-lg font-medium disabled:opacity-50',
                  decisionType === 'approve'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : decisionType === 'reject'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                )}
              >
                Confirm {decisionType === 'approve' ? 'Approval' : decisionType === 'reject' ? 'Rejection' : 'Escalation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
