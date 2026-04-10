/**
 * Team Status Panel Component
 *
 * Displays real-time status of an agent team:
 * - Agent list with status indicators
 * - Active tasks visualization
 * - Message activity
 * - Execution progress
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type {
  Agent,
  AgentStatus,
  TaskStatus,
  Team,
  TeamStatus,
} from '../../services/team/types.js';
import { teamManager } from '../../services/team/team-manager.js';
import { useTeamEvents } from './useTeamEvents.js';

interface TeamStatusPanelProps {
  teamId: string;
  compact?: boolean;
  showMessages?: boolean;
}

interface DisplayAgent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask?: string;
  taskCount: number;
}

export function TeamStatusPanel({
  teamId,
  compact = false,
  showMessages = false,
}: TeamStatusPanelProps): JSX.Element {
  const [team, setTeam] = useState<Team | undefined>(teamManager.getTeam(teamId));
  const [agents, setAgents] = useState<DisplayAgent[]>([]);
  const [teamStatus, setTeamStatus] = useState<TeamStatus>('initializing');

  // Subscribe to team events
  useTeamEvents(teamId, (event) => {
    // Refresh team data on relevant events
    if (
      event.type === 'agent_status_changed' ||
      event.type === 'task_started' ||
      event.type === 'task_completed' ||
      event.type === 'execution_started' ||
      event.type === 'execution_completed'
    ) {
      const updatedTeam = teamManager.getTeam(teamId);
      setTeam(updatedTeam);
      setTeamStatus(updatedTeam?.status || 'initializing');
      updateAgents(updatedTeam);
    }
  });

  // Initial load
  useEffect(() => {
    const currentTeam = teamManager.getTeam(teamId);
    setTeam(currentTeam);
    setTeamStatus(currentTeam?.status || 'initializing');
    updateAgents(currentTeam);
  }, [teamId]);

  function updateAgents(teamData: Team | undefined) {
    if (!teamData) {
      setAgents([]);
      return;
    }

    const displayAgents: DisplayAgent[] = Array.from(teamData.agents.values()).map(
      (agent: Agent) => ({
        id: agent.config.id,
        name: agent.config.name,
        role: agent.config.role,
        status: agent.status,
        currentTask: agent.currentTask?.title,
        taskCount: agent.taskHistory.length,
      })
    );

    setAgents(displayAgents);
  }

  if (!team) {
    return (
      <Box>
        <Text color="red">Team not found: {teamId}</Text>
      </Box>
    );
  }

  const activeAgents = agents.filter((a) => a.status === 'running').length;
  const idleAgents = agents.filter((a) => a.status === 'idle').length;
  const totalTasks = agents.reduce((sum, a) => sum + a.taskCount, 0);

  if (compact) {
    return (
      <Box flexDirection="column">
        <Text bold>{team.config.name}</Text>
        <Text dimColor>
          {agents.length} agents · {activeAgents} active · {idleAgents} idle · {totalTasks} tasks
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {team.config.name}
        </Text>
        <Text> · </Text>
        <TeamStatusBadge status={teamStatus} />
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          {agents.length} agents · {activeAgents} active · {idleAgents} idle · {totalTasks} tasks
          completed
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text bold underline>
          Agents:
        </Text>
        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}
      </Box>

      {showMessages && (
        <Box marginTop={1} flexDirection="column">
          <Text bold underline>
            Recent Activity:
          </Text>
          <ActivityLog team={team} />
        </Box>
      )}
    </Box>
  );
}

function TeamStatusBadge({ status }: { status: TeamStatus }): JSX.Element {
  const colors: Record<TeamStatus, string> = {
    initializing: 'yellow',
    ready: 'green',
    running: 'blue',
    paused: 'yellow',
    completed: 'green',
    failed: 'red',
    disbanded: 'gray',
  };

  return <Text color={colors[status]}>{status}</Text>;
}

function AgentRow({ agent }: { agent: DisplayAgent }): JSX.Element {
  const statusColors: Record<AgentStatus, string> = {
    idle: 'gray',
    assigned: 'yellow',
    running: 'blue',
    waiting: 'yellow',
    blocked: 'red',
    completed: 'green',
    failed: 'red',
    killed: 'red',
  };

  const statusIcons: Record<AgentStatus, string> = {
    idle: '○',
    assigned: '◐',
    running: '◑',
    waiting: '◒',
    blocked: '✖',
    completed: '✓',
    failed: '✗',
    killed: '⚠',
  };

  return (
    <Box>
      <Text color={statusColors[agent.status]}>{statusIcons[agent.status]} </Text>
      <Text>{agent.name}</Text>
      <Text dimColor> ({agent.role})</Text>
      {agent.currentTask && <Text color="blue"> · {agent.currentTask}</Text>}
      {agent.status === 'running' && (
        <Text>
          {' '}
          <Spinner type="dots" />
        </Text>
      )}
    </Box>
  );
}

function ActivityLog({ team }: { team: Team }): JSX.Element {
  const [activities, setActivities] = useState<string[]>([]);

  useTeamEvents(team.config.id, (event) => {
    const timestamp = event.timestamp.toLocaleTimeString();
    let message = '';

    switch (event.type) {
      case 'task_started':
        message = `${timestamp} · Task started${event.taskId ? `: ${event.taskId}` : ''}`;
        break;
      case 'task_completed':
        message = `${timestamp} · Task completed${event.taskId ? `: ${event.taskId}` : ''}`;
        break;
      case 'task_failed':
        message = `${timestamp} · Task failed${event.taskId ? `: ${event.taskId}` : ''}`;
        break;
      case 'agent_status_changed':
        message = `${timestamp} · Agent ${event.agentId} status changed`;
        break;
      case 'message_sent':
        message = `${timestamp} · Message sent`;
        break;
      default:
        message = `${timestamp} · ${event.type}`;
    }

    setActivities((prev) => [...prev.slice(-9), message]);
  });

  if (activities.length === 0) {
    return <Text dimColor>No recent activity</Text>;
  }

  return (
    <Box flexDirection="column">
      {activities.map((activity, i) => (
        <Text key={i} dimColor>
          {activity}
        </Text>
      ))}
    </Box>
  );
}
