import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Building2, Users, User } from 'lucide-react';
import { clsx } from 'clsx';
import { useCompanyStore } from '../../store/companyStore';
import type { Role } from '../../api/client';

interface RoleNodeData {
  role: Role;
  agentCount: number;
  isSelected: boolean;
  onSelect: (roleId: string) => void;
}

const RoleNode = ({ data }: { data: RoleNodeData }) => {
  const { role, agentCount, isSelected, onSelect } = data;

  return (
    <div
      onClick={() => onSelect(role.id)}
      className={clsx(
        'relative px-4 py-3 rounded-lg border-2 bg-white shadow-sm cursor-pointer transition-all',
        'min-w-[160px] max-w-[200px]',
        isSelected
          ? 'border-purple-500 ring-2 ring-purple-200'
          : 'border-gray-200 hover:border-purple-300'
      )}
    >
      {/* Target handle (top) - for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />

      <div className="flex items-start gap-2">
        <div className="p-2 bg-purple-100 rounded-lg shrink-0">
          <User className="w-4 h-4 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {role.title}
          </h4>
          <p className="text-xs text-gray-500">Level {role.level}</p>
          {agentCount > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-purple-600">
              <Users className="w-3 h-3" />
              <span>{agentCount} agents</span>
            </div>
          )}
        </div>
      </div>

      {/* Source handle (bottom) - for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />
    </div>
  );
};

const nodeTypes = {
  role: RoleNode,
};

export function OrgChartCanvas() {
  const { roles, selectedRoleId, setSelectedRole, agents } = useCompanyStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Convert roles to nodes
  const roleNodes = useMemo(() => {
    return roles.map((role, index): Node => {
      // Calculate position based on level and index
      const level = role.level;
      const rolesAtLevel = roles.filter((r) => r.level === level);
      const indexAtLevel = rolesAtLevel.findIndex((r) => r.id === role.id);
      const totalAtLevel = rolesAtLevel.length;

      const xOffset = 220;
      const yOffset = 120;
      const startX = 400 - ((totalAtLevel - 1) * xOffset) / 2;

      return {
        id: role.id,
        type: 'role',
        position: {
          x: startX + indexAtLevel * xOffset,
          y: 50 + level * yOffset,
        },
        data: {
          role,
          agentCount: agents.get(role.id)?.length || 0,
          isSelected: role.id === selectedRoleId,
          onSelect: (roleId: string) => {
            setSelectedRole(roleId === selectedRoleId ? null : roleId);
          },
        },
      };
    });
  }, [roles, selectedRoleId, agents, setSelectedRole]);

  // Convert reporting relationships to edges
  const roleEdges = useMemo((): Edge[] => {
    const edges: Edge[] = [];
    roles.forEach((role) => {
      if (role.reportsTo) {
        edges.push({
          id: `${role.reportsTo}-${role.id}`,
          source: role.reportsTo,
          target: role.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#a855f7', strokeWidth: 2 },
        });
      }
    });
    return edges;
  }, [roles]);

  // Update nodes and edges when roles change
  useEffect(() => {
    setNodes(roleNodes);
    setEdges(roleEdges);
  }, [roleNodes, roleEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      // Update reporting structure when connecting nodes
      if (params.source && params.target) {
        const targetRole = roles.find((r) => r.id === params.target);
        if (targetRole) {
          // Update the role's reportsTo
          const updatedRole = { ...targetRole, reportsTo: params.source };
          // This would need to be synced with the backend
          console.log('Would update role:', updatedRole);
        }
      }
      setEdges((eds) => addEdge(params, eds));
    },
    [roles, setEdges]
  );

  if (roles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Building2 className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">No roles defined yet</p>
        <p className="text-sm">Add roles to start building your organization</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        className="bg-gray-50"
      >
        <Background color="#e5e7eb" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}
