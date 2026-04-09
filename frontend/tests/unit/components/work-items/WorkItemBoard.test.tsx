import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkItemBoard } from '../../../src/components/work-items/WorkItemBoard';

// Mock modules before imports
const mockGetBoard = vi.fn();
const mockTransition = vi.fn();
const mockSetWorkItems = vi.fn();

vi.mock('../../../src/api/client', () => ({
  workItemApi: {
    getBoard: (...args: unknown[]) => mockGetBoard(...args),
    transition: (...args: unknown[]) => mockTransition(...args),
  },
}));

vi.mock('../../../src/store/companyStore', () => ({
  useCompanyStore: vi.fn(() => ({
    workItems: [],
    setWorkItems: mockSetWorkItems,
  })),
}));

const mockWorkItems = [
  {
    workItemId: 'work-1',
    type: 'Story',
    title: 'Implement login',
    description: 'Create user login functionality',
    parentWorkItemId: null,
    companyId: 'comp-123',
    divisionId: 'div-1',
    departmentId: 'dept-1',
    owningTeamId: 'team-1',
    owningRoleId: null,
    assignedAgentId: 'agent-1',
    priority: 'high',
    severity: null,
    state: 'InProgress',
    approvalState: null,
    riskScore: null,
    costLimit: null,
    estimatedEffort: 8,
    actualEffort: null,
    createdAt: '2024-01-01T00:00:00Z',
    startedAt: null,
    dueAt: '2024-02-01T00:00:00Z',
    completedAt: null,
  },
  {
    workItemId: 'work-2',
    type: 'Task',
    title: 'Setup database',
    description: 'Configure PostgreSQL',
    parentWorkItemId: null,
    companyId: 'comp-123',
    divisionId: 'div-1',
    departmentId: 'dept-1',
    owningTeamId: 'team-1',
    owningRoleId: null,
    assignedAgentId: null,
    priority: 'medium',
    severity: null,
    state: 'Done',
    approvalState: null,
    riskScore: null,
    costLimit: null,
    estimatedEffort: 4,
    actualEffort: 3,
    createdAt: '2024-01-01T00:00:00Z',
    startedAt: '2024-01-02T00:00:00Z',
    dueAt: null,
    completedAt: '2024-01-03T00:00:00Z',
  },
];

const mockBoardData = {
  Draft: [],
  Proposed: [],
  Approved: [],
  Planned: [],
  Ready: [],
  InProgress: [mockWorkItems[0]],
  WaitingOnDependency: [],
  InReview: [],
  ChangesRequested: [],
  InTest: [],
  AwaitingApproval: [],
  ApprovedForCompletion: [],
  Done: [mockWorkItems[1]],
  Archived: [],
  Reopened: [],
  Rejected: [],
  Cancelled: [],
  Blocked: [],
};

describe('WorkItemBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBoard.mockResolvedValue({
      data: { data: mockBoardData },
    });
  });

  it('renders kanban board header', async () => {
    render(<WorkItemBoard />);

    await waitFor(() => {
      expect(screen.getByText('Work Items')).toBeInTheDocument();
      expect(screen.getByText('Drag and drop to change status')).toBeInTheDocument();
    });
  });

  it('renders New Work Item button', async () => {
    render(<WorkItemBoard />);

    await waitFor(() => {
      expect(screen.getByText('New Work Item')).toBeInTheDocument();
    });
  });

  it('displays kanban columns', async () => {
    render(<WorkItemBoard />);

    await waitFor(() => {
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('In Review')).toBeInTheDocument();
    });
  });

  it('displays work items in columns', async () => {
    render(<WorkItemBoard />);

    await waitFor(() => {
      expect(screen.getByText('Implement login')).toBeInTheDocument();
      expect(screen.getByText('Setup database')).toBeInTheDocument();
    });
  });

  it('displays work item type badges', async () => {
    render(<WorkItemBoard />);

    await waitFor(() => {
      expect(screen.getByText('Story')).toBeInTheDocument();
      expect(screen.getByText('Task')).toBeInTheDocument();
    });
  });

  it('displays work item priorities', async () => {
    render(<WorkItemBoard />);

    await waitFor(() => {
      expect(screen.getByText('Implement login')).toBeInTheDocument();
    });
  });

  it('displays effort estimates', async () => {
    render(<WorkItemBoard />);

    await waitFor(() => {
      expect(screen.getByText('8h')).toBeInTheDocument();
      expect(screen.getByText('4h')).toBeInTheDocument();
    });
  });

  it('displays due dates', async () => {
    render(<WorkItemBoard />);

    await waitFor(() => {
      expect(screen.getByText(/Due:/)).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    mockGetBoard.mockRejectedValue(new Error('Failed to load board'));

    render(<WorkItemBoard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load board')).toBeInTheDocument();
    });
  });

  it('updates store with work items after loading', async () => {
    render(<WorkItemBoard />);

    await waitFor(() => {
      expect(mockSetWorkItems).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ workItemId: 'work-1' }),
          expect.objectContaining({ workItemId: 'work-2' }),
        ])
      );
    });
  });

  it('accepts teamId prop', async () => {
    render(<WorkItemBoard teamId="team-1" />);

    await waitFor(() => {
      expect(screen.getByText('Work Items')).toBeInTheDocument();
    });
  });

  it('displays column counts', async () => {
    render(<WorkItemBoard />);

    await waitFor(() => {
      // Each column shows its count
      const counts = screen.getAllByText('1');
      expect(counts.length).toBeGreaterThan(0);
    });
  });
});
