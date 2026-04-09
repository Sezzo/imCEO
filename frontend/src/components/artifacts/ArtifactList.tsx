import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Filter, ChevronRight, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { artifactApi, type Artifact, type ArtifactType, type ArtifactStatus } from '../../api/client';
import { useCompanyStore } from '../../store/companyStore';

const ARTIFACT_TYPES: { value: ArtifactType; label: string; color: string }[] = [
  { value: 'VisionBrief', label: 'Vision Brief', color: 'bg-purple-100 text-purple-700' },
  { value: 'StrategicMemo', label: 'Strategic Memo', color: 'bg-blue-100 text-blue-700' },
  { value: 'GoalDefinition', label: 'Goal Definition', color: 'bg-green-100 text-green-700' },
  { value: 'ArchitectureProposal', label: 'Architecture', color: 'bg-amber-100 text-amber-700' },
  { value: 'ADR', label: 'ADR', color: 'bg-orange-100 text-orange-700' },
  { value: 'SystemDesign', label: 'System Design', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'TechnicalSpec', label: 'Technical Spec', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'APIContract', label: 'API Contract', color: 'bg-pink-100 text-pink-700' },
  { value: 'TaskBrief', label: 'Task Brief', color: 'bg-teal-100 text-teal-700' },
  { value: 'TestPlan', label: 'Test Plan', color: 'bg-lime-100 text-lime-700' },
  { value: 'TestReport', label: 'Test Report', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'ReviewReport', label: 'Review Report', color: 'bg-rose-100 text-rose-700' },
  { value: 'DocumentationDraft', label: 'Documentation', color: 'bg-slate-100 text-slate-700' },
  { value: 'ReleaseNotes', label: 'Release Notes', color: 'bg-violet-100 text-violet-700' },
  { value: 'SecurityReview', label: 'Security Review', color: 'bg-red-100 text-red-700' },
  { value: 'ComplianceReport', label: 'Compliance', color: 'bg-gray-100 text-gray-700' },
];

const STATUS_CONFIG: Record<ArtifactStatus, { label: string; icon: React.ReactNode; color: string }> = {
  Draft: { label: 'Draft', icon: <FileText className="w-4 h-4" />, color: 'text-gray-500' },
  InPreparation: { label: 'In Preparation', icon: <Clock className="w-4 h-4" />, color: 'text-blue-500' },
  UnderReview: { label: 'Under Review', icon: <AlertCircle className="w-4 h-4" />, color: 'text-amber-500' },
  Approved: { label: 'Approved', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-500' },
  Superseded: { label: 'Superseded', icon: <FileText className="w-4 h-4" />, color: 'text-gray-400' },
  Archived: { label: 'Archived', icon: <FileText className="w-4 h-4" />, color: 'text-gray-400' },
};

interface ArtifactListProps {
  workItemId?: string;
}

export function ArtifactList({ workItemId }: ArtifactListProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ArtifactType | ''>('');
  const [statusFilter, setStatusFilter] = useState<ArtifactStatus | ''>('');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  const { teams } = useCompanyStore();

  // Load artifacts
  useEffect(() => {
    const loadArtifacts = async () => {
      setIsLoading(true);
      try {
        const filters: { type?: string; status?: string; workItemId?: string } = {};
        if (typeFilter) filters.type = typeFilter;
        if (statusFilter) filters.status = statusFilter;
        if (workItemId) filters.workItemId = workItemId;

        const response = await artifactApi.list(filters);
        setArtifacts(response.data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load artifacts');
      } finally {
        setIsLoading(false);
      }
    };

    loadArtifacts();
  }, [typeFilter, statusFilter, workItemId]);

  // Filter artifacts by search query
  const filteredArtifacts = artifacts.filter((artifact) =>
    searchQuery === '' ||
    artifact.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    artifact.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeConfig = (type: ArtifactType) =>
    ARTIFACT_TYPES.find((t) => t.value === type) || { label: type, color: 'bg-gray-100 text-gray-700' };

  const getStatusConfig = (status: ArtifactStatus) =>
    STATUS_CONFIG[status] || { label: status, icon: null, color: 'text-gray-500' };

  const getTeamName = (teamId?: string | null) => {
    if (!teamId) return 'Unassigned';
    const team = teams.find((t) => t.teamId === teamId);
    return team?.name || teamId.slice(0, 8);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Artifacts</h2>
          <p className="text-sm text-gray-500">Documents and deliverables</p>
        </div>
        <button
          onClick={() => {/* TODO: Open create modal */}}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          New Artifact
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-gray-50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ArtifactType | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          >
            <option value="">All Types</option>
            {ARTIFACT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ArtifactStatus | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="InPreparation">In Preparation</option>
            <option value="UnderReview">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Superseded">Superseded</option>
            <option value="Archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Artifact List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredArtifacts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-4" />
            <p className="text-lg font-medium">No artifacts found</p>
            <p className="text-sm">Create an artifact to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredArtifacts.map((artifact) => {
              const typeConfig = getTypeConfig(artifact.type);
              const statusConfig = getStatusConfig(artifact.status);

              return (
                <div
                  key={artifact.artifactId}
                  onClick={() => setSelectedArtifact(artifact)}
                  className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm cursor-pointer transition-all"
                >
                  {/* Type Badge */}
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${typeConfig.color}`}>
                    {typeConfig.label}
                  </span>

                  {/* Title and Description */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {artifact.title}
                    </h3>
                    {artifact.description && (
                      <p className="text-sm text-gray-500 truncate">
                        {artifact.description}
                      </p>
                    )}
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className={`flex items-center gap-1 ${statusConfig.color}`}>
                      {statusConfig.icon}
                      <span>{statusConfig.label}</span>
                    </div>

                    <div>
                      v{artifact.version}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Team:</span>
                      <span>{getTeamName(artifact.ownerTeamId)}</span>
                    </div>

                    <div className="text-gray-400">
                      {new Date(artifact.updatedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Artifact Detail Modal */}
      {selectedArtifact && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedArtifact(null)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-2 ${getTypeConfig(selectedArtifact.type).color}`}>
                  {getTypeConfig(selectedArtifact.type).label}
                </span>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedArtifact.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Meta Info */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Status</span>
                  <div className={`flex items-center gap-1 mt-1 font-medium ${getStatusConfig(selectedArtifact.status).color}`}>
                    {getStatusConfig(selectedArtifact.status).icon}
                    {getStatusConfig(selectedArtifact.status).label}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Version</span>
                  <div className="mt-1 font-medium">{selectedArtifact.version}</div>
                </div>
                <div>
                  <span className="text-gray-500">Owner Team</span>
                  <div className="mt-1 font-medium">{getTeamName(selectedArtifact.ownerTeamId)}</div>
                </div>
              </div>

              {/* Description */}
              {selectedArtifact.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                  <p className="text-gray-600">{selectedArtifact.description}</p>
                </div>
              )}

              {/* Content */}
              {selectedArtifact.content && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Content</h4>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedArtifact.content}
                    </pre>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="flex items-center gap-4 text-sm text-gray-500 border-t border-gray-200 pt-4">
                <div>
                  Created: {new Date(selectedArtifact.createdAt).toLocaleString()}
                </div>
                <div>
                  Updated: {new Date(selectedArtifact.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setSelectedArtifact(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => {/* TODO: Edit */}}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
