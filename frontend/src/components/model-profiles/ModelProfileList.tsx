import { useState, useMemo } from 'react';
import { Bot, Plus, Edit2, Trash2, Sparkles, DollarSign, Clock, CheckCircle, AlertCircle, Search, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import type { ModelProfile, ModelId } from './ModelProfileEditor';

interface ModelProfileListProps {
  profiles: ModelProfile[];
  onSelectProfile: (profile: ModelProfile) => void;
  onCreateProfile: () => void;
  onEditProfile: (profile: ModelProfile) => void;
  onDeleteProfile: (profileId: string) => void;
  onSetDefault: (profileId: string) => void;
}

const MODEL_BADGES: Record<string, { color: string; bg: string }> = {
  'claude-opus-4': { color: 'text-orange-700', bg: 'bg-orange-100' },
  'claude-sonnet-4': { color: 'text-purple-700', bg: 'bg-purple-100' },
  'claude-haiku-4': { color: 'text-green-700', bg: 'bg-green-100' },
  'gpt-4o': { color: 'text-emerald-700', bg: 'bg-emerald-100' },
  'gpt-4o-mini': { color: 'text-teal-700', bg: 'bg-teal-100' },
  'gemini-pro': { color: 'text-blue-700', bg: 'bg-blue-100' },
};

const MODEL_NAMES: Record<ModelId, string> = {
  'claude-opus-4': 'Claude Opus 4',
  'claude-sonnet-4': 'Claude Sonnet 4',
  'claude-haiku-4': 'Claude Haiku 4',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gemini-pro': 'Gemini Pro',
};

export function ModelProfileList({
  profiles,
  onSelectProfile,
  onCreateProfile,
  onEditProfile,
  onDeleteProfile,
  onSetDefault,
}: ModelProfileListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModel, setFilterModel] = useState<ModelId | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const matchesSearch =
        !searchTerm ||
        profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesModel = filterModel === 'all' || profile.modelId === filterModel;

      return matchesSearch && matchesModel;
    });
  }, [profiles, searchTerm, filterModel]);

  const defaultProfile = profiles.find((p) => p.isDefault);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Model Profiles</h2>
              <p className="text-sm text-gray-500">
                {profiles.length} profiles configured
              </p>
            </div>
          </div>
          <button
            onClick={onCreateProfile}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search profiles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors',
              showFilters
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-300 hover:bg-gray-50'
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg flex flex-wrap gap-2">
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value as ModelId | 'all')}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Models</option>
              {Object.entries(MODEL_NAMES).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                setFilterModel('all');
                setSearchTerm('');
              }}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Profiles Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredProfiles.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No profiles found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {profiles.length === 0
                ? 'Create your first model profile to get started'
                : 'Try adjusting your search or filters'}
            </p>
            {profiles.length === 0 && (
              <button
                onClick={onCreateProfile}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Create Profile
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProfiles.map((profile) => {
              const modelStyle = MODEL_BADGES[profile.modelId] || { color: 'text-gray-700', bg: 'bg-gray-100' };

              return (
                <div
                  key={profile.profileId}
                  onClick={() => onSelectProfile(profile)}
                  className="group relative bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                >
                  {/* Default Badge */}
                  {profile.isDefault && (
                    <div className="absolute -top-2 -right-2">
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Default
                      </span>
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{profile.name}</h3>
                      <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1', modelStyle.bg, modelStyle.color)}>
                        {MODEL_NAMES[profile.modelId]}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {profile.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {profile.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div className="flex items-center gap-1 text-gray-500">
                      <DollarSign className="w-3 h-3" />
                      <span>${profile.costLimitPerTask || 0}/task</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{profile.timeLimitPerTask || 0}s</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <AlertCircle className="w-3 h-3" />
                      <span>{profile.maxTokens.toLocaleString()} tk</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditProfile(profile);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    {!profile.isDefault && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetDefault(profile.profileId);
                          }}
                          className="flex-1 text-sm text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        >
                          Set Default
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProfile(profile.profileId);
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
