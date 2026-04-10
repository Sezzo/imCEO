/**
 * Team Execution Monitor Component
 *
 * Real-time monitoring of team task execution with:
 * - Progress bars for each task
 * - Live status updates
 * - Result aggregation
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import ProgressBar from 'ink-progress-bar';
import Spinner from 'ink-spinner';
import type { ExecutionPlan, TaskResult, Team, TeamEvent } from '../../services/team/types.js';
import { useTeamEvents } from './useTeamEvents.js';
import { coordinationEngine } from '../../services/team/coordination-engine.js';

interface ExecutionMonitorProps {
  team: Team;
  plan: ExecutionPlan;
  onComplete?: (results: Map<string, TaskResult>) => void;
}

interface TaskProgress {
  taskId: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  agentName?: string;
  result?: string;
}

export function ExecutionMonitor({ team, plan, onComplete }: ExecutionMonitorProps): JSX.Element {
  const [progress, setProgress] = useState<TaskProgress[]>(() =>
    plan.tasks.map((task) => ({
      taskId: task.id,
      title: task.title,
      status: 'pending',
      progress: 0,
      agentName: task.assignedTo ? team.agents.get(task.assignedTo)?.config.name : undefined,
    }))
  );

  const [summary, setSummary] = useState<{
    completed: number;
    failed: number;
    total: number;
  }>({ completed: 0, failed: 0, total: plan.tasks.length });

  const [isComplete, setIsComplete] = useState(false);
  const [finalResults, setFinalResults] = useState<Map<string, TaskResult>>(new Map());

  // Subscribe to team events
  useTeamEvents(team.config.id, (event: TeamEvent) => {
    if (event.taskId) {
      setProgress((prev) =>
        prev.map((p) => {
          if (p.taskId !== event.taskId) return p;

          switch (event.type) {
            case 'task_started':
              return { ...p, status: 'running', progress: 10 };
            case 'task_completed':
              return {
                ...p,
                status: 'completed',
                progress: 100,
                result: event.data?.result?.output,
              };
            case 'task_failed':
              return { ...p, status: 'failed', progress: 100 };
            default:
              return p;
          }
        })
      );

      // Update summary
      if (event.type === 'task_completed' || event.type === 'task_failed') {
        setProgress((current) => {
          const completed = current.filter((p) => p.status === 'completed').length;
          const failed = current.filter((p) => p.status === 'failed').length;
          setSummary({ completed, failed, total: current.length });
          return current;
        });
      }
    }

    if (event.type === 'execution_completed') {
      setIsComplete(true);
      if (event.data?.results) {
        setFinalResults(event.data.results);
        onComplete?.(event.data.results);
      }
    }
  });

  // Simulate progress updates for running tasks
  useEffect(() => {
    if (isComplete) return;

    const interval = setInterval(() => {
      setProgress((prev) =>
        prev.map((p) => {
          if (p.status === 'running' && p.progress < 90) {
            return { ...p, progress: Math.min(p.progress + 5, 90) };
          }
          return p;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isComplete]);

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      <Box marginBottom={1}>
        <Text bold>Execution Progress</Text>
        <Text> · </Text>
        <Text color="green">{summary.completed} done</Text>
        {summary.failed > 0 && (
          <>
            <Text> · </Text>
            <Text color="red">{summary.failed} failed</Text>
          </>
        )}
        <Text> · </Text>
        <Text dimColor>{summary.total} total</Text>
      </Box>

      <Box flexDirection="column">
        {progress.map((p) => (
          <TaskRow key={p.taskId} progress={p} />
        ))}
      </Box>

      {isComplete && (
        <Box marginTop={1}>
          <Text bold color="green">
            Execution Complete!
          </Text>
        </Box>
      )}
    </Box>
  );
}

function TaskRow({ progress }: { progress: TaskProgress }): JSX.Element {
  const statusColors = {
    pending: 'gray',
    running: 'blue',
    completed: 'green',
    failed: 'red',
  };

  const statusIcons = {
    pending: '○',
    running: '◐',
    completed: '✓',
    failed: '✗',
  };

  return (
    <Box marginY={1}>
      <Box width={12}>
        <Text color={statusColors[progress.status]}>
          {statusIcons[progress.status]} {progress.status === 'running' && <Spinner type="dots" />}
        </Text>
      </Box>

      <Box width={30}>
        <Text>{progress.title}</Text>
      </Box>

      <Box width={20}>{progress.agentName && <Text dimColor>→ {progress.agentName}</Text>}</Box>

      <Box width={20}>
        {progress.status === 'running' ? (
          <ProgressBar percent={progress.progress} columns={15} character="█" />
        ) : (
          <Text color={statusColors[progress.status]}>
            {progress.status === 'completed'
              ? 'Done'
              : progress.status === 'failed'
                ? 'Failed'
                : progress.status === 'pending'
                  ? 'Waiting'
                  : `${progress.progress}%`}
          </Text>
        )}
      </Box>

      {progress.result && (
        <Box marginLeft={2}>
          <Text dimColor numberOfLines={1}>
            {progress.result.slice(0, 40)}...
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Execution Summary Component
 *
 * Shows final results after execution completes
 */
interface ExecutionSummaryProps {
  team: Team;
  results: Map<string, TaskResult>;
}

export function ExecutionSummary({ team, results }: ExecutionSummaryProps): JSX.Element {
  const completed = Array.from(results.values()).filter((r) => r.status === 'completed');
  const failed = Array.from(results.values()).filter((r) => r.status === 'failed');

  const totalDuration = Array.from(results.values()).reduce((sum, r) => sum + r.duration, 0);

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      <Text bold>Execution Summary</Text>

      <Box marginY={1}>
        <Text>Team: {team.config.name}</Text>
        <Text> · </Text>
        <Text color="green">{completed.length} completed</Text>
        {failed.length > 0 && (
          <>
            <Text> · </Text>
            <Text color="red">{failed.length} failed</Text>
          </>
        )}
        <Text> · </Text>
        <Text>Duration: {(totalDuration / 1000).toFixed(1)}s</Text>
      </Box>

      {completed.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold underline>
            Completed Tasks:
          </Text>
          {completed.map((result) => (
            <Box key={result.taskId} marginY={1}>
              <Text color="green">✓</Text>
              <Text> {result.taskId.slice(0, 8)}</Text>
              <Text dimColor> by {result.agentId.slice(0, 8)}</Text>
              {result.output && <Text numberOfLines={1}>: {result.output.slice(0, 50)}...</Text>}
            </Box>
          ))}
        </Box>
      )}

      {failed.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold underline color="red">
            Failed Tasks:
          </Text>
          {failed.map((result) => (
            <Box key={result.taskId} marginY={1}>
              <Text color="red">✗</Text>
              <Text> {result.taskId.slice(0, 8)}</Text>
              {result.error && <Text color="red">: {result.error}</Text>}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
