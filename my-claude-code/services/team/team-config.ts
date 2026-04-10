/**
 * Team Configuration System
 *
 * Manages team configurations, templates, and defaults.
 * Provides persistent storage for team setups.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getClaudeConfigHomeDir } from '../utils/envUtils.js';
import { logForDebugging } from '../utils/debug.js';
import type { AgentConfig, TeamConfig, TeamDefaults, TeamPolicies } from './types.js';

const TEAMS_CONFIG_FILE = 'teams.json';

interface StoredTeamConfig {
  id: string;
  name: string;
  description?: string;
  coordinatorModel: string;
  coordinatorSystemPrompt?: string;
  agents: AgentConfig[];
  createdAt: string;
  updatedAt: string;
}

interface TeamsConfigFile {
  version: string;
  defaults: TeamDefaults;
  policies: TeamPolicies;
  teams: StoredTeamConfig[];
  templates: Record<string, TeamTemplate>;
}

interface TeamTemplate {
  name: string;
  description: string;
  agents: Omit<AgentConfig, 'id'>[];
  coordinatorModel: string;
  coordinatorSystemPrompt?: string;
}

const DEFAULT_TEMPLATES: Record<string, TeamTemplate> = {
  dev: {
    name: 'Development Team',
    description: 'Full-stack development team with code review',
    coordinatorModel: 'opencode-opus-4',
    coordinatorSystemPrompt: 'Coordinate development tasks and ensure code quality.',
    agents: [
      {
        name: 'Senior Developer',
        role: 'worker',
        model: 'opencode-opus-4',
        systemPrompt: 'Write clean, well-documented code with best practices.',
        tools: ['BashTool', 'FileReadTool', 'FileEditTool', 'FileWriteTool'],
        description: 'Senior software developer',
      },
      {
        name: 'Code Reviewer',
        role: 'reviewer',
        model: 'opencode-sonnet-4',
        systemPrompt: 'Thorough code review for quality and best practices.',
        tools: ['FileReadTool', 'GrepTool'],
        description: 'Code quality reviewer',
      },
      {
        name: 'Test Engineer',
        role: 'worker',
        model: 'opencode-sonnet-4',
        systemPrompt: 'Write comprehensive tests and identify edge cases.',
        tools: ['BashTool', 'FileReadTool', 'FileWriteTool'],
        description: 'Test engineer',
      },
    ],
  },
  review: {
    name: 'Code Review Team',
    description: 'Focused on code review and quality assurance',
    coordinatorModel: 'opencode-opus-4',
    coordinatorSystemPrompt: 'Coordinate code reviews and ensure security.',
    agents: [
      {
        name: 'Primary Reviewer',
        role: 'reviewer',
        model: 'opencode-opus-4',
        systemPrompt: 'Primary code review focusing on architecture and design.',
        tools: ['FileReadTool', 'GrepTool', 'GlobTool'],
        description: 'Primary code reviewer',
      },
      {
        name: 'Security Reviewer',
        role: 'reviewer',
        model: 'opencode-sonnet-4',
        systemPrompt: 'Security-focused review for vulnerabilities and risks.',
        tools: ['FileReadTool', 'GrepTool'],
        description: 'Security reviewer',
      },
    ],
  },
  research: {
    name: 'Research Team',
    description: 'Information gathering and analysis team',
    coordinatorModel: 'opencode-opus-4',
    coordinatorSystemPrompt: 'Guide research direction and synthesize findings.',
    agents: [
      {
        name: 'Research Lead',
        role: 'coordinator',
        model: 'opencode-opus-4',
        systemPrompt: 'Lead research and synthesize information.',
        tools: ['WebFetchTool', 'WebSearchTool', 'FileReadTool'],
        description: 'Research lead',
      },
      {
        name: 'Data Analyst',
        role: 'worker',
        model: 'opencode-sonnet-4',
        systemPrompt: 'Analyze data and find patterns.',
        tools: ['BashTool', 'FileReadTool', 'FileWriteTool'],
        description: 'Data analyst',
      },
      {
        name: 'Fact Checker',
        role: 'reviewer',
        model: 'opencode-sonnet-4',
        systemPrompt: 'Verify claims and find authoritative sources.',
        tools: ['WebFetchTool', 'WebSearchTool'],
        description: 'Fact checker',
      },
    ],
  },
  security: {
    name: 'Security Audit Team',
    description: 'Comprehensive security analysis and auditing',
    coordinatorModel: 'opencode-opus-4',
    coordinatorSystemPrompt: 'Coordinate security audits and risk assessment.',
    agents: [
      {
        name: 'Security Architect',
        role: 'specialist',
        model: 'opencode-opus-4',
        systemPrompt: 'Analyze architecture for security vulnerabilities.',
        tools: ['FileReadTool', 'GrepTool', 'GlobTool'],
        description: 'Security architecture specialist',
      },
      {
        name: 'Penetration Tester',
        role: 'specialist',
        model: 'opencode-sonnet-4',
        systemPrompt: 'Identify injection vulnerabilities and attack vectors.',
        tools: ['BashTool', 'FileReadTool', 'GrepTool'],
        description: 'Penetration testing specialist',
      },
      {
        name: 'Compliance Reviewer',
        role: 'reviewer',
        model: 'opencode-sonnet-4',
        systemPrompt: 'Review compliance with security standards.',
        tools: ['FileReadTool'],
        description: 'Compliance reviewer',
      },
    ],
  },
  docs: {
    name: 'Documentation Team',
    description: 'Technical writing and documentation',
    coordinatorModel: 'opencode-opus-4',
    coordinatorSystemPrompt: 'Ensure clear and comprehensive documentation.',
    agents: [
      {
        name: 'Technical Writer',
        role: 'worker',
        model: 'opencode-sonnet-4',
        systemPrompt: 'Write clear technical documentation.',
        tools: ['FileReadTool', 'FileWriteTool', 'GlobTool'],
        description: 'Technical writer',
      },
      {
        name: 'API Documenter',
        role: 'specialist',
        model: 'opencode-sonnet-4',
        systemPrompt: 'Document APIs with examples and specifications.',
        tools: ['FileReadTool', 'FileWriteTool', 'GrepTool'],
        description: 'API documentation specialist',
      },
      {
        name: 'Review Editor',
        role: 'reviewer',
        model: 'opencode-haiku-4',
        systemPrompt: 'Review documentation for clarity and accuracy.',
        tools: ['FileReadTool'],
        description: 'Documentation reviewer',
      },
    ],
  },
};

class TeamConfigurationManager {
  private configPath: string;
  private config: TeamsConfigFile;

  constructor() {
    const configDir = getClaudeConfigHomeDir() || join(process.cwd(), '.claude');
    this.configPath = join(configDir, TEAMS_CONFIG_FILE);
    this.config = this.loadConfig();
  }

  private loadConfig(): TeamsConfigFile {
    if (existsSync(this.configPath)) {
      try {
        const data = readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      } catch (error) {
        logForDebugging(`[TeamConfig] Failed to load config: ${error}`);
      }
    }

    // Return default config
    return {
      version: '1.0',
      defaults: {
        coordinatorModel: 'opencode-opus-4',
        workerModel: 'opencode-sonnet-4',
        maxParallelAgents: 5,
        defaultTimeout: 600000,
        enableSharedContext: true,
        enableMessageRouting: true,
      },
      policies: {
        maxRetries: 3,
        allowAgentToAgentCommunication: true,
        broadcastCompletedTasks: true,
        autoRetryFailedTasks: false,
        requireReviewerForCode: false,
      },
      teams: [],
      templates: DEFAULT_TEMPLATES,
    };
  }

  private saveConfig(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logForDebugging(`[TeamConfig] Failed to save config: ${error}`);
    }
  }

  /**
   * Get default configuration values
   */
  getDefaults(): TeamDefaults {
    return { ...this.config.defaults };
  }

  /**
   * Update defaults
   */
  updateDefaults(updates: Partial<TeamDefaults>): void {
    this.config.defaults = { ...this.config.defaults, ...updates };
    this.saveConfig();
  }

  /**
   * Get policies
   */
  getPolicies(): TeamPolicies {
    return { ...this.config.policies };
  }

  /**
   * Update policies
   */
  updatePolicies(updates: Partial<TeamPolicies>): void {
    this.config.policies = { ...this.config.policies, ...updates };
    this.saveConfig();
  }

  /**
   * Get a template by name
   */
  getTemplate(name: string): TeamTemplate | undefined {
    return this.config.templates[name];
  }

  /**
   * Get all available templates
   */
  getAllTemplates(): Record<string, TeamTemplate> {
    return { ...this.config.templates };
  }

  /**
   * Add or update a custom template
   */
  saveTemplate(name: string, template: TeamTemplate): void {
    this.config.templates[name] = template;
    this.saveConfig();
  }

  /**
   * Delete a custom template
   */
  deleteTemplate(name: string): void {
    // Don't allow deleting built-in templates
    if (DEFAULT_TEMPLATES[name]) {
      throw new Error(`Cannot delete built-in template: ${name}`);
    }
    delete this.config.templates[name];
    this.saveConfig();
  }

  /**
   * Save a team configuration
   */
  saveTeam(teamConfig: StoredTeamConfig): void {
    const existingIndex = this.config.teams.findIndex((t) => t.id === teamConfig.id);

    if (existingIndex >= 0) {
      this.config.teams[existingIndex] = {
        ...teamConfig,
        updatedAt: new Date().toISOString(),
      };
    } else {
      this.config.teams.push({
        ...teamConfig,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    this.saveConfig();
  }

  /**
   * Get a saved team configuration
   */
  getTeam(id: string): StoredTeamConfig | undefined {
    return this.config.teams.find((t) => t.id === id);
  }

  /**
   * Get all saved team configurations
   */
  getAllTeams(): StoredTeamConfig[] {
    return [...this.config.teams];
  }

  /**
   * Delete a saved team configuration
   */
  deleteTeam(id: string): void {
    this.config.teams = this.config.teams.filter((t) => t.id !== id);
    this.saveConfig();
  }

  /**
   * Create a TeamConfig from template
   */
  createFromTemplate(
    templateName: string,
    teamName: string,
    options: {
      description?: string;
      coordinatorModel?: string;
    } = {}
  ): Partial<TeamConfig> {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Generate agent configs with IDs
    const agents: AgentConfig[] = template.agents.map((agent, index) => ({
      ...agent,
      id: `agent-${index}-${Date.now().toString(36)}`,
    }));

    return {
      name: teamName,
      description: options.description || template.description,
      coordinatorModel: options.coordinatorModel || template.coordinatorModel,
      coordinatorSystemPrompt: template.coordinatorSystemPrompt,
      agents,
    };
  }

  /**
   * Export configuration to JSON string
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON string
   */
  importConfig(json: string): void {
    try {
      const imported = JSON.parse(json) as TeamsConfigFile;
      // Validate version
      if (!imported.version) {
        throw new Error('Invalid config: missing version');
      }
      this.config = imported;
      this.saveConfig();
    } catch (error) {
      throw new Error(`Failed to import config: ${error}`);
    }
  }
}

// Export singleton instance
export const teamConfig = new TeamConfigurationManager();

// Re-export types
export type { TeamTemplate, StoredTeamConfig, TeamsConfigFile };
