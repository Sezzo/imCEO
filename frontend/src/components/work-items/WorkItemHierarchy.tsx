import { useState, useMemo } from 'react';
import {
  TreePine,
  ChevronRight,
  ChevronDown,
  Plus,
  Filter,
  Search,
  MoreHorizontal,
  Edit2,
  Trash2,
  Eye,
  Target,
  Rocket,
  FolderKanban,
  Layers,
  BookOpen,
  CheckSquare,
  Bug,
  Zap,
  ArrowRightLeft,
  GitBranch,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { WorkItem, WorkItemType } from '../../api/client';

interface WorkItemHierarchyProps {
  workItems: WorkItem[];
  onSelectWorkItem: (workItem: WorkItem) => void;
  onCreateWorkItem: (parentId?: string, type?: WorkItemType) => void;
  onEditWorkItem: (workItem: WorkItem) => void;
  onDeleteWorkItem: (workItemId: string) => void;
  onMoveWorkItem?: (workItemId: string, newParentId: string | null) => void;
}

const TYPE_CONFIG: Record<WorkItemType, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  Vision: { icon: <Target className="w-4 h-4" />, color: 'text-red-700', bg: 'bg-red-50', label: 'Vision' },
  Goal: { icon: <Target className="w-4 h-4" />, color: 'text-orange-700', bg: 'bg-orange-50', label: 'Goal' },
  Initiative: { icon: <Rocket className="w-4 h-4" />, color: 'text-amber-700', bg: 'bg-amber-50', label: 'Initiative' },
  Program: { icon: <FolderKanban className="w-4 h-4" />, color: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Program' },
  Workstream: { icon: <Layers className="w-4 h-4" />, color: 'text-lime-700', bg: 'bg-lime-50', label: 'Workstream' },
  Epic: { icon: <BookOpen className="w-4 h-4" />, color: 'text-green-700', bg: 'bg-green-50', label: 'Epic' },
  Story: { icon: <CheckSquare className="w-4 h-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Story' },
  Task: { icon: <CheckSquare className="w-3 h-3" />, color: 'text-teal-700', bg: 'bg-teal-50', label: 'Task' },
  Subtask: { icon: <CheckSquare className="w-3 h-3" />, color: 'text-cyan-700', bg: 'bg-cyan-50', label: 'Subtask' },
  Bug: { icon: <Bug className="w-4 h-4" />, color: 'text-rose-700', bg: 'bg-rose-50', label: 'Bug' },
  Spike: { icon: <Zap className="w-4 h-4" />, color: 'text-blue-700', bg: 'bg-blue-50', label: 'Spike' },
  ReviewTask: { icon: <Eye className="w-4 h-4" />, color: 'text-indigo-700', bg: 'bg-indigo-50', label: 'Review' },
  TestTask: { icon: <CheckSquare className="w-4 h-4" />, color: 'text-violet-700', bg: 'bg-violet-50', label: 'Test' },
  ReleaseTask: { icon: <Rocket className="w-4 h-4" />, color: 'text-purple-700', bg: 'bg-purple-50', label: 'Release' },
};

const HIERARCHY_ORDER: WorkItemType[] = [
  'Vision', 'Goal', 'Initiative', 'Program', 'Workstream', 'Epic', 'Story', 'Task', 'Subtask', 'Bug', 'Spike', 'ReviewTask', 'TestTask', 'ReleaseTask'
];

interface TreeNode {
  workItem: WorkItem;
  children: TreeNode[];
  depth: number;
}

function buildTree(workItems: WorkItem[]): TreeNode[] {
  const itemMap = new Map<string, WorkItem>();
  workItems.forEach(item => itemMap.set(item.workItemId, item));

  const childrenMap = new Map<string, string[]>();
  workItems.forEach(item => {
    if (item.parentWorkItemId) {
      const siblings = childrenMap.get(item.parentWorkItemId) || [];
      siblings.push(item.workItemId);
      childrenMap.set(item.parentWorkItemId, siblings);
    }
  });

  const rootIds = workItems
    .filter(item => !item.parentWorkItemId)
    .map(item => item.workItemId)
    .sort((a, b) => {
      const itemA = itemMap.get(a)!;
      const itemB = itemMap.get(b)!;
      return HIERARCHY_ORDER.indexOf(itemA.type) - HIERARCHY_ORDER.indexOf(itemB.type);
    });

  function buildNode(workItemId: string, depth: number): TreeNode {
    const workItem = itemMap.get(workItemId)!;
    const childIds = childrenMap.get(workItemId) || [];
    const children = childIds
      .map(id => buildNode(id, depth + 1))
      .sort((a, b) => HIERARCHY_ORDER.indexOf(a.workItem.type) - HIERARCHY_ORDER.indexOf(b.workItem.type));

    return { workItem, children, depth };
  }

  return rootIds.map(id => buildNode(id, 0));
}

function TreeNodeRow({
  node,
  isExpanded,
  onToggle,
  onSelect,
  onCreateChild,
  onEdit,
  onDelete,
  selectedId,
}: {
  node: TreeNode;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onCreateChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
  selectedId: string | null;
}) {
  const { workItem, children, depth } = node;
  const typeConfig = TYPE_CONFIG[workItem.type];
  const hasChildren = children.length > 0;
  const isSelected = selectedId === workItem.workItemId;

  return (
    <div className="select-none">
      <div
        className={clsx(
          'flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-colors group',
          isSelected
            ? 'bg-purple-100 border border-purple-300'
            : 'hover:bg-gray-50 border border-transparent'
        )}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={onSelect}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={clsx(
            'p-0.5 rounded hover:bg-gray-200 transition-colors',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {/* Type Icon */}
        <div className={clsx('p-1 rounded', typeConfig.bg, typeConfig.color)}>
          {typeConfig.icon}
        </div>

        {/* Title and Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{workItem.title}</span>
            <span className={clsx('text-xs px-1.5 py-0.5 rounded', typeConfig.bg, typeConfig.color)}>
              {typeConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>ID: {workItem.workItemId.slice(0, 6)}</span>
            <span className={clsx(
              'px-1.5 py-0.5 rounded',
              workItem.state === 'Done' ? 'bg-green-100 text-green-700' :
              workItem.state === 'InProgress' ? 'bg-blue-100 text-blue-700' :
              workItem.state === 'Blocked' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            )}>
              {workItem.state}
            </span>
            {workItem.priority && (
              <span className={clsx(
                'px-1.5 py-0.5 rounded',
                workItem.priority === 'critical' ? 'bg-red-100 text-red-700' :
                workItem.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                workItem.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              )}>
                {workItem.priority}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild();
            }}
            className="p-1.5 hover:bg-purple-100 text-purple-600 rounded"
            title="Add child"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 hover:bg-gray-200 text-gray-600 rounded"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 hover:bg-red-100 text-red-600 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="mt-1">
          {children.map((child) => (
            <WorkItemTreeNode
              key={child.workItem.workItemId}
              node={child}
              selectedId={selectedId}
              onSelectWorkItem={onSelect}
              onCreateWorkItem={onCreateChild}
              onEditWorkItem={onEdit}
              onDeleteWorkItem={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkItemTreeNode({
  node,
  selectedId,
  onSelectWorkItem,
  onCreateWorkItem,
  onEditWorkItem,
  onDeleteWorkItem,
}: {
  node: TreeNode;
  selectedId: string | null;
  onSelectWorkItem: (item: WorkItem) => void;
  onCreateWorkItem: (parentId?: string, type?: WorkItemType) => void;
  onEditWorkItem: (item: WorkItem) => void;
  onDeleteWorkItem: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <TreeNodeRow
      node={node}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      onSelect={() => onSelectWorkItem(node.workItem)}
      onCreateChild={() => onCreateWorkItem(node.workItem.workItemId)}
      onEdit={() => onEditWorkItem(node.workItem)}
      onDelete={() => onDeleteWorkItem(node.workItem.workItemId)}
      selectedId={selectedId}
    />
  );
}

export function WorkItemHierarchy({
  workItems,
  onSelectWorkItem,
  onCreateWorkItem,
  onEditWorkItem,
  onDeleteWorkItem,
  onMoveWorkItem,
}: WorkItemHierarchyProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<WorkItemType | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filteredWorkItems = useMemo(() => {
    return workItems.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === 'all' || item.type === filterType;

      return matchesSearch && matchesType;
    });
  }, [workItems, searchTerm, filterType]);

  const tree = useMemo(() => buildTree(filteredWorkItems), [filteredWorkItems]);

  const handleSelect = (item: WorkItem) => {
    setSelectedId(item.workItemId);
    onSelectWorkItem(item);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TreePine className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Work Item Hierarchy</h2>
              <p className="text-sm text-gray-500">
                {workItems.length} items • {tree.length} top-level
              </p>
            </div>
          </div>
          <button
            onClick={() => onCreateWorkItem()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Work Item
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search work items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors',
              showFilters
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-300 hover:bg-gray-50'
            )}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg flex flex-wrap gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as WorkItemType | 'all')}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              {HIERARCHY_ORDER.map((type) => (
                <option key={type} value={type}>{TYPE_CONFIG[type].label}</option>
              ))}
            </select>
            <button
              onClick={() => {
                setFilterType('all');
                setSearchTerm('');
              }}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-4">
        {tree.length === 0 ? (
          <div className="text-center py-12">
            <TreePine className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No work items found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {workItems.length === 0
                ? 'Create your first work item to start building your hierarchy'
                : 'Try adjusting your search or filters'}
            </p>
            {workItems.length === 0 && (
              <button
                onClick={() => onCreateWorkItem()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Create Work Item
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {tree.map((node) => (
              <WorkItemTreeNode
                key={node.workItem.workItemId}
                node={node}
                selectedId={selectedId}
                onSelectWorkItem={handleSelect}
                onCreateWorkItem={onCreateWorkItem}
                onEditWorkItem={onEditWorkItem}
                onDeleteWorkItem={onDeleteWorkItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-3 text-xs">
          {['Vision', 'Epic', 'Story', 'Task', 'Bug'].map((type) => {
            const config = TYPE_CONFIG[type as WorkItemType];
            return (
              <div key={type} className="flex items-center gap-1.5">
                <div className={clsx('p-0.5 rounded', config.bg)}>
                  {config.icon}
                </div>
                <span className="text-gray-600">{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
