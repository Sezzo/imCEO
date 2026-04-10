import React from 'react';
import { useAgentTeams, useCurrentTeam, useTeamTasks, Task } from '../context/AgentTeamsContext';

/**
 * TaskList Component - Displays and manages team tasks
 */

interface TaskListProps {
  onTaskSelect?: (task: Task) => void;
  selectedTaskId?: string;
}

export function TaskList({ onTaskSelect, selectedTaskId }: TaskListProps) {
  const { tasks, isLoading, claimTask, completeTask } = useAgentTeams();
  const currentTeam = useCurrentTeam();

  // Filter and sort tasks
  const pendingTasks = tasks.filter((t) => t.status === 'pending' && !t.isBlocked);
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const blockedTasks = tasks.filter(
    (t) => t.status === 'blocked' || (t.status === 'pending' && t.isBlocked)
  );
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const getStatusColor = (status: string, isBlocked: boolean) => {
    if (isBlocked || status === 'blocked') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const TaskCard: React.FC<{ task: Task; showActions?: boolean }> = ({
    task,
    showActions = true,
  }) => {
    const isSelected = selectedTaskId === task.taskId;

    return (
      <div
        onClick={() => onTaskSelect?.(task)}
        className={`
          p-3 rounded-lg border cursor-pointer transition-all
          ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
        `}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{task.subject}</h4>
            {task.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>
          <span
            className={`
            px-2 py-0.5 text-xs rounded-full border whitespace-nowrap
            ${getStatusColor(task.status, task.isBlocked)}
          `}
          >
            {task.isBlocked ? 'blocked' : task.status}
          </span>
        </div>

        {/* Blocked info */}
        {task.isBlocked && task.blockedBy.length > 0 && (
          <div className="mt-2 text-xs text-yellow-700">
            Waiting on: {task.blockedBy.length} task(s)
          </div>
        )}

        {/* Owner info */}
        {task.ownerAgentName && (
          <div className="mt-2 text-xs text-gray-600">
            Assigned to: <span className="font-medium">{task.ownerAgentName}</span>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="mt-3 flex gap-2">
            {task.canClaim && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  claimTask(task.taskId);
                }}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Claim
              </button>
            )}
            {task.status === 'in_progress' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  completeTask(task.taskId);
                }}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Complete
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!currentTeam) {
    return (
      <div className="p-8 text-center text-gray-500">
        No team selected. Create or join a team to see tasks.
      </div>
    );
  }

  if (isLoading && tasks.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-2 text-gray-500">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tasks</h2>
          <span className="text-sm text-gray-500">{tasks.length} total</span>
        </div>
      </div>

      {/* Task Lists */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* In Progress */}
        {inProgressTasks.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              In Progress ({inProgressTasks.length})
            </h3>
            <div className="space-y-2">
              {inProgressTasks.map((task) => (
                <TaskCard key={task.taskId} task={task} />
              ))}
            </div>
          </section>
        )}

        {/* Pending */}
        {pendingTasks.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Available ({pendingTasks.length})
            </h3>
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <TaskCard key={task.taskId} task={task} />
              ))}
            </div>
          </section>
        )}

        {/* Blocked */}
        {blockedTasks.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-yellow-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              Blocked ({blockedTasks.length})
            </h3>
            <div className="space-y-2">
              {blockedTasks.map((task) => (
                <TaskCard key={task.taskId} task={task} showActions={false} />
              ))}
            </div>
          </section>
        )}

        {/* Completed */}
        {completedTasks.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Completed ({completedTasks.length})
            </h3>
            <div className="space-y-2 opacity-60">
              {completedTasks.slice(0, 5).map((task) => (
                <TaskCard key={task.taskId} task={task} showActions={false} />
              ))}
              {completedTasks.length > 5 && (
                <p className="text-xs text-gray-400 text-center">
                  + {completedTasks.length - 5} more
                </p>
              )}
            </div>
          </section>
        )}

        {/* Empty State */}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p>No tasks yet.</p>
            <p className="text-sm mt-1">Create a task to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
