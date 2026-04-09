import { useState, useEffect } from 'react';
import { Plus, MoreHorizontal, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useCompanyStore } from '../../store/companyStore';
import { workItemApi, type WorkItem, type WorkItemState } from '../../api/client';

const COLUMNS: { id: WorkItemState; label: string; color: string }[] = [
  { id: 'Draft', label: 'Draft', color: 'bg-gray-100' },
  { id: 'Proposed', label: 'Proposed', color: 'bg-gray-100' },
  { id: 'Approved', label: 'Approved', color: 'bg-blue-50' },
  { id: 'Planned', label: 'Planned', color: 'bg-blue-50' },
  { id: 'Ready', label: 'Ready', color: 'bg-green-50' },
  { id: 'InProgress', label: 'In Progress', color: 'bg-yellow-50' },
  { id: 'InReview', label: 'In Review', color: 'bg-purple-50' },
  { id: 'ChangesRequested', label: 'Changes', color: 'bg-orange-50' },
  { id: 'InTest', label: 'Testing', color: 'bg-cyan-50' },
  { id: 'AwaitingApproval', label: 'Approval', color: 'bg-indigo-50' },
  { id: 'ApprovedForCompletion', label: 'Ready to Complete', color: 'bg-teal-50' },
  { id: 'Done', label: 'Done', color: 'bg-green-100' },
];

interface WorkItemCardProps {
  workItem: WorkItem;
  onClick: () => void;
}

function WorkItemCard({ workItem, onClick }: WorkItemCardProps) {
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Vision: 'bg-red-100 text-red-700',
      Goal: 'bg-orange-100 text-orange-700',
      Initiative: 'bg-amber-100 text-amber-700',
      Program: 'bg-yellow-100 text-yellow-700',
      Epic: 'bg-lime-100 text-lime-700',
      Story: 'bg-green-100 text-green-700',
      Task: 'bg-emerald-100 text-emerald-700',
      Bug: 'bg-rose-100 text-rose-700',
      Spike: 'bg-cyan-100 text-cyan-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityIcon = (priority?: string | null) => {
    if (!priority) return null;
    switch (priority) {
      case 'critical':
      case 'high':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeColor(workItem.type)}`}>
          {workItem.type}
        </span>
        {getPriorityIcon(workItem.priority)}
      </div>

      <h4 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
        {workItem.title}
      </h4>

      {workItem.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">
          {workItem.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>ID: {workItem.workItemId.slice(0, 6)}</span>
        {workItem.estimatedEffort && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {workItem.estimatedEffort}h
          </span>
        )}
      </div>

      {workItem.dueAt && (
        <div className="mt-2 text-xs text-orange-600">
          Due: {new Date(workItem.dueAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

interface WorkItemBoardProps {
  teamId?: string;
}

export function WorkItemBoard({ teamId }: WorkItemBoardProps) {
  const [board, setBoard] = useState<Record<WorkItemState, WorkItem[]>>({
    Draft: [],
    Proposed: [],
    Approved: [],
    Planned: [],
    Ready: [],
    InProgress: [],
    WaitingOnDependency: [],
    InReview: [],
    ChangesRequested: [],
    InTest: [],
    AwaitingApproval: [],
    ApprovedForCompletion: [],
    Done: [],
    Archived: [],
    Reopened: [],
    Rejected: [],
    Cancelled: [],
    Blocked: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { workItems, setWorkItems } = useCompanyStore();

  // Load board data
  useEffect(() => {
    const loadBoard = async () => {
      setIsLoading(true);
      try {
        const response = await workItemApi.getBoard();
        setBoard(response.data.data);

        // Also update the store with all work items
        const allItems = Object.values(response.data.data).flat();
        setWorkItems(allItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load board');
      } finally {
        setIsLoading(false);
      }
    };

    loadBoard();
  }, [setWorkItems, teamId]);

  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, workItem: WorkItem) => {
    e.dataTransfer.setData('workItemId', workItem.workItemId);
    e.dataTransfer.setData('fromState', workItem.state);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, toState: WorkItemState) => {
    e.preventDefault();
    const workItemId = e.dataTransfer.getData('workItemId');
    const fromState = e.dataTransfer.getData('fromState') as WorkItemState;

    if (!workItemId || fromState === toState) {
      setIsDragging(false);
      return;
    }

    try {
      await workItemApi.transition(workItemId, toState, 'Drag and drop');

      // Update local state
      setBoard((prev) => {
        const newBoard = { ...prev };
        const item = newBoard[fromState].find((i) => i.workItemId === workItemId);
        if (item) {
          newBoard[fromState] = newBoard[fromState].filter((i) => i.workItemId !== workItemId);
          newBoard[toState] = [...newBoard[toState], { ...item, state: toState }];
        }
        return newBoard;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transition work item');
    } finally {
      setIsDragging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Work Items</h2>
          <p className="text-sm text-gray-500">Drag and drop to change status</p>
        </div>
        <button
          onClick={() => {/* TODO: Open create modal */}}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          New Work Item
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              className={`w-72 flex flex-col rounded-lg ${column.color}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-3 border-b border-gray-200/50">
                <h3 className="font-medium text-gray-700">{column.label}</h3>
                <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
                  {board[column.id]?.length || 0}
                </span>
              </div>

              {/* Column Content */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {board[column.id]?.map((workItem) => (
                  <div
                    key={workItem.workItemId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, workItem)}
                    onDragEnd={handleDragEnd}
                  >
                    <WorkItemCard
                      workItem={workItem}
                      onClick={() => setSelectedWorkItem(workItem)}
                    />
                  </div>
                ))}

                {board[column.id]?.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No items
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Work Item Detail (Simple Modal) */}
      {selectedWorkItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedWorkItem(null)}
        >
          <div
            className="bg-white rounded-lg p-6 w-96 max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">{selectedWorkItem.title}</h3>
              <button
                onClick={() => setSelectedWorkItem(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <MoreHorizontal className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Type:</span>{' '}
                <span className="font-medium">{selectedWorkItem.type}</span>
              </div>
              <div>
                <span className="text-gray-500">State:</span>{' '}
                <span className="font-medium">{selectedWorkItem.state}</span>
              </div>
              <div>
                <span className="text-gray-500">Priority:</span>{' '}
                <span className="font-medium">{selectedWorkItem.priority || 'None'}</span>
              </div>
              {selectedWorkItem.description && (
                <div>
                  <span className="text-gray-500">Description:</span>
                  <p className="mt-1 text-gray-700">{selectedWorkItem.description}</p>
                </div>
              )}
              {selectedWorkItem.estimatedEffort && (
                <div>
                  <span className="text-gray-500">Estimated Effort:</span>{' '}
                  <span className="font-medium">{selectedWorkItem.estimatedEffort} hours</span>
                </div>
              )}
              {selectedWorkItem.dueAt && (
                <div>
                  <span className="text-gray-500">Due Date:</span>{' '}
                  <span className="font-medium">{new Date(selectedWorkItem.dueAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setSelectedWorkItem(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Close
              </button>
              <button
                onClick={() => {/* TODO: Open edit modal */}}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
