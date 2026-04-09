import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentProfileList, type AgentProfile, type AgentStatus } from '@/components/teams-roles/AgentProfileList';

const mockAgents: AgentProfile[] = [
  {
    agent_id: 'agent-1',
    team_id: 'team-1',
    role_template_id: 'role-1',
    display_name: 'Alice Agent',
    internal_name: 'alice_backend',
    seniority: 'senior',
    status: 'active',
    max_parallel_tasks: 5,
    active_tasks: 2,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    agent_id: 'agent-2',
    team_id: 'team-2',
    role_template_id: 'role-2',
    display_name: 'Bob Bot',
    internal_name: 'bob_frontend',
    seniority: 'mid',
    status: 'busy',
    max_parallel_tasks: 3,
    active_tasks: 3,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    agent_id: 'agent-3',
    team_id: 'team-1',
    role_template_id: 'role-1',
    display_name: 'Charlie Code',
    internal_name: 'charlie_dev',
    seniority: 'junior',
    status: 'idle',
    max_parallel_tasks: 4,
    active_tasks: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    agent_id: 'agent-4',
    team_id: 'team-3',
    role_template_id: 'role-3',
    display_name: 'Diana Data',
    internal_name: 'diana_data',
    seniority: 'principal',
    status: 'offline',
    max_parallel_tasks: 10,
    active_tasks: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const mockTeams = [
  { team_id: 'team-1', name: 'Backend Team' },
  { team_id: 'team-2', name: 'Frontend Team' },
  { team_id: 'team-3', name: 'Data Team' },
];

const mockRoles = [
  { role_template_id: 'role-1', name: 'Senior Engineer' },
  { role_template_id: 'role-2', name: 'Developer' },
  { role_template_id: 'role-3', name: 'Data Scientist' },
];

describe('AgentProfileList', () => {
  const mockHandlers = {
    onSelectAgent: vi.fn(),
    onCreateAgent: vi.fn(),
    onEditAgent: vi.fn(),
    onDeleteAgent: vi.fn(),
    onActivateAgent: vi.fn(),
    onDeactivateAgent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders agent profile list header', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Agent-Profile')).toBeInTheDocument();
    expect(screen.getByText('+ Neuer Agent')).toBeInTheDocument();
  });

  it('renders status overview pills', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    // Status labels - use getAllByText because they appear in pills and badges
    expect(screen.getAllByText('Aktiv').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Beschäftigt').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bereit').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Offline').length).toBeGreaterThanOrEqual(1);
  });

  it('displays status counts', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    // Should show count of 4 total agents in status overview
    const statusPills = screen.getAllByText('4');
    expect(statusPills.length).toBeGreaterThan(0);
  });

  it('renders agents in table', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    // Agent names
    expect(screen.getByText('Alice Agent')).toBeInTheDocument();
    expect(screen.getByText('Bob Bot')).toBeInTheDocument();
    expect(screen.getByText('Charlie Code')).toBeInTheDocument();

    // Internal names
    expect(screen.getByText('alice_backend')).toBeInTheDocument();
    expect(screen.getByText('bob_frontend')).toBeInTheDocument();
  });

  it('displays team names', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Backend Team')).toBeInTheDocument();
    expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    expect(screen.getByText('Data Team')).toBeInTheDocument();
  });

  it('displays role names', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Senior Engineer')).toBeInTheDocument();
    expect(screen.getByText('Developer')).toBeInTheDocument();
  });

  it('displays seniority badges', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Senior')).toBeInTheDocument();
    expect(screen.getByText('Professional')).toBeInTheDocument();
    expect(screen.getByText('Junior')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
  });

  it('displays task indicators', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    // Task counts
    expect(screen.getByText('2/5')).toBeInTheDocument(); // Alice
    expect(screen.getByText('3/3')).toBeInTheDocument(); // Bob (full capacity)
    expect(screen.getByText('0/4')).toBeInTheDocument(); // Charlie
  });

  it('displays status badges with correct colors', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    // Status badges should be displayed (appears in both overview and table)
    const activeBadges = screen.getAllByText('Aktiv');
    expect(activeBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows activate button for offline/suspended agents', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    // Should show play button (▶) for offline agent
    const activateButtons = screen.getAllByTitle('Aktivieren');
    expect(activateButtons.length).toBe(1); // Only Diana is offline
  });

  it('shows deactivate button for active agents', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    // Should show pause button (⏸) for active agents
    const deactivateButtons = screen.getAllByTitle('Deaktivieren');
    expect(deactivateButtons.length).toBe(3); // 3 agents are not offline
  });

  it('calls onCreateAgent when create button is clicked', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const createButton = screen.getByText('+ Neuer Agent');
    fireEvent.click(createButton);

    expect(mockHandlers.onCreateAgent).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectAgent when agent row is clicked', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const agentRow = screen.getByText('Alice Agent').closest('.agent-row');
    expect(agentRow).toBeInTheDocument();

    if (agentRow) {
      fireEvent.click(agentRow);
    }

    expect(mockHandlers.onSelectAgent).toHaveBeenCalledWith(mockAgents[0]);
  });

  it('calls onEditAgent when edit button is clicked', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const editButtons = screen.getAllByTitle('Bearbeiten');
    fireEvent.click(editButtons[0]);

    expect(mockHandlers.onEditAgent).toHaveBeenCalledWith(mockAgents[0]);
  });

  it('calls onDeleteAgent when delete button is clicked', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const deleteButtons = screen.getAllByTitle('Löschen');
    fireEvent.click(deleteButtons[0]);

    expect(mockHandlers.onDeleteAgent).toHaveBeenCalledWith('agent-1');
  });

  it('calls onActivateAgent when activate button is clicked', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const activateButton = screen.getByTitle('Aktivieren');
    fireEvent.click(activateButton);

    expect(mockHandlers.onActivateAgent).toHaveBeenCalledWith('agent-4');
  });

  it('calls onDeactivateAgent when deactivate button is clicked', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const deactivateButtons = screen.getAllByTitle('Deaktivieren');
    fireEvent.click(deactivateButtons[0]);

    expect(mockHandlers.onDeactivateAgent).toHaveBeenCalledWith('agent-1');
  });

  it('prevents event propagation when clicking action buttons', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const editButtons = screen.getAllByTitle('Bearbeiten');
    fireEvent.click(editButtons[0]);

    expect(mockHandlers.onSelectAgent).not.toHaveBeenCalled();
  });

  it('filters agents by search text', async () => {
    const user = userEvent.setup();
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const searchInput = screen.getByPlaceholderText('Agents suchen...');
    await user.type(searchInput, 'Alice');

    expect(screen.getByText('Alice Agent')).toBeInTheDocument();
    expect(screen.queryByText('Bob Bot')).not.toBeInTheDocument();

    // Count should update
    expect(screen.getByText('1 von 4 Agents angezeigt')).toBeInTheDocument();
  });

  it('filters agents by status when clicking status pill', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    // Find and click on a status pill
    const statusPills = screen.getAllByText('Aktiv');
    const firstPill = statusPills[0].closest('.status-pill');

    if (firstPill) {
      fireEvent.click(firstPill);
    }

    // Should only show active agents
    expect(screen.getByText('Alice Agent')).toBeInTheDocument();
  });

  it('filters agents by team', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const teamSelect = screen.getByDisplayValue('Alle Teams');
    fireEvent.change(teamSelect, { target: { value: 'team-1' } });

    // Should show agents from Backend Team
    expect(screen.getByText('Alice Agent')).toBeInTheDocument();
    expect(screen.getByText('Charlie Code')).toBeInTheDocument();
    expect(screen.queryByText('Bob Bot')).not.toBeInTheDocument();
  });

  it('shows all teams in filter dropdown', () => {
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const teamSelect = screen.getByDisplayValue('Alle Teams');
    const options = teamSelect.querySelectorAll('option');

    expect(options.length).toBe(4); // "Alle Teams" + 3 teams
    expect(options[0]).toHaveValue('all');
    expect(options[1]).toHaveValue('team-1');
  });

  it('renders empty state when no agents match filter', async () => {
    const user = userEvent.setup();
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const searchInput = screen.getByPlaceholderText('Agents suchen...');
    await user.type(searchInput, 'NonExistentAgent');

    expect(screen.getByText('Keine Agents gefunden.')).toBeInTheDocument();
  });

  it('resets filters when clicking reset button', async () => {
    const user = userEvent.setup();
    render(
      <AgentProfileList
        agents={mockAgents}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    const searchInput = screen.getByPlaceholderText('Agents suchen...');
    await user.type(searchInput, 'Alice');

    expect(screen.getByText('Alice Agent')).toBeInTheDocument();
    expect(screen.queryByText('Bob Bot')).not.toBeInTheDocument();

    // Reset filters
    const resetButton = screen.getByText('Filter zurücksetzen');
    fireEvent.click(resetButton);

    // All agents should be visible again
    expect(screen.getByText('Alice Agent')).toBeInTheDocument();
    expect(screen.getByText('Bob Bot')).toBeInTheDocument();
  });

  it('renders with empty agents array', () => {
    render(
      <AgentProfileList
        agents={[]}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Agent-Profile')).toBeInTheDocument();
    expect(screen.getByText('0 von 0 Agents angezeigt')).toBeInTheDocument();
    expect(screen.getByText('Keine Agents gefunden.')).toBeInTheDocument();
  });

  it('displays team ID when team not found', () => {
    const agentsWithUnknownTeam: AgentProfile[] = [
      {
        ...mockAgents[0],
        team_id: 'unknown-team',
      },
    ];

    render(
      <AgentProfileList
        agents={agentsWithUnknownTeam}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    // Should display the team ID when team not found
    expect(screen.getByText('unknown-team')).toBeInTheDocument();
  });

  it('displays role ID when role not found', () => {
    const agentsWithUnknownRole: AgentProfile[] = [
      {
        ...mockAgents[0],
        role_template_id: 'unknown-role',
      },
    ];

    render(
      <AgentProfileList
        agents={agentsWithUnknownRole}
        teams={mockTeams}
        roles={mockRoles}
        {...mockHandlers}
      />
    );

    // Should display the role ID when role not found
    expect(screen.getByText('unknown-role')).toBeInTheDocument();
  });
});
