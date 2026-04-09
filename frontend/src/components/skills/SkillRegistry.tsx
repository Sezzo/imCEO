import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Code,
  Terminal,
  Play,
  X,
  Save,
  Copy,
  ExternalLink,
  Package,
  Layers,
  Star,
  Download,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export type SkillStatus = 'draft' | 'active' | 'deprecated' | 'archived';
export type SkillCategory = 'code' | 'data' | 'communication' | 'analysis' | 'integration' | 'custom';

interface Skill {
  skillId: string;
  name: string;
  version: string;
  description: string;
  status: SkillStatus;
  category: SkillCategory;
  author: string;
  tags: string[];
  dependencies: string[];
  inputSchema: object;
  outputSchema: object;
  implementation: {
    type: 'code' | 'prompt' | 'mcp';
    content?: string;
    prompt?: string;
    mcpServer?: string;
  };
  examples: { input: object; output: object; description: string }[];
  documentation: string;
  testCases: { name: string; input: object; expectedOutput: object }[];
  usageCount: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

const skillSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in format x.x.x'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  category: z.enum(['code', 'data', 'communication', 'analysis', 'integration', 'custom']),
  tags: z.array(z.string()).default([]),
  implementation: z.object({
    type: z.enum(['code', 'prompt', 'mcp']),
    content: z.string().optional(),
    prompt: z.string().optional(),
    mcpServer: z.string().optional(),
  }),
  documentation: z.string().max(5000, 'Documentation too long').optional(),
});

type SkillFormData = z.infer<typeof skillSchema>;

interface SkillRegistryProps {
  skills: Skill[];
  currentAgentId: string;
  onCreateSkill: (data: SkillFormData) => void;
  onUpdateSkill: (skillId: string, data: Partial<SkillFormData>) => void;
  onDeleteSkill: (skillId: string) => void;
  onTestSkill: (skillId: string, testInput: object) => Promise<{ success: boolean; output?: object; error?: string }>;
}

const STATUS_CONFIG: Record<SkillStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'text-gray-700', bg: 'bg-gray-100', icon: <AlertCircle className="w-4 h-4" /> },
  active: { label: 'Active', color: 'text-green-700', bg: 'bg-green-100', icon: <CheckCircle className="w-4 h-4" /> },
  deprecated: { label: 'Deprecated', color: 'text-amber-700', bg: 'bg-amber-100', icon: <AlertCircle className="w-4 h-4" /> },
  archived: { label: 'Archived', color: 'text-red-700', bg: 'bg-red-100', icon: <X className="w-4 h-4" /> },
};

const CATEGORY_CONFIG: Record<SkillCategory, { label: string; icon: React.ReactNode; color: string }> = {
  code: { label: 'Code', icon: <Code className="w-4 h-4" />, color: 'text-blue-600' },
  data: { label: 'Data', icon: <Package className="w-4 h-4" />, color: 'text-green-600' },
  communication: { label: 'Communication', icon: <ExternalLink className="w-4 h-4" />, color: 'text-purple-600' },
  analysis: { label: 'Analysis', icon: <Layers className="w-4 h-4" />, color: 'text-amber-600' },
  integration: { label: 'Integration', icon: <Terminal className="w-4 h-4" />, color: 'text-cyan-600' },
  custom: { label: 'Custom', icon: <Wrench className="w-4 h-4" />, color: 'text-gray-600' },
};

export function SkillRegistry({
  skills,
  currentAgentId,
  onCreateSkill,
  onUpdateSkill,
  onDeleteSkill,
  onTestSkill,
}: SkillRegistryProps) {
  const [activeTab, setActiveTab] = useState<'browse' | 'create' | 'detail'>('browse');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<SkillCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<SkillStatus | 'all'>('all');
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; output?: object; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SkillFormData>({
    resolver: zodResolver(skillSchema),
    defaultValues: {
      version: '1.0.0',
      category: 'custom',
      tags: [],
      implementation: { type: 'code' },
    },
  });

  const filteredSkills = skills.filter((skill) => {
    const matchesSearch =
      !searchTerm ||
      skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skill.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = filterCategory === 'all' || skill.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || skill.status === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const onSubmit = (data: SkillFormData) => {
    if (selectedSkill) {
      onUpdateSkill(selectedSkill.skillId, data);
    } else {
      onCreateSkill(data);
    }
    setActiveTab('browse');
    setSelectedSkill(null);
    reset();
  };

  const handleEdit = (skill: Skill) => {
    setSelectedSkill(skill);
    setValue('name', skill.name);
    setValue('version', skill.version);
    setValue('description', skill.description);
    setValue('category', skill.category);
    setValue('tags', skill.tags);
    setValue('implementation', skill.implementation);
    setValue('documentation', skill.documentation);
    setActiveTab('create');
  };

  const handleTest = async () => {
    if (!selectedSkill || !testInput) return;

    setIsTesting(true);
    try {
      const input = JSON.parse(testInput);
      const result = await onTestSkill(selectedSkill.skillId, input);
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, error: 'Invalid JSON input' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedSkill(null);
    reset();
    setActiveTab('create');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-6xl h-[85vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-lg">
            <Wrench className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Skill Registry</h2>
            <p className="text-sm text-gray-500">
              {skills.length} skills • {skills.filter((s) => s.status === 'active').length} active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Skill
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
                  setSelectedSkill(null);
                  setShowTestPanel(false);
                }
              }}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                activeTab === tab
                  ? 'border-cyan-600 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {tab === 'browse' ? (
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Browse Skills
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {selectedSkill ? 'Edit Skill' : 'Create Skill'}
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
                  placeholder="Search skills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as SkillCategory | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as SkillStatus | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Skills Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredSkills.length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No skills found</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {skills.length === 0
                      ? 'Create your first skill to get started'
                      : 'Try adjusting your filters'}
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                  >
                    Create Skill
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredSkills.map((skill) => {
                    const statusConfig = STATUS_CONFIG[skill.status];
                    const categoryConfig = CATEGORY_CONFIG[skill.category];

                    return (
                      <div
                        key={skill.skillId}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => {
                          setSelectedSkill(skill);
                          setActiveTab('detail');
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={clsx('p-2 rounded-lg', statusConfig.bg)}>
                              {categoryConfig.icon}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{skill.name}</h4>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>v{skill.version}</span>
                                <span>•</span>
                                <span>{skill.usageCount} uses</span>
                              </div>
                            </div>
                          </div>
                          <span className={clsx('px-2 py-1 rounded text-xs font-medium', statusConfig.bg, statusConfig.color)}>
                            {statusConfig.label}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{skill.description}</p>

                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span className={clsx('flex items-center gap-1', categoryConfig.color)}>
                            {categoryConfig.icon}
                            {categoryConfig.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500" />
                            <span>{skill.rating.toFixed(1)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {skill.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          {skill.tags.length > 3 && (
                            <span className="px-2 py-0.5 text-gray-400 text-xs">
                              +{skill.tags.length - 3}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-400">
                            Updated {format(new Date(skill.updatedAt), 'MMM d')}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(skill);
                              }}
                              className="p-1.5 hover:bg-gray-100 text-gray-600 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSkill(skill.skillId);
                              }}
                              className="p-1.5 hover:bg-red-100 text-red-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
          <div className="h-full flex">
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('name')}
                      className={clsx(
                        'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500',
                        errors.name ? 'border-red-300' : 'border-gray-300'
                      )}
                      placeholder="e.g., code-review"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Version <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('version')}
                      className={clsx(
                        'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500',
                        errors.version ? 'border-red-300' : 'border-gray-300'
                      )}
                      placeholder="1.0.0"
                    />
                    {errors.version && <p className="mt-1 text-sm text-red-500">{errors.version.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    {...register('description')}
                    rows={2}
                    className={clsx(
                      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500',
                      errors.description ? 'border-red-300' : 'border-gray-300'
                    )}
                    placeholder="What does this skill do?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <label
                        key={key}
                        className={clsx(
                          'flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors',
                          watch('category') === key
                            ? 'border-cyan-500 bg-cyan-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <input
                          type="radio"
                          {...register('category')}
                          value={key}
                          className="sr-only"
                        />
                        {config.icon}
                        <span className="text-sm">{config.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Implementation Type</label>
                  <div className="flex gap-2">
                    {(['code', 'prompt', 'mcp'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setValue('implementation.type', type)}
                        className={clsx(
                          'flex-1 px-4 py-2 border rounded-lg text-sm capitalize transition-colors',
                          watch('implementation.type') === type
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {type === 'mcp' ? 'MCP Server' : type}
                      </button>
                    ))}
                  </div>
                </div>

                {watch('implementation.type') === 'code' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                    <textarea
                      {...register('implementation.content')}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                      placeholder="// Enter your skill implementation code here..."
                    />
                  </div>
                )}

                {watch('implementation.type') === 'prompt' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Template</label>
                    <textarea
                      {...register('implementation.prompt')}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                      placeholder="Enter the prompt template for this skill..."
                    />
                  </div>
                )}

                {watch('implementation.type') === 'mcp' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">MCP Server URL</label>
                    <input
                      type="text"
                      {...register('implementation.mcpServer')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      placeholder="https://mcp.example.com/skill"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Documentation</label>
                  <textarea
                    {...register('documentation')}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    placeholder="Document how to use this skill..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('browse');
                      setSelectedSkill(null);
                      reset();
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSubmitting ? 'Saving...' : selectedSkill ? 'Update Skill' : 'Create Skill'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'detail' && selectedSkill && (
          <div className="h-full flex">
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={clsx('p-3 rounded-lg', STATUS_CONFIG[selectedSkill.status].bg)}>
                      {CATEGORY_CONFIG[selectedSkill.category].icon}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{selectedSkill.name}</h2>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span>v{selectedSkill.version}</span>
                        <span>•</span>
                        <span>{CATEGORY_CONFIG[selectedSkill.category].label}</span>
                        <span>•</span>
                        <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', STATUS_CONFIG[selectedSkill.status].bg, STATUS_CONFIG[selectedSkill.status].color)}>
                          {STATUS_CONFIG[selectedSkill.status].label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        handleEdit(selectedSkill);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => setShowTestPanel(!showTestPanel)}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                        showTestPanel
                          ? 'bg-cyan-100 text-cyan-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      <Play className="w-4 h-4" />
                      Test
                    </button>
                  </div>
                </div>

                <p className="text-gray-600 mb-6">{selectedSkill.description}</p>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{selectedSkill.usageCount}</div>
                    <div className="text-xs text-gray-500">Uses</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{selectedSkill.rating.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">Rating</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{selectedSkill.tags.length}</div>
                    <div className="text-xs text-gray-500">Tags</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{selectedSkill.dependencies.length}</div>
                    <div className="text-xs text-gray-500">Dependencies</div>
                  </div>
                </div>

                {/* Documentation */}
                {selectedSkill.documentation && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Documentation</h3>
                    <div className="p-4 bg-gray-50 rounded-lg prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700">{selectedSkill.documentation}</pre>
                    </div>
                  </div>
                )}

                {/* Implementation */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Implementation ({selectedSkill.implementation.type})
                  </h3>
                  <div className="p-4 bg-gray-900 rounded-lg overflow-x-auto">
                    <pre className="text-sm text-green-400 font-mono">
                      {selectedSkill.implementation.content ||
                       selectedSkill.implementation.prompt ||
                       selectedSkill.implementation.mcpServer ||
                       'No implementation shown'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Panel */}
            {showTestPanel && (
              <div className="w-96 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                <h3 className="font-semibold text-gray-900 mb-4">Test Skill</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Input (JSON)</label>
                    <textarea
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                      placeholder='{"key": "value"}'
                    />
                  </div>

                  <button
                    onClick={handleTest}
                    disabled={isTesting || !testInput}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    {isTesting ? 'Running...' : 'Run Test'}
                  </button>

                  {testResult && (
                    <div className={clsx(
                      'p-3 rounded-lg',
                      testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        {testResult.success ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={clsx('font-medium', testResult.success ? 'text-green-700' : 'text-red-700')}>
                          {testResult.success ? 'Success' : 'Error'}
                        </span>
                      </div>
                      {testResult.output && (
                        <pre className="text-xs text-gray-600 overflow-x-auto">
                          {JSON.stringify(testResult.output, null, 2)}
                        </pre>
                      )}
                      {testResult.error && (
                        <p className="text-xs text-red-600">{testResult.error}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
