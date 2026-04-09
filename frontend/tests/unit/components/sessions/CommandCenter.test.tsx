import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandCenter, type SystemStatus, type CommandCenterProps } from '@/components/sessions/CommandCenter';

const mockMetrics = [
  { name: 'API Latency', value: 45, unit: 'ms', change: -5, status: 'good' as const },
  { name: 'Error Rate', value: 0.5, unit: '%', change: 0.1, status: 'warning' as const },
  { name: 'Throughput', value: 1200, unit: 'req/s', change: 10, status: 'good' as const },
  { name: 'CPU Usage', value: 65, unit: '%', change: 5, status: 'good' as const },
];

const mockQueues = [
  {
    queueId: 'queue-1',
    name: 'High Priority',
    pending: 5,
    processing: 2,
    completed: 150,
    failed: 3,
    avgWaitTime: 500,
    status: 'normal' as const,
  },
  {
    queueId: 'queue-2',
    name: 'Standard',
    pending: 25,
    processing: 8,
    completed: 500,
    failed: 10,
    avgWaitTime: 2000,
    status: 'high' as const,
  },
];

const mockOperations = [
  {
    operationId: 'op-1',
    type: 'deployment',
    description: 'Deploying version 2.0',
    progress: 75,
    startedAt: new Date(Date.now() - 1800000).toISOString(),
    estimatedEnd: new Date(Date.now() + 600000).toISOString(),
    agentCount: 3,
  },
];

const mockAlerts = [
  {
    alertId: 'alert-1',
    severity: 'critical' as const,
    title: 'High Error Rate',
    message: 'Error rate exceeded 5%',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    acknowledged: false,
  },
  {
    alertId: 'alert-2',
    severity: 'warning' as const,
    title: 'Queue Backlog',
    message: 'Queue has more than 20 pending items',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    acknowledged: false,
  },
  {
    alertId: 'alert-3',
    severity: 'info' as const,
    title: 'System Update',
    message: 'System update completed successfully',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    acknowledged: true,
  },
];

describe('CommandCenter', () => {
  const mockHandlers = {
    onPauseSystem: vi.fn(),
    onResumeSystem: vi.fn(),
    onEmergencyStop: vi.fn(),
    onAcknowledgeAlert: vi.fn(),
    onViewQueue: vi.fn(),
    onViewOperation: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders command center header', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Command Center')).toBeInTheDocument();
    expect(screen.getByText('Operational dashboard and control')).toBeInTheDocument();
  });

  it('renders system status badge', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('System Healthy')).toBeInTheDocument();
  });

  it('renders different status badges based on system status', () => {
    const { rerender } = render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('System Healthy')).toBeInTheDocument();

    rerender(
      <CommandCenter
        systemStatus="degraded"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Performance Degraded')).toBeInTheDocument();

    rerender(
      <CommandCenter
        systemStatus="critical"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Critical Issues')).toBeInTheDocument();

    rerender(
      <CommandCenter
        systemStatus="maintenance"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Maintenance Mode')).toBeInTheDocument();
  });

  it('renders control buttons', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Pause')).toBeInTheDocument();
    expect(screen.getByText('Resume')).toBeInTheDocument();
    expect(screen.getByText('Emergency Stop')).toBeInTheDocument();
  });

  it('calls onPauseSystem when pause button clicked', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const pauseButton = screen.getByText('Pause');
    fireEvent.click(pauseButton);

    expect(mockHandlers.onPauseSystem).toHaveBeenCalledTimes(1);
  });

  it('calls onResumeSystem when resume button clicked', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const resumeButton = screen.getByText('Resume');
    fireEvent.click(resumeButton);

    expect(mockHandlers.onResumeSystem).toHaveBeenCalledTimes(1);
  });

  it('calls onEmergencyStop when emergency stop button clicked', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const stopButton = screen.getByText('Emergency Stop');
    fireEvent.click(stopButton);

    expect(mockHandlers.onEmergencyStop).toHaveBeenCalledTimes(1);
  });

  it('renders quick stats', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument(); // 5 + 25
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument(); // 2 + 8
    expect(screen.getByText('Active Operations')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Unacknowledged')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 unacknowledged alerts
    expect(screen.getByText('System Health')).toBeInTheDocument();
  });

  it('renders all tabs', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Queues')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
  });

  it('displays critical alert count on alerts tab', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    // Should show "2" badge on alerts tab (2 unacknowledged critical/warning)
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('switches between tabs', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    // Initially on Overview tab
    expect(screen.getByText('System Metrics')).toBeInTheDocument();

    // Click Operations tab
    const operationsTab = screen.getByText('Operations');
    fireEvent.click(operationsTab);

    expect(screen.getByText('Active Operations')).toBeInTheDocument();

    // Click Queues tab
    const queuesTab = screen.getByText('Queues');
    fireEvent.click(queuesTab);

    expect(screen.getByText('Task Queues')).toBeInTheDocument();

    // Click Alerts tab
    const alertsTab = screen.getByText('Alerts');
    fireEvent.click(alertsTab);

    expect(screen.getByText('System Alerts')).toBeInTheDocument();
  });

  it('displays metrics in overview tab', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('API Latency')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('Error Rate')).toBeInTheDocument();
    expect(screen.getByText('0.5')).toBeInTheDocument();
  });

  it('displays recent alerts in overview tab', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Recent Alerts')).toBeInTheDocument();
    expect(screen.getByText('High Error Rate')).toBeInTheDocument();
    expect(screen.getByText('Queue Backlog')).toBeInTheDocument();
  });

  it('calls onAcknowledgeAlert when acknowledge button clicked', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const acknowledgeButtons = screen.getAllByText('Ack');
    fireEvent.click(acknowledgeButtons[0]);

    expect(mockHandlers.onAcknowledgeAlert).toHaveBeenCalledWith('alert-1');
  });

  it('displays operations in operations tab', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const operationsTab = screen.getByText('Operations');
    fireEvent.click(operationsTab);

    expect(screen.getByText('Deploying version 2.0')).toBeInTheDocument();
    expect(screen.getByText('ID: op-1')).toBeInTheDocument();
    expect(screen.getByText('deployment')).toBeInTheDocument();
    expect(screen.getByText('3 agents')).toBeInTheDocument();
  });

  it('calls onViewOperation when operation clicked', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const operationsTab = screen.getByText('Operations');
    fireEvent.click(operationsTab);

    const operationCard = screen.getByText('Deploying version 2.0').closest('[class*="cursor-pointer"]');
    if (operationCard) {
      fireEvent.click(operationCard);
    }

    expect(mockHandlers.onViewOperation).toHaveBeenCalledWith('op-1');
  });

  it('displays queues in queues tab', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const queuesTab = screen.getByText('Queues');
    fireEvent.click(queuesTab);

    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('normal')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('displays queue statistics', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const queuesTab = screen.getByText('Queues');
    fireEvent.click(queuesTab);

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('calls onViewQueue when queue clicked', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const queuesTab = screen.getByText('Queues');
    fireEvent.click(queuesTab);

    const queueCard = screen.getByText('High Priority').closest('[class*="cursor-pointer"]');
    if (queueCard) {
      fireEvent.click(queueCard);
    }

    expect(mockHandlers.onViewQueue).toHaveBeenCalledWith('queue-1');
  });

  it('displays all alerts in alerts tab with filtering', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const alertsTab = screen.getByText('Alerts');
    fireEvent.click(alertsTab);

    expect(screen.getByText('System Alerts')).toBeInTheDocument();
    expect(screen.getByText('High Error Rate')).toBeInTheDocument();
    expect(screen.getByText('Queue Backlog')).toBeInTheDocument();
    expect(screen.getByText('System Update')).toBeInTheDocument();
  });

  it('filters alerts by severity', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const alertsTab = screen.getByText('Alerts');
    fireEvent.click(alertsTab);

    const severitySelect = screen.getByDisplayValue('All Severities');
    fireEvent.change(severitySelect, { target: { value: 'critical' } });

    expect(screen.getByText('High Error Rate')).toBeInTheDocument();
    expect(screen.queryByText('Queue Backlog')).not.toBeInTheDocument();
    expect(screen.queryByText('System Update')).not.toBeInTheDocument();
  });

  it('displays acknowledged alerts with reduced opacity', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={mockOperations}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const alertsTab = screen.getByText('Alerts');
    fireEvent.click(alertsTab);

    // System Update alert is acknowledged
    const acknowledgedAlert = screen.getByText('System Update').closest('[class*="opacity-50"]');
    expect(acknowledgedAlert).toBeInTheDocument();
  });

  it('displays empty operations message', () => {
    render(
      <CommandCenter
        systemStatus="healthy"
        metrics={mockMetrics}
        queues={mockQueues}
        activeOperations={[]}
        alerts={mockAlerts}
        {...mockHandlers}
      />
    );

    const operationsTab = screen.getByText('Operations');
    fireEvent.click(operationsTab);

    expect(screen.getByText('No active operations')).toBeInTheDocument();
  });
});
