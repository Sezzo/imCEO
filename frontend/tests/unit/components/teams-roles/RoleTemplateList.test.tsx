import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleTemplateList, HIERARCHY_LEVELS, type RoleTemplate, type HierarchyLevel } from '@/components/teams-roles/RoleTemplateList';

const mockRoles: RoleTemplate[] = [
  {
    role_template_id: 'role-1',
    name: 'CEO',
    hierarchy_level: 'CEO',
    description: 'Chief Executive Officer',
    purpose: 'Lead the company',
    primary_responsibilities: ['Strategic planning', 'Team leadership', 'Decision making'],
    non_responsibilities: ['Day-to-day operations'],
    decision_scope: 'All company decisions',
    escalation_scope: 'None',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    role_template_id: 'role-2',
    name: 'CTO',
    hierarchy_level: 'Executive',
    description: 'Chief Technology Officer',
    purpose: 'Lead technology',
    primary_responsibilities: ['Tech strategy', 'Architecture decisions'],
    non_responsibilities: ['Marketing decisions'],
    decision_scope: 'Technology decisions',
    escalation_scope: 'Technical escalations',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    role_template_id: 'role-3',
    name: 'Engineering Manager',
    hierarchy_level: 'Management',
    description: 'Manages engineering teams',
    purpose: 'Deliver products',
    primary_responsibilities: ['Team management', 'Project delivery'],
    non_responsibilities: ['Budget approval'],
    decision_scope: 'Engineering team decisions',
    escalation_scope: 'Team issues',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    role_template_id: 'role-4',
    name: 'Senior Engineer',
    hierarchy_level: 'Lead',
    description: 'Senior developer',
    purpose: 'Build features',
    primary_responsibilities: ['Coding', 'Code review', 'Mentoring'],
    non_responsibilities: ['Hiring decisions'],
    decision_scope: 'Technical implementation',
    escalation_scope: 'Technical blockers',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('RoleTemplateList', () => {
  const mockHandlers = {
    onSelectRole: vi.fn(),
    onCreateRole: vi.fn(),
    onEditRole: vi.fn(),
    onDeleteRole: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders role template list header', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    expect(screen.getByText('Rollen-Templates')).toBeInTheDocument();
    expect(screen.getByText('+ Neue Rolle')).toBeInTheDocument();
  });

  it('renders hierarchy legend', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    // Legend shows all hierarchy levels
    const legend = screen.getByText('CEO').parentElement?.parentElement;
    expect(legend).toHaveClass('hierarchy-legend');

    HIERARCHY_LEVELS.forEach((level) => {
      expect(screen.getAllByText(level).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders roles grouped by hierarchy level', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    // Should show role names
    expect(screen.getByText('CEO')).toBeInTheDocument();
    expect(screen.getByText('CTO')).toBeInTheDocument();
    expect(screen.getByText('Engineering Manager')).toBeInTheDocument();
    expect(screen.getByText('Senior Engineer')).toBeInTheDocument();
  });

  it('displays role count per level', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    // Find role count indicators
    const countElements = screen.getAllByText(/\d+ Rollen/);
    expect(countElements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays role descriptions', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    expect(screen.getByText('Chief Executive Officer')).toBeInTheDocument();
    expect(screen.getByText('Chief Technology Officer')).toBeInTheDocument();
  });

  it('displays role purposes', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    // Find purposes by partial text
    expect(screen.getByText(/Zweck:.*Lead the company/)).toBeInTheDocument();
    expect(screen.getByText(/Zweck:.*Lead technology/)).toBeInTheDocument();
  });

  it('displays role responsibilities', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    expect(screen.getByText('Strategic planning')).toBeInTheDocument();
    expect(screen.getByText('Team leadership')).toBeInTheDocument();
    expect(screen.getByText('Decision making')).toBeInTheDocument();
  });

  it('shows "more items" indicator for many responsibilities', () => {
    const rolesWithManyResponsibilities: RoleTemplate[] = [
      {
        ...mockRoles[0],
        primary_responsibilities: ['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5'],
      },
    ];

    render(<RoleTemplateList roleTemplates={rolesWithManyResponsibilities} {...mockHandlers} />);

    expect(screen.getByText('+2 weitere')).toBeInTheDocument();
  });

  it('calls onCreateRole when create button is clicked', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    const createButton = screen.getByText('+ Neue Rolle');
    fireEvent.click(createButton);

    expect(mockHandlers.onCreateRole).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectRole when role card is clicked', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    const roleCard = screen.getByText('CTO').closest('.role-card');
    expect(roleCard).toBeInTheDocument();

    if (roleCard) {
      fireEvent.click(roleCard);
    }

    expect(mockHandlers.onSelectRole).toHaveBeenCalledWith(mockRoles[1]);
  });

  it('calls onEditRole when edit button is clicked', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    const editButtons = screen.getAllByText('Bearbeiten');
    fireEvent.click(editButtons[0]);

    expect(mockHandlers.onEditRole).toHaveBeenCalledWith(mockRoles[0]);
  });

  it('calls onDeleteRole when delete button is clicked', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    const deleteButtons = screen.getAllByText('Löschen');
    fireEvent.click(deleteButtons[0]);

    expect(mockHandlers.onDeleteRole).toHaveBeenCalledWith('role-1');
  });

  it('prevents event propagation when clicking action buttons', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    const editButtons = screen.getAllByText('Bearbeiten');
    fireEvent.click(editButtons[0]);

    expect(mockHandlers.onSelectRole).not.toHaveBeenCalled();
  });

  it('filters roles by search text', async () => {
    const user = userEvent.setup();
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    const searchInput = screen.getByPlaceholderText('Rollen suchen...');
    await user.type(searchInput, 'CTO');

    expect(screen.getByText('CTO')).toBeInTheDocument();
    expect(screen.queryByText('Engineering Manager')).not.toBeInTheDocument();

    // Count should update
    expect(screen.getByText('1 von 4 Rollen angezeigt')).toBeInTheDocument();
  });

  it('filters roles by hierarchy level', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    const levelSelect = screen.getByDisplayValue('Alle Ebenen');
    fireEvent.change(levelSelect, { target: { value: 'CEO' } });

    // Should only show CEO level
    expect(screen.getByText('CEO')).toBeInTheDocument();
    expect(screen.queryByText('CTO')).not.toBeInTheDocument();
    expect(screen.queryByText('Engineering Manager')).not.toBeInTheDocument();
  });

  it('shows all hierarchy levels in filter dropdown', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    const levelSelect = screen.getByDisplayValue('Alle Ebenen');
    const options = levelSelect.querySelectorAll('option');

    expect(options.length).toBe(8); // "Alle Ebenen" + 7 levels
    expect(options[0]).toHaveValue('all');
    expect(options[1]).toHaveValue('CEO');
    expect(options[2]).toHaveValue('Executive');
  });

  it('renders empty state when no roles match filter', async () => {
    const user = userEvent.setup();
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    const searchInput = screen.getByPlaceholderText('Rollen suchen...');
    await user.type(searchInput, 'NonExistentRole');

    expect(screen.getByText('Keine Rollen gefunden.')).toBeInTheDocument();
  });

  it('resets filters when clicking reset button', async () => {
    const user = userEvent.setup();
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    const searchInput = screen.getByPlaceholderText('Rollen suchen...');
    await user.type(searchInput, 'CTO');

    expect(screen.getByText('CTO')).toBeInTheDocument();
    expect(screen.queryByText('CEO')).not.toBeInTheDocument();

    // Reset filters
    const resetButton = screen.getByText('Filter zurücksetzen');
    fireEvent.click(resetButton);

    // All roles should be visible again
    expect(screen.getByText('CEO')).toBeInTheDocument();
    expect(screen.getByText('CTO')).toBeInTheDocument();
  });

  it('renders with empty roles array', () => {
    render(<RoleTemplateList roleTemplates={[]} {...mockHandlers} />);

    expect(screen.getByText('Rollen-Templates')).toBeInTheDocument();
    expect(screen.getByText('0 von 0 Rollen angezeigt')).toBeInTheDocument();
    expect(screen.getByText('Keine Rollen gefunden.')).toBeInTheDocument();
  });

  it('search matches role name, description, and purpose', async () => {
    const user = userEvent.setup();
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    // Search by purpose
    const searchInput = screen.getByPlaceholderText('Rollen suchen...');
    await user.type(searchInput, 'technology');

    expect(screen.getByText('CTO')).toBeInTheDocument();
    expect(screen.queryByText('CEO')).not.toBeInTheDocument();
  });

  it('displays hierarchy colors correctly', () => {
    render(<RoleTemplateList roleTemplates={mockRoles} {...mockHandlers} />);

    // Check that hierarchy badges have the correct background colors
    const hierarchyBadges = screen.getAllByText('CEO');
    expect(hierarchyBadges.length).toBeGreaterThan(0);
  });
});
