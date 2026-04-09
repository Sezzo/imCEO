import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionMonitor, type Session, type SessionStatus } from '../../../src/components/sessions/SessionMonitor';

const mockSessions: Session[] = [
  {
    sessionId: 'session-1',
    name: 'Sprint Planning',
    description: 'Q1 Sprint planning session',
    status: 'running',
    companyId: 'comp-123',
    teamId: 'team-1',
    workItemId: 'work-1',
    workItemTitle: 'Plan Sprint 1',
    agents: [
      {
        agentId: 'agent-1',
        agentName: 'Alice',
        role: 'Scrum Master',
        status: 'online',
        currentTask: 'Facilitating discussion',
        progress: 45,
        cost: 1.50,
        activities: [],
      },
    ],
    startedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    cost: 1.50,
    budget: 50.00,
    messageCount: 25,
    lastActivityAt: new Date().toISOString(),
    createdBy: 'user-1',
  },
  {
    sessionId: 'session-2',
    name: 'Code Review',
    description: 'Review PR #123',
    status: 'paused',
    companyId: 'comp-123',
    agents: [
      {
        agentId: 'agent-2',
        agentName: 'Bob',
        role: 'Reviewer',
        status: 'busy',
        currentTask: 'Reviewing code',
        progress: 60,
        cost: 0.75,
        activities: [],
      },
    ],
    startedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    cost: 0.75,
    budget: 10.00,
    messageCount: 12,
    lastActivityAt: new Date().toISOString(),
    createdBy: 'user-2',
  },
  {
    sessionId: 'session-3',
    name: 'Bug Triage',
    description: 'Weekly bug triage meeting',
    status: 'completed',
    companyId: 'comp-123',
    endedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    agents: [],
    startedAt: new Date(Date.now() - 90000000).toISOString(),
    cost: 2.00,
    budget: 20.00,
    messageCount: 50,
    lastActivityAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: 'user-1',
  },
  {
    sessionId: 'session-4',
    name: 'Failed Deployment',
    description: 'Deployment troubleshooting',
    status: 'error',
    companyId: 'comp-123',
    agents: [
      {
        agentId: 'agent-3',
        agentName: 'Charlie',
        role: 'DevOps',
        status: 'error',
        progress: 0,
        cost: 0.25,
        activities: [],
      },
    ],
    startedAt: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
    cost: 0.25,
    budget: 100.00,
    messageCount: 8,
    lastActivityAt: new Date().toISOString(),
    createdBy: 'user-3',
  },
];

describe('SessionMonitor', () => {
  const mockHandlers = {
    onViewSession: vi.fn(),
    onPauseSession: vi.fn(),
    onResumeSession: vi.fn(),
    onTerminateSession: vi.fn(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders session monitor header', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Session Monitor')).toBeInTheDocument();
    expect(screen.getByText(/1 running/)).toBeInTheDocument();
    expect(screen.getByText(/1 errors/)).toBeInTheDocument();
    expect(screen.getByText(/4 total/)).toBeInTheDocument();
  });

  it('displays error alert when there are errors', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('1 sessions need attention')).toBeInTheDocument();
  });

  it('renders all sessions in list', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('Bug Triage')).toBeInTheDocument();
    expect(screen.getByText('Failed Deployment')).toBeInTheDocument();
  });

  it('displays session status indicators', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('displays session details', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Plan Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('Review PR #123')).toBeInTheDocument();
  });

  it('displays agent counts', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('1 agents')).toBeInTheDocument();
  });

  it('displays message counts', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('25 msgs')).toBeInTheDocument();
    expect(screen.getByText('12 msgs')).toBeInTheDocument();
  });

  it('displays session costs', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('$1.50')).toBeInTheDocument();
    expect(screen.getByText('$0.75')).toBeInTheDocument();
  });

  it('displays relative timestamps', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    // Should show relative time (e.g., "about 1 hour ago")
    const timestamps = screen.getAllByText(/ago/);
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it('filters sessions by search term', async () => {
    const user = userEvent.setup();
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search sessions...');
    await user.type(searchInput, 'Sprint');

    expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    expect(screen.queryByText('Code Review')).not.toBeInTheDocument();
  });

  it('filters sessions by status', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    const statusSelect = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusSelect, { target: { value: 'running' } });

    expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
    expect(screen.queryByText('Code Review')).not.toBeInTheDocument();
    expect(screen.queryByText('Bug Triage')).not.toBeInTheDocument();
  });

  it('shows session detail when session clicked', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    const sessionRow = screen.getByText('Sprint Planning').closest('[class*="cursor-pointer"]');
    if (sessionRow) {
      fireEvent.click(sessionRow);
    }

    // Detail view should appear
    expect(screen.getByText('Pause')).toBeInTheDocument();
    expect(screen.getByText('Full View')).toBeInTheDocument();
  });

  it('calls onPauseSession when pause button clicked', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    // Select running session
    const sessionRow = screen.getByText('Sprint Planning').closest('[class*="cursor-pointer"]');
    if (sessionRow) {
      fireEvent.click(sessionRow);
    }

    const pauseButton = screen.getByText('Pause');
    fireEvent.click(pauseButton);

    expect(mockHandlers.onPauseSession).toHaveBeenCalledWith('session-1');
  });

  it('calls onResumeSession when resume button clicked', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    // Select paused session
    const sessionRow = screen.getByText('Code Review').closest('[class*="cursor-pointer"]');
    if (sessionRow) {
      fireEvent.click(sessionRow);
    }

    const resumeButton = screen.getByText('Resume');
    fireEvent.click(resumeButton);

    expect(mockHandlers.onResumeSession).toHaveBeenCalledWith('session-2');
  });

  it('calls onTerminateSession when terminate button clicked', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    // Select running session
    const sessionRow = screen.getByText('Sprint Planning').closest('[class*="cursor-pointer"]');
    if (sessionRow) {
      fireEvent.click(sessionRow);
    }

    const terminateButton = screen.getByText('Terminate');
    fireEvent.click(terminateButton);

    expect(mockHandlers.onTerminateSession).toHaveBeenCalledWith('session-1');
  });

  it('calls onViewSession when full view button clicked', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    // Select a session
    const sessionRow = screen.getByText('Sprint Planning').closest('[class*="cursor-pointer"]');
    if (sessionRow) {
      fireEvent.click(sessionRow);
    }

    const fullViewButton = screen.getByText('Full View');
    fireEvent.click(fullViewButton);

    expect(mockHandlers.onViewSession).toHaveBeenCalledWith('session-1');
  });

  it('calls onRefresh when refresh button clicked', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    const refreshButton = screen.getByRole('button', { name: '' }).parentElement?.querySelector('button:last-child');
    if (refreshButton) {
      fireEvent.click(refreshButton);
    }

    expect(mockHandlers.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('toggles auto-refresh', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    const autoRefreshButton = screen.getByText('Auto-refresh');
    fireEvent.click(autoRefreshButton);

    expect(autoRefreshButton).toHaveClass('bg-violet-100');

    // Advance timers to trigger refresh
    vi.advanceTimersByTime(5000);
    expect(mockHandlers.onRefresh).toHaveBeenCalled();
  });

  it('displays empty state when no sessions', () => {
    render(
      <SessionMonitor
        sessions={[]}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('No sessions found')).toBeInTheDocument();
  });

  it('displays agent information in detail view', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    // Select running session with agents
    const sessionRow = screen.getByText('Sprint Planning').closest('[class*="cursor-pointer"]');
    if (sessionRow) {
      fireEvent.click(sessionRow);
    }

    expect(screen.getByText('Active Agents')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Scrum Master')).toBeInTheDocument();
  });

  it('displays session stats in detail view', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    // Select a session
    const sessionRow = screen.getByText('Sprint Planning').closest('[class*="cursor-pointer"]');
    if (sessionRow) {
      fireEvent.click(sessionRow);
    }

    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('closes detail view when close button clicked', () => {
    render(
      <SessionMonitor
        sessions={mockSessions}
        {...mockHandlers}
      />
    );

    // Select a session
    const sessionRow = screen.getByText('Sprint Planning').closest('[class*="cursor-pointer"]');
    if (sessionRow) {
      fireEvent.click(sessionRow);
    }

    // Close detail view - find by session name in detail header
    const detailCloseButton = screen.getByText('Sprint Planning').closest('[class*="flex items-center"]')?.querySelector('button');
    if (detailCloseButton) {
      fireEvent.click(detailCloseButton);
    }

    // Detail view should close
    expect(screen.queryByText('Pause')).not.toBeInTheDocument();
  });
});
