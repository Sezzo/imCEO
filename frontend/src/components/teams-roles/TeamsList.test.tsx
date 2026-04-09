import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamsList, type Team } from './TeamsList';

const mockTeams: Team[] = [
  {
    team_id: 'team-1',
    department_id: 'dept-1',
    name: 'Backend Team',
    description: 'Backend Engineering Team',
    mission: 'Build robust APIs',
    team_type: 'engineering',
    lead_role_id: 'role-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    team_id: 'team-2',
    department_id: 'dept-1',
    name: 'Frontend Team',
    description: 'Frontend Engineering Team',
    mission: 'Build great UI',
    team_type: 'engineering',
    lead_role_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    team_id: 'team-3',
    department_id: 'dept-2',
    name: 'Product Team',
    description: 'Product Management Team',
    mission: 'Define product strategy',
    team_type: 'product',
    lead_role_id: 'role-2',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('TeamsList', () => {
  const mockHandlers = {
    onSelectTeam: vi.fn(),
    onCreateTeam: vi.fn(),
    onEditTeam: vi.fn(),
    onDeleteTeam: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders teams list header', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('+ Neues Team')).toBeInTheDocument();
  });

  it('renders all teams', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    expect(screen.getByText('Backend Team')).toBeInTheDocument();
    expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    expect(screen.getByText('Product Team')).toBeInTheDocument();
  });

  it('displays team descriptions', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    expect(screen.getByText('Backend Engineering Team')).toBeInTheDocument();
    expect(screen.getByText('Frontend Engineering Team')).toBeInTheDocument();
    expect(screen.getByText('Product Management Team')).toBeInTheDocument();
  });

  it('displays team missions', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    expect(screen.getByText('Mission: Build robust APIs')).toBeInTheDocument();
    expect(screen.getByText('Mission: Build great UI')).toBeInTheDocument();
    expect(screen.getByText('Mission: Define product strategy')).toBeInTheDocument();
  });

  it('displays team type badges', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    // Should have 3 engineering badges and 1 product badge
    const engineeringBadges = screen.getAllByText('engineering');
    expect(engineeringBadges.length).toBe(2);

    expect(screen.getByText('product')).toBeInTheDocument();
  });

  it('displays lead role information', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    expect(screen.getByText('Lead: role-1')).toBeInTheDocument();
    expect(screen.getByText('Lead: Nicht zugewiesen')).toBeInTheDocument();
    expect(screen.getByText('Lead: role-2')).toBeInTheDocument();
  });

  it('displays department IDs', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    expect(screen.getAllByText('Dept: dept-1').length).toBe(2);
    expect(screen.getByText('Dept: dept-2')).toBeInTheDocument();
  });

  it('calls onCreateTeam when create button is clicked', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const createButton = screen.getByText('+ Neues Team');
    fireEvent.click(createButton);

    expect(mockHandlers.onCreateTeam).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectTeam when team card is clicked', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const teamCard = screen.getByText('Backend Team').closest('.team-card');
    expect(teamCard).toBeInTheDocument();

    if (teamCard) {
      fireEvent.click(teamCard);
    }

    expect(mockHandlers.onSelectTeam).toHaveBeenCalledWith(mockTeams[0]);
  });

  it('calls onEditTeam when edit button is clicked', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const editButtons = screen.getAllByText('Bearbeiten');
    fireEvent.click(editButtons[0]);

    expect(mockHandlers.onEditTeam).toHaveBeenCalledWith(mockTeams[0]);
  });

  it('calls onDeleteTeam when delete button is clicked', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const deleteButtons = screen.getAllByText('Löschen');
    fireEvent.click(deleteButtons[0]);

    expect(mockHandlers.onDeleteTeam).toHaveBeenCalledWith('team-1');
  });

  it('prevents event propagation when clicking action buttons', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const editButtons = screen.getAllByText('Bearbeiten');
    const deleteButtons = screen.getAllByText('Löschen');

    // Clicking action buttons should not trigger onSelectTeam
    fireEvent.click(editButtons[0]);
    fireEvent.click(deleteButtons[0]);

    expect(mockHandlers.onSelectTeam).not.toHaveBeenCalled();
  });

  it('filters teams by search text', async () => {
    const user = userEvent.setup();
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const searchInput = screen.getByPlaceholderText('Teams suchen...');
    await user.type(searchInput, 'Backend');

    // Should only show Backend Team
    expect(screen.getByText('Backend Team')).toBeInTheDocument();
    expect(screen.queryByText('Frontend Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Product Team')).not.toBeInTheDocument();

    // Count should update
    expect(screen.getByText('1 von 3 Teams angezeigt')).toBeInTheDocument();
  });

  it('filters teams by type', async () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const typeSelect = screen.getByDisplayValue('Alle Typen');
    fireEvent.change(typeSelect, { target: { value: 'product' } });

    // Should only show Product Team
    expect(screen.queryByText('Backend Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Frontend Team')).not.toBeInTheDocument();
    expect(screen.getByText('Product Team')).toBeInTheDocument();
  });

  it('shows all team types in filter dropdown', () => {
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const typeSelect = screen.getByDisplayValue('Alle Typen');
    const options = typeSelect.querySelectorAll('option');

    expect(options.length).toBe(3); // "Alle Typen" + 2 unique types
    expect(options[0]).toHaveValue('all');
    expect(options[1]).toHaveValue('engineering');
    expect(options[2]).toHaveValue('product');
  });

  it('filters by both text and type', async () => {
    const user = userEvent.setup();
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const searchInput = screen.getByPlaceholderText('Teams suchen...');
    const typeSelect = screen.getByDisplayValue('Alle Typen');

    await user.type(searchInput, 'Team');
    fireEvent.change(typeSelect, { target: { value: 'engineering' } });

    // Should show both engineering teams
    expect(screen.getByText('Backend Team')).toBeInTheDocument();
    expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    expect(screen.queryByText('Product Team')).not.toBeInTheDocument();
  });

  it('renders empty state when no teams match filter', async () => {
    const user = userEvent.setup();
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const searchInput = screen.getByPlaceholderText('Teams suchen...');
    await user.type(searchInput, 'NonExistentTeam');

    expect(screen.getByText('Keine Teams gefunden.')).toBeInTheDocument();
  });

  it('resets filters when clicking reset button', async () => {
    const user = userEvent.setup();
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const searchInput = screen.getByPlaceholderText('Teams suchen...');
    await user.type(searchInput, 'Backend');

    // Should only show Backend Team
    expect(screen.getByText('Backend Team')).toBeInTheDocument();
    expect(screen.queryByText('Frontend Team')).not.toBeInTheDocument();

    // Reset filters
    const resetButton = screen.getByText('Filter zurücksetzen');
    fireEvent.click(resetButton);

    // All teams should be visible again
    expect(screen.getByText('Backend Team')).toBeInTheDocument();
    expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    expect(screen.getByText('Product Team')).toBeInTheDocument();
  });

  it('renders with empty teams array', () => {
    render(<TeamsList teams={[]} {...mockHandlers} />);

    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('0 von 0 Teams angezeigt')).toBeInTheDocument();
    expect(screen.getByText('Keine Teams gefunden.')).toBeInTheDocument();
  });

  it('search matches team name, description, and mission', async () => {
    const user = userEvent.setup();
    render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    // Search by mission
    const searchInput = screen.getByPlaceholderText('Teams suchen...');
    await user.type(searchInput, 'API');

    expect(screen.getByText('Backend Team')).toBeInTheDocument();
    expect(screen.queryByText('Frontend Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Product Team')).not.toBeInTheDocument();
  });

  it('updates team types when teams prop changes', () => {
    const { rerender } = render(<TeamsList teams={mockTeams} {...mockHandlers} />);

    const newTeams: Team[] = [
      {
        team_id: 'team-4',
        department_id: 'dept-1',
        name: 'DevOps Team',
        description: 'DevOps Team',
        mission: 'Infrastructure',
        team_type: 'devops',
        lead_role_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    rerender(<TeamsList teams={newTeams} {...mockHandlers} />);

    // Should show new team type in filter
    const typeSelect = screen.getByDisplayValue('Alle Typen');
    const options = typeSelect.querySelectorAll('option');

    expect(options.length).toBe(2); // "Alle Typen" + 1 unique type
    expect(options[1]).toHaveValue('devops');
  });
});
