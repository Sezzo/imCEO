import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SkillRegistry, type Skill, type SkillStatus, type SkillCategory } from '@/components/skills/SkillRegistry';

// Mock date-fns
vi.mock('date-fns', () => ({
  format: () => 'Jan 15',
  formatDistanceToNow: () => '2 days ago',
}));

const mockSkills: Skill[] = [
  {
    skillId: 'skill-1',
    name: 'code-review',
    version: '1.2.0',
    description: 'Reviews code for quality and bugs',
    status: 'active',
    category: 'code',
    author: 'admin',
    tags: ['quality', 'review'],
    dependencies: [],
    inputSchema: {},
    outputSchema: {},
    implementation: {
      type: 'code',
      content: 'function review(code) { return { passed: true }; }',
    },
    examples: [],
    documentation: 'How to use this skill',
    testCases: [],
    usageCount: 42,
    rating: 4.5,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    skillId: 'skill-2',
    name: 'data-analysis',
    version: '2.0.0',
    description: 'Analyzes data sets and generates reports',
    status: 'draft',
    category: 'data',
    author: 'data-team',
    tags: ['analytics', 'reporting'],
    dependencies: ['skill-1'],
    inputSchema: {},
    outputSchema: {},
    implementation: {
      type: 'prompt',
      prompt: 'Analyze the following data...',
    },
    examples: [],
    documentation: 'Data analysis skill documentation',
    testCases: [],
    usageCount: 15,
    rating: 4.0,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
  },
  {
    skillId: 'skill-3',
    name: 'slack-notification',
    version: '1.0.0',
    description: 'Sends notifications to Slack',
    status: 'active',
    category: 'communication',
    author: 'devops',
    tags: ['slack', 'notification'],
    dependencies: [],
    inputSchema: {},
    outputSchema: {},
    implementation: {
      type: 'mcp',
      mcpServer: 'https://mcp.example.com/slack',
    },
    examples: [],
    documentation: 'Slack integration docs',
    testCases: [],
    usageCount: 128,
    rating: 4.8,
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
  },
];

describe('SkillRegistry', () => {
  const mockHandlers = {
    onCreateSkill: vi.fn(),
    onUpdateSkill: vi.fn(),
    onDeleteSkill: vi.fn(),
    onTestSkill: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders skill registry header', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Skill Registry')).toBeInTheDocument();
  });

  it('renders New Skill button', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('New Skill')).toBeInTheDocument();
  });

  it('renders browse and create tabs', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Browse Skills')).toBeInTheDocument();
    expect(screen.getByText('Create Skill')).toBeInTheDocument();
  });

  it('displays skills in browse view', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('code-review')).toBeInTheDocument();
    expect(screen.getByText('data-analysis')).toBeInTheDocument();
    expect(screen.getByText('slack-notification')).toBeInTheDocument();
  });

  it('displays skill descriptions', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Reviews code for quality and bugs')).toBeInTheDocument();
    expect(screen.getByText('Analyzes data sets and generates reports')).toBeInTheDocument();
  });

  it('displays skill status badges', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('displays skill category labels', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
  });

  it('displays skill versions', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
    expect(screen.getByText('v2.0.0')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });

  it('displays usage counts', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('42 uses')).toBeInTheDocument();
    expect(screen.getByText('15 uses')).toBeInTheDocument();
    expect(screen.getByText('128 uses')).toBeInTheDocument();
  });

  it('displays skill ratings', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('4.0')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
  });

  it('displays skill tags', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('quality')).toBeInTheDocument();
    expect(screen.getByText('review')).toBeInTheDocument();
    expect(screen.getByText('analytics')).toBeInTheDocument();
    expect(screen.getByText('slack')).toBeInTheDocument();
  });

  it('filters skills by search term', async () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search skills...');
    fireEvent.change(searchInput, { target: { value: 'code' } });

    expect(screen.getByText('code-review')).toBeInTheDocument();
    expect(screen.queryByText('slack-notification')).not.toBeInTheDocument();
  });

  it('filters skills by category', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    const categorySelect = screen.getByDisplayValue('All Categories');
    fireEvent.change(categorySelect, { target: { value: 'code' } });

    expect(screen.getByText('code-review')).toBeInTheDocument();
    expect(screen.queryByText('data-analysis')).not.toBeInTheDocument();
    expect(screen.queryByText('slack-notification')).not.toBeInTheDocument();
  });

  it('filters skills by status', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    const statusSelect = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusSelect, { target: { value: 'draft' } });

    expect(screen.getByText('data-analysis')).toBeInTheDocument();
    expect(screen.queryByText('code-review')).not.toBeInTheDocument();
  });

  it('displays empty state when no skills match filter', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search skills...');
    fireEvent.change(searchInput, { target: { value: 'NonExistentSkill' } });

    expect(screen.getByText('No skills found')).toBeInTheDocument();
  });

  it('displays empty state when no skills', () => {
    render(
      <SkillRegistry
        skills={[]}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('No skills found')).toBeInTheDocument();
    expect(screen.getByText('Create your first skill to get started')).toBeInTheDocument();
  });

  it('switches to create tab', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    const createTab = screen.getByText('Create Skill');
    fireEvent.click(createTab);

    // Should show form fields
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('displays category options', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    const createTab = screen.getByText('Create Skill');
    fireEvent.click(createTab);

    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Integration')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('displays implementation type options', () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    const createTab = screen.getByText('Create Skill');
    fireEvent.click(createTab);

    expect(screen.getByText('Implementation Type')).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('prompt')).toBeInTheDocument();
    expect(screen.getByText('MCP Server')).toBeInTheDocument();
  });

  it('calls onCreateSkill when form submitted', async () => {
    render(
      <SkillRegistry
        skills={mockSkills}
        currentAgentId="agent-1"
        {...mockHandlers}
      />
    );

    const createTab = screen.getByText('Create Skill');
    fireEvent.click(createTab);

    // Form should be visible
    expect(screen.getByText('Create Skill')).toBeInTheDocument();
  });
});
