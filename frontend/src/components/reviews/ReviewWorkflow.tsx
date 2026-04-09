import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  CheckCircle,
  XCircle,
  MessageSquare,
  FileText,
  Send,
  X,
  AlertCircle,
  Clock,
  User,
  GitPullRequest,
  ChevronRight,
  Filter,
  Search,
  Plus,
  History,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import type { Artifact, WorkItem } from '../../api/client';

export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'changes_requested';
export type FindingSeverity = 'critical' | 'major' | 'minor' | 'info';

interface ReviewFinding {
  findingId: string;
  lineNumber?: number;
  filePath?: string;
  severity: FindingSeverity;
  category: string;
  description: string;
  suggestion?: string;
  resolved: boolean;
  createdAt: string;
}

interface Review {
  reviewId: string;
  artifactId: string;
  artifactTitle: string;
  artifactType: string;
  workItemId?: string;
  workItemTitle?: string;
  requesterId: string;
  requesterName: string;
  reviewerId: string;
  reviewerName: string;
  status: ReviewStatus;
  scope: string;
  focusAreas: string[];
  findings: ReviewFinding[];
  summary?: string;
  verdict?: 'approve' | 'reject' | 'changes_needed';
  submittedAt?: string;
  completedAt?: string;
  dueDate?: string;
  createdAt: string;
}

const reviewRequestSchema = z.object({
  artifactId: z.string().min(1, 'Artifact is required'),
  reviewerId: z.string().min(1, 'Reviewer is required'),
  scope: z.string().min(1, 'Scope is required').max(500, 'Scope too long'),
  focusAreas: z.array(z.string()).default([]),
  dueDate: z.string().optional(),
});

type ReviewRequestFormData = z.infer<typeof reviewRequestSchema>;

const findingSchema = z.object({
  severity: z.enum(['critical', 'major', 'minor', 'info']),
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required').max(1000, 'Description too long'),
  suggestion: z.string().max(1000, 'Suggestion too long').optional(),
  lineNumber: z.number().optional(),
  filePath: z.string().optional(),
});

type FindingFormData = z.infer<typeof findingSchema>;

interface ReviewWorkflowProps {
  reviews: Review[];
  artifacts: Artifact[];
  availableReviewers: { agentId: string; displayName: string; teamName: string }[];
  currentAgentId: string;
  onRequestReview: (data: ReviewRequestFormData) => void;
  onSubmitReview: (reviewId: string, findings: ReviewFinding[], summary: string, verdict: 'approve' | 'reject' | 'changes_needed') => void;
  onResolveFinding: (reviewId: string, findingId: string) => void;
  onAddFinding: (reviewId: string, finding: FindingFormData) => void;
}

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', icon: <Clock className="w-4 h-4" /> },
  in_review: { label: 'In Review', color: 'text-blue-700', bg: 'bg-blue-50', icon: <Eye className="w-4 h-4" /> },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50', icon: <XCircle className="w-4 h-4" /> },
  changes_requested: { label: 'Changes Requested', color: 'text-orange-700', bg: 'bg-orange-50', icon: <GitPullRequest className="w-4 h-4" /> },
};

const SEVERITY_CONFIG: Record<FindingSeverity, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100' },
  major: { label: 'Major', color: 'text-orange-700', bg: 'bg-orange-100' },
  minor: { label: 'Minor', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  info: { label: 'Info', color: 'text-blue-700', bg: 'bg-blue-100' },
};

const FINDING_CATEGORIES = [
  'Code Quality',
  'Security',
  'Performance',
  'Architecture',
  'Documentation',
  'Testing',
  'Maintainability',
  'Best Practices',
];

export function ReviewWorkflow({
  reviews,
  artifacts,
  availableReviewers,
  currentAgentId,
  onRequestReview,
  onSubmitReview,
  onResolveFinding,
  onAddFinding,
}: ReviewWorkflowProps) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'create'>('incoming');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | 'all'>('all');
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [reviewSummary, setReviewSummary] = useState('');
  const [reviewVerdict, setReviewVerdict] = useState<'approve' | 'reject' | 'changes_needed'>('changes_needed');
  const [findings, setFindings] = useState<ReviewFinding[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ReviewRequestFormData>({
    resolver: zodResolver(reviewRequestSchema),
    defaultValues: {
      focusAreas: [],
    },
  });

  const {
    register: registerFinding,
    handleSubmit: handleSubmitFinding,
    formState: { errors: findingErrors },
    reset: resetFinding,
  } = useForm<FindingFormData>({
    resolver: zodResolver(findingSchema),
  });

  const incomingReviews = reviews.filter((r) => r.reviewerId === currentAgentId);
  const outgoingReviews = reviews.filter((r) => r.requesterId === currentAgentId);

  const filteredReviews = (activeTab === 'incoming' ? incomingReviews : outgoingReviews).filter(
    (r) => {
      const matchesSearch =
        !searchTerm ||
        r.artifactTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reviewerName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || r.status === filterStatus;

      return matchesSearch && matchesStatus;
    }
  );

  const onSubmit = (data: ReviewRequestFormData) => {
    onRequestReview(data);
    reset();
    setActiveTab('outgoing');
  };

  const onSubmitFinding = (data: FindingFormData) => {
    if (selectedReview) {
      onAddFinding(selectedReview.reviewId, data);
      setFindings([...findings, {
        findingId: `finding-${Date.now()}`,
        ...data,
        resolved: false,
        createdAt: new Date().toISOString(),
      }]);
      setShowFindingModal(false);
      resetFinding();
    }
  };

  const handleSubmitReview = () => {
    if (selectedReview && (findings.length > 0 || reviewVerdict === 'approve')) {
      onSubmitReview(selectedReview.reviewId, findings, reviewSummary, reviewVerdict);
      setSelectedReview(null);
      setFindings([]);
      setReviewSummary('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Eye className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Review Workflow</h2>
            <p className="text-sm text-gray-500">
              {incomingReviews.filter(r => r.status === 'pending').length} pending reviews • {outgoingReviews.length} requested
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
              onClick={() => {
                setActiveTab(tab);
                setSelectedReview(null);
              }}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab === 'incoming' && (
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  My Reviews
                  {incomingReviews.filter(r => r.status === 'pending').length > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                      {incomingReviews.filter(r => r.status === 'pending').length}
                    </span>
                  )}
                </span>
              )}
              {tab === 'outgoing' && (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Requested
                </span>
              )}
              {tab === 'create' && (
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Request Review
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {selectedReview ? (
          <ReviewDetailView
            review={selectedReview}
            findings={findings}
            onBack={() => setSelectedReview(null)}
            onAddFinding={() => setShowFindingModal(true)}
            onResolveFinding={(findingId) => onResolveFinding(selectedReview.reviewId, findingId)}
            onSubmitReview={handleSubmitReview}
            reviewSummary={reviewSummary}
            setReviewSummary={setReviewSummary}
            reviewVerdict={reviewVerdict}
            setReviewVerdict={setReviewVerdict}
            isIncoming={selectedReview.reviewerId === currentAgentId}
          />
        ) : (activeTab === 'incoming' || activeTab === 'outgoing') ? (
          <div className="h-full flex flex-col">
            {/* Filters */}
            <div className="p-4 border-b border-gray-200 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search reviews..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ReviewStatus | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                {Object.keys(STATUS_CONFIG).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_CONFIG[status as ReviewStatus].label}
                  </option>
                ))}
              </select>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredReviews.length === 0 ? (
                <div className="text-center py-12">
                  <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    No {activeTab} reviews
                  </h3>
                  <p className="text-sm text-gray-500">
                    {activeTab === 'incoming'
                      ? 'You have no reviews assigned to you'
                      : 'You haven\'t requested any reviews yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReviews.map((review) => {
                    const statusConfig = STATUS_CONFIG[review.status];

                    return (
                      <div
                        key={review.reviewId}
                        onClick={() => {
                          setSelectedReview(review);
                          setFindings(review.findings);
                        }}
                        className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={clsx('p-2 rounded-lg', statusConfig.bg)}>
                              <FileText className={clsx('w-4 h-4', statusConfig.color)} />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{review.artifactTitle}</h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <span>{review.artifactType}</span>
                                {review.workItemTitle && (
                                  <>
                                    <span>•</span>
                                    <span>Related: {review.workItemTitle}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={clsx('px-2 py-1 rounded text-xs font-medium', statusConfig.bg, statusConfig.color)}>
                            {statusConfig.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Requester:</span>
                            <span className="font-medium text-gray-900">{review.requesterName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Reviewer:</span>
                            <span className="font-medium text-gray-900">{review.reviewerName}</span>
                          </div>
                        </div>

                        {review.findings.length > 0 && (
                          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                            <AlertCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {review.findings.length} findings
                            </span>
                            <span className="text-xs text-gray-400">
                              ({review.findings.filter(f => !f.resolved).length} unresolved)
                            </span>
                          </div>
                        )}

                        {review.dueDate && (
                          <div className="flex items-center gap-2 text-sm mt-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <span className={clsx(
                              new Date(review.dueDate) < new Date() ? 'text-red-600 font-medium' : 'text-gray-500'
                            )}>
                              Due: {format(new Date(review.dueDate), 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 overflow-y-auto">
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
              {/* Artifact Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Artifact to Review <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('artifactId')}
                  className={clsx(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500',
                    errors.artifactId ? 'border-red-300' : 'border-gray-300'
                  )}
                >
                  <option value="">Select an artifact...</option>
                  {artifacts.map((artifact) => (
                    <option key={artifact.artifactId} value={artifact.artifactId}>
                      {artifact.type}: {artifact.title}
                    </option>
                  ))}
                </select>
                {errors.artifactId && (
                  <p className="mt-1 text-sm text-red-500">{errors.artifactId.message}</p>
                )}
              </div>

              {/* Reviewer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reviewer <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('reviewerId')}
                  className={clsx(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500',
                    errors.reviewerId ? 'border-red-300' : 'border-gray-300'
                  )}
                >
                  <option value="">Select a reviewer...</option>
                  {availableReviewers
                    .filter((r) => r.agentId !== currentAgentId)
                    .map((reviewer) => (
                      <option key={reviewer.agentId} value={reviewer.agentId}>
                        {reviewer.displayName} ({reviewer.teamName})
                      </option>
                    ))}
                </select>
                {errors.reviewerId && (
                  <p className="mt-1 text-sm text-red-500">{errors.reviewerId.message}</p>
                )}
              </div>

              {/* Scope */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Scope <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('scope')}
                  rows={3}
                  className={clsx(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500',
                    errors.scope ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="Describe what aspects of the artifact should be reviewed..."
                />
                {errors.scope && (
                  <p className="mt-1 text-sm text-red-500">{errors.scope.message}</p>
                )}
              </div>

              {/* Focus Areas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Focus Areas
                </label>
                <div className="flex flex-wrap gap-2">
                  {FINDING_CATEGORIES.map((category) => (
                    <label
                      key={category}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-1.5 border rounded-full text-sm cursor-pointer transition-colors',
                        watch('focusAreas')?.includes(category)
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="checkbox"
                        value={category}
                        {...register('focusAreas')}
                        className="sr-only"
                      />
                      {category}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Sending...' : 'Request Review'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Finding Modal */}
      {showFindingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Finding</h3>
            <form onSubmit={handleSubmitFinding(onSubmitFinding)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <select
                    {...registerFinding('severity')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    {...registerFinding('category')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {FINDING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  {...registerFinding('description')}
                  rows={3}
                  className={clsx(
                    'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500',
                    findingErrors.description ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="Describe the finding..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Suggestion (Optional)</label>
                <textarea
                  {...registerFinding('suggestion')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Suggest how to address this finding..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowFindingModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Add Finding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface ReviewDetailViewProps {
  review: Review;
  findings: ReviewFinding[];
  onBack: () => void;
  onAddFinding: () => void;
  onResolveFinding: (findingId: string) => void;
  onSubmitReview: () => void;
  reviewSummary: string;
  setReviewSummary: (summary: string) => void;
  reviewVerdict: 'approve' | 'reject' | 'changes_needed';
  setReviewVerdict: (verdict: 'approve' | 'reject' | 'changes_needed') => void;
  isIncoming: boolean;
}

function ReviewDetailView({
  review,
  findings,
  onBack,
  onAddFinding,
  onResolveFinding,
  onSubmitReview,
  reviewSummary,
  setReviewSummary,
  reviewVerdict,
  setReviewVerdict,
  isIncoming,
}: ReviewDetailViewProps) {
  const statusConfig = STATUS_CONFIG[review.status];
  const unresolvedCount = findings.filter(f => !f.resolved).length;

  return (
    <div className="h-full flex flex-col">
      {/* Detail Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-500 rotate-180" />
          </button>
          <div>
            <h3 className="font-semibold text-gray-900">{review.artifactTitle}</h3>
            <p className="text-sm text-gray-500">Review ID: {review.reviewId.slice(0, 8)}</p>
          </div>
        </div>
        <span className={clsx('px-3 py-1 rounded-full text-sm font-medium', statusConfig.bg, statusConfig.color)}>
          {statusConfig.label}
        </span>
      </div>

      {/* Detail Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Requester</p>
              <p className="font-medium text-gray-900">{review.requesterName}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Reviewer</p>
              <p className="font-medium text-gray-900">{review.reviewerName}</p>
            </div>
          </div>

          {/* Scope */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Review Scope</h4>
            <p className="text-sm text-gray-600">{review.scope}</p>
          </div>

          {/* Focus Areas */}
          {review.focusAreas.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Focus Areas</h4>
              <div className="flex flex-wrap gap-2">
                {review.focusAreas.map((area) => (
                  <span
                    key={area}
                    className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">
                Findings ({findings.length})
                {unresolvedCount > 0 && (
                  <span className="ml-2 text-sm text-amber-600">({unresolvedCount} unresolved)</span>
                )}
              </h4>
              {isIncoming && review.status === 'in_review' && (
                <button
                  onClick={onAddFinding}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200"
                >
                  <Plus className="w-4 h-4" />
                  Add Finding
                </button>
              )}
            </div>

            {findings.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No findings recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {findings.map((finding) => {
                  const severityConfig = SEVERITY_CONFIG[finding.severity];
                  return (
                    <div
                      key={finding.findingId}
                      className={clsx(
                        'border rounded-lg p-4 transition-all',
                        finding.resolved
                          ? 'border-gray-200 bg-gray-50/50 opacity-60'
                          : 'border-gray-200'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', severityConfig.bg, severityConfig.color)}>
                            {severityConfig.label}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{finding.category}</span>
                          {finding.lineNumber && (
                            <span className="text-xs text-gray-400">
                              Line {finding.lineNumber}
                            </span>
                          )}
                        </div>
                        {!finding.resolved && isIncoming && review.status === 'in_review' && (
                          <button
                            onClick={() => onResolveFinding(finding.findingId)}
                            className="p-1 hover:bg-green-100 text-green-600 rounded"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {finding.resolved && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="mt-2 text-sm text-gray-700">{finding.description}</p>
                      {finding.suggestion && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                          <span className="font-medium">Suggestion:</span> {finding.suggestion}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Review Submission (for incoming, in-review items) */}
          {isIncoming && review.status === 'in_review' && (
            <div className="border-t border-gray-200 pt-6">
              <h4 className="font-medium text-gray-900 mb-4">Submit Review</h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
                  <textarea
                    value={reviewSummary}
                    onChange={(e) => setReviewSummary(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Provide an overall summary of your review..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Verdict</label>
                  <div className="flex gap-3">
                    {([
                      { value: 'approve', label: 'Approve', color: 'green', icon: ThumbsUp },
                      { value: 'changes_needed', label: 'Changes Needed', color: 'amber', icon: GitPullRequest },
                      { value: 'reject', label: 'Reject', color: 'red', icon: ThumbsDown },
                    ] as const).map(({ value, label, color, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setReviewVerdict(value)}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors',
                          reviewVerdict === value
                            ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={onSubmitReview}
                  disabled={!reviewSummary && findings.length === 0}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Review
                </button>
              </div>
            </div>
          )}

          {/* Completed Review Summary */}
          {(review.status === 'approved' || review.status === 'rejected' || review.status === 'changes_requested') && review.summary && (
            <div className={clsx(
              'border rounded-lg p-4',
              review.status === 'approved' ? 'border-green-200 bg-green-50' :
              review.status === 'rejected' ? 'border-red-200 bg-red-50' :
              'border-amber-200 bg-amber-50'
            )}>
              <h4 className="font-medium text-gray-900 mb-2">Review Summary</h4>
              <p className="text-sm text-gray-700">{review.summary}</p>
              {review.completedAt && (
                <p className="text-xs text-gray-500 mt-2">
                  Completed on {format(new Date(review.completedAt), 'PPP')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
