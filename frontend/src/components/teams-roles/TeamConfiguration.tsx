import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users,
  Save,
  X,
  Layers,
  Puzzle,
  Plug,
  BookOpen,
  Shield,
  CheckCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Cpu,
  Wrench,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { Team } from '../../api/client';

// Types for bundles
interface SkillBundle {
  bundleId: string;
  name: string;
  description: string;
  skills: Skill[];
  isEnabled: boolean;
}

interface Skill {
  skillId: string;
  name: string;
  version: string;
  description: string;
  status: 'active' | 'beta' | 'deprecated';
}

interface MCPBundle {
  bundleId: string;
  name: string;
  description: string;
  mcps: MCP[];
  isEnabled: boolean;
}

interface MCP {
  mcpId: string;
  name: string;
  serverUrl: string;
  status: 'connected' | 'disconnected' | 'error';
  lastUsed: string;
}

interface PluginBundle {
  bundleId: string;
  name: string;
  description: string;
  plugins: Plugin[];
  isEnabled: boolean;
}

interface Plugin {
  pluginId: string;
  name: string;
  version: string;
  author: string;
  status: 'installed' | 'active' | 'error';
}

// Mock data - would come from API
const MOCK_SKILL_BUNDLES: SkillBundle[] = [
  {
    bundleId: 'sb-1',
    name: 'Core Development',
    description: 'Essential skills for software development',
    isEnabled: true,
    skills: [
      { skillId: 'sk-1', name: 'Code Review', version: '1.2.0', description: 'Review code for quality and bugs', status: 'active' },
      { skillId: 'sk-2', name: 'Documentation', version: '2.0.1', description: 'Generate and maintain documentation', status: 'active' },
      { skillId: 'sk-3', name: 'Testing', version: '1.5.0', description: 'Write and execute tests', status: 'beta' },
    ],
  },
  {
    bundleId: 'sb-2',
    name: 'Architecture',
    description: 'System design and architecture skills',
    isEnabled: false,
    skills: [
      { skillId: 'sk-4', name: 'System Design', version: '1.0.0', description: 'Design scalable systems', status: 'active' },
      { skillId: 'sk-5', name: 'ADR Writer', version: '1.1.0', description: 'Write Architecture Decision Records', status: 'active' },
    ],
  },
];

const MOCK_MCP_BUNDLES: MCPBundle[] = [
  {
    bundleId: 'mb-1',
    name: 'Development Tools',
    description: 'MCP servers for development workflow',
    isEnabled: true,
    mcps: [
      { mcpId: 'mcp-1', name: 'GitHub', serverUrl: 'https://github.com/mcp', status: 'connected', lastUsed: '2024-01-15T10:30:00Z' },
      { mcpId: 'mcp-2', name: 'Linear', serverUrl: 'https://linear.app/mcp', status: 'connected', lastUsed: '2024-01-15T09:15:00Z' },
    ],
  },
  {
    bundleId: 'mb-2',
    name: 'Database Access',
    description: 'Database and storage MCPs',
    isEnabled: false,
    mcps: [
      { mcpId: 'mcp-3', name: 'PostgreSQL', serverUrl: 'postgres://localhost', status: 'error', lastUsed: '2024-01-14T16:00:00Z' },
    ],
  },
];

const MOCK_PLUGIN_BUNDLES: PluginBundle[] = [
  {
    bundleId: 'pb-1',
    name: 'Core Plugins',
    description: 'Essential plugins for all teams',
    isEnabled: true,
    plugins: [
      { pluginId: 'p-1', name: 'Cost Tracker', version: '1.0.0', author: 'imCEO', status: 'active' },
      { pluginId: 'p-2', name: 'Session Manager', version: '2.1.0', author: 'imCEO', status: 'active' },
    ],
  },
];

// Form schema
const teamConfigSchema = z.object({
  teamId: z.string(),
  defaultModelProfileId: z.string().optional(),
  defaultSkillBundleId: z.string().optional(),
  defaultMcpBundleId: z.string().optional(),
  defaultPluginBundleId: z.string().optional(),
  customSkills: z.array(z.string()).default([]),
  customMCPs: z.array(z.string()).default([]),
  customPlugins: z.array(z.string()).default([]),
  allowedInteractions: z.object({
    canDelegateTo: z.array(z.string()).default([]),
    canEscalateTo: z.array(z.string()).default([]),
    canRequestReviewFrom: z.array(z.string()).default([]),
  }),
  autoAssignEnabled: z.boolean().default(false),
  costBudgetPolicyId: z.string().optional(),
});

type TeamConfigFormData = z.infer<typeof teamConfigSchema>;

interface TeamConfigurationProps {
  team: Team;
  onSave: (data: TeamConfigFormData) => void;
  onCancel: () => void;
}

type ConfigSection = 'skills' | 'mcps' | 'plugins' | 'interactions';

export function TeamConfiguration({ team, onSave, onCancel }: TeamConfigurationProps) {
  const [activeSection, setActiveSection] = useState<ConfigSection>('skills');
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty, isSubmitting },
  } = useForm<TeamConfigFormData>({
    resolver: zodResolver(teamConfigSchema),
    defaultValues: {
      teamId: team.teamId,
      defaultModelProfileId: team.defaultModelProfileId || '',
      defaultSkillBundleId: team.defaultSkillBundleId || '',
      defaultMcpBundleId: team.defaultMcpBundleId || '',
      customSkills: [],
      customMCPs: [],
      customPlugins: [],
      allowedInteractions: {
        canDelegateTo: [],
        canEscalateTo: [],
        canRequestReviewFrom: [],
      },
      autoAssignEnabled: false,
    },
  });

  const toggleBundle = (bundleId: string) => {
    setExpandedBundles((prev) => {
      const next = new Set(prev);
      if (next.has(bundleId)) {
        next.delete(bundleId);
      } else {
        next.add(bundleId);
      }
      return next;
    });
  };

  const sections: { id: ConfigSection; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'skills', label: 'Skill Bundles', icon: <BookOpen className="w-4 h-4" />, count: MOCK_SKILL_BUNDLES.length },
    { id: 'mcps', label: 'MCP Bundles', icon: <Plug className="w-4 h-4" />, count: MOCK_MCP_BUNDLES.length },
    { id: 'plugins', label: 'Plugin Bundles', icon: <Puzzle className="w-4 h-4" />, count: MOCK_PLUGIN_BUNDLES.length },
    { id: 'interactions', label: 'Interactions', icon: <Users className="w-4 h-4" />, count: 0 },
  ];

  const onSubmit = (data: TeamConfigFormData) => {
    onSave(data);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Layers className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Team Configuration</h2>
            <p className="text-sm text-gray-500">Configure skills, MCPs, and plugins for {team.name}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-200 bg-gray-50">
          <nav className="p-4 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  activeSection === section.id
                    ? 'bg-amber-100 text-amber-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {section.icon}
                <span className="flex-1 text-left">{section.label}</span>
                <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">
                  {section.count}
                </span>
              </button>
            ))}
          </nav>

          {/* Quick Stats */}
          <div className="p-4 border-t border-gray-200">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-3">Configuration Status</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">{MOCK_SKILL_BUNDLES.filter(b => b.isEnabled).length} skill bundles active</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">{MOCK_MCP_BUNDLES.filter(b => b.isEnabled).length} MCP bundles active</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">{MOCK_PLUGIN_BUNDLES.filter(b => b.isEnabled).length} plugin bundles active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Skills Section */}
            {activeSection === 'skills' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Skill Bundles</h3>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Bundle
                  </button>
                </div>

                <p className="text-sm text-gray-500">
                  Enable skill bundles to grant team agents access to specialized capabilities.
                </p>

                <div className="space-y-3">
                  {MOCK_SKILL_BUNDLES.map((bundle) => (
                    <div
                      key={bundle.bundleId}
                      className={clsx(
                        'border rounded-lg overflow-hidden transition-all',
                        bundle.isEnabled ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'
                      )}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <button
                          type="button"
                          onClick={() => toggleBundle(bundle.bundleId)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {expandedBundles.has(bundle.bundleId) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-amber-600" />
                            <span className="font-medium text-gray-900">{bundle.name}</span>
                          </div>
                          <p className="text-sm text-gray-500">{bundle.description}</p>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bundle.isEnabled}
                            onChange={() => {}}
                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                          />
                          <span className="text-sm text-gray-600">Enabled</span>
                        </label>
                      </div>

                      {expandedBundles.has(bundle.bundleId) && (
                        <div className="px-4 pb-4">
                          <div className="ml-7 border-l-2 border-gray-200 pl-4 space-y-2">
                            {bundle.skills.map((skill) => (
                              <div
                                key={skill.skillId}
                                className="flex items-center justify-between p-2 bg-white rounded border border-gray-100"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-gray-900">{skill.name}</span>
                                    <span className={clsx(
                                      'text-xs px-1.5 py-0.5 rounded',
                                      skill.status === 'active' ? 'bg-green-100 text-green-700' :
                                      skill.status === 'beta' ? 'bg-amber-100 text-amber-700' :
                                      'bg-gray-100 text-gray-700'
                                    )}>
                                      {skill.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">{skill.description}</p>
                                </div>
                                <span className="text-xs text-gray-400">v{skill.version}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Custom Skills */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3">Custom Skills</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add custom skill ID..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MCPs Section */}
            {activeSection === 'mcps' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">MCP Bundles</h3>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Bundle
                  </button>
                </div>

                <p className="text-sm text-gray-500">
                  Model Context Protocol (MCP) servers provide external tool access to agents.
                </p>

                <div className="space-y-3">
                  {MOCK_MCP_BUNDLES.map((bundle) => (
                    <div
                      key={bundle.bundleId}
                      className={clsx(
                        'border rounded-lg overflow-hidden transition-all',
                        bundle.isEnabled ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
                      )}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <button
                          type="button"
                          onClick={() => toggleBundle(bundle.bundleId)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {expandedBundles.has(bundle.bundleId) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Plug className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-gray-900">{bundle.name}</span>
                          </div>
                          <p className="text-sm text-gray-500">{bundle.description}</p>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bundle.isEnabled}
                            onChange={() => {}}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-600">Enabled</span>
                        </label>
                      </div>

                      {expandedBundles.has(bundle.bundleId) && (
                        <div className="px-4 pb-4">
                          <div className="ml-7 border-l-2 border-gray-200 pl-4 space-y-2">
                            {bundle.mcps.map((mcp) => (
                              <div
                                key={mcp.mcpId}
                                className="flex items-center justify-between p-2 bg-white rounded border border-gray-100"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-gray-900">{mcp.name}</span>
                                    <span className={clsx(
                                      'text-xs px-1.5 py-0.5 rounded',
                                      mcp.status === 'connected' ? 'bg-green-100 text-green-700' :
                                      mcp.status === 'disconnected' ? 'bg-gray-100 text-gray-700' :
                                      'bg-red-100 text-red-700'
                                    )}>
                                      {mcp.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">{mcp.serverUrl}</p>
                                </div>
                                <span className="text-xs text-gray-400">
                                  Last used: {new Date(mcp.lastUsed).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Plugins Section */}
            {activeSection === 'plugins' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Plugin Bundles</h3>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Bundle
                  </button>
                </div>

                <div className="space-y-3">
                  {MOCK_PLUGIN_BUNDLES.map((bundle) => (
                    <div
                      key={bundle.bundleId}
                      className={clsx(
                        'border rounded-lg overflow-hidden transition-all',
                        bundle.isEnabled ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200'
                      )}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <button
                          type="button"
                          onClick={() => toggleBundle(bundle.bundleId)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {expandedBundles.has(bundle.bundleId) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Puzzle className="w-4 h-4 text-purple-600" />
                            <span className="font-medium text-gray-900">{bundle.name}</span>
                          </div>
                          <p className="text-sm text-gray-500">{bundle.description}</p>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bundle.isEnabled}
                            onChange={() => {}}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-600">Enabled</span>
                        </label>
                      </div>

                      {expandedBundles.has(bundle.bundleId) && (
                        <div className="px-4 pb-4">
                          <div className="ml-7 border-l-2 border-gray-200 pl-4 space-y-2">
                            {bundle.plugins.map((plugin) => (
                              <div
                                key={plugin.pluginId}
                                className="flex items-center justify-between p-2 bg-white rounded border border-gray-100"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-gray-900">{plugin.name}</span>
                                    <span className={clsx(
                                      'text-xs px-1.5 py-0.5 rounded',
                                      plugin.status === 'active' ? 'bg-green-100 text-green-700' :
                                      plugin.status === 'installed' ? 'bg-blue-100 text-blue-700' :
                                      'bg-red-100 text-red-700'
                                    )}>
                                      {plugin.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">by {plugin.author}</p>
                                </div>
                                <span className="text-xs text-gray-400">v{plugin.version}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactions Section */}
            {activeSection === 'interactions' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Team Interactions</h3>
                <p className="text-sm text-gray-500">
                  Configure which teams this team can interact with for delegation, escalation, and reviews.
                </p>

                <div className="space-y-4">
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-blue-600" />
                      <h4 className="font-medium text-gray-900">Can Delegate To</h4>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      Teams that this team can delegate work items to
                    </p>
                    <div className="flex gap-2">
                      <select className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="">Select a team...</option>
                        <option value="team-1">Engineering Team</option>
                        <option value="team-2">Design Team</option>
                      </select>
                      <button
                        type="button"
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <h4 className="font-medium text-gray-900">Can Escalate To</h4>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      Teams or roles that this team can escalate issues to
                    </p>
                    <div className="flex gap-2">
                      <select className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="">Select a team/role...</option>
                      </select>
                      <button
                        type="button"
                        className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <h4 className="font-medium text-gray-900">Can Request Review From</h4>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      Teams that can provide code and artifact reviews
                    </p>
                    <div className="flex gap-2">
                      <select className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="">Select a team...</option>
                      </select>
                      <button
                        type="button"
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Auto-Assign */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('autoAssignEnabled')}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 mt-0.5"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Enable Auto-Assignment</span>
                      <p className="text-sm text-gray-500 mt-1">
                        Automatically assign incoming work items to available agents in this team
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {isDirty ? 'Unsaved changes' : 'All changes saved'}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
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
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
