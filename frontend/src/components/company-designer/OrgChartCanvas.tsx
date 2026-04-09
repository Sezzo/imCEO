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
import { Building2, Users, Briefcase, FolderTree, User } from 'lucide-react';
import { clsx } from 'clsx';
import { useCompanyStore } from '../../store/companyStore';
import type { Company, Division, Department, Team } from '../../api/client';

// === Node Types ===

interface CompanyNodeData {
  company: Company;
  isSelected: boolean;
  onSelect: () => void;
}

interface DivisionNodeData {
  division: Division;
  isSelected: boolean;
  onSelect: () => void;
}

interface DepartmentNodeData {
  department: Department;
  isSelected: boolean;
  onSelect: () => void;
}

interface TeamNodeData {
  team: Team;
  isSelected: boolean;
  onSelect: () => void;
  agentCount: number;
}

// === Node Components ===

const CompanyNode = ({ data }: { data: CompanyNodeData }) => {
  const { company, isSelected, onSelect } = data;

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'relative px-6 py-4 rounded-lg border-2 bg-white shadow-md cursor-pointer transition-all',
        'min-w-[200px] max-w-[280px]',
        isSelected
          ? 'border-purple-600 ring-2 ring-purple-200'
          : 'border-purple-300 hover:border-purple-500'
      )}
    >
      {/* Source handle (bottom) - for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-purple-600 !border-2 !border-white"
      />

      <div className="flex items-start gap-3">
        <div className="p-2 bg-purple-100 rounded-lg shrink-0">
          <Building2 className="w-5 h-5 text-purple-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 truncate">
            {company.name}
          </h3>
          <p className="text-xs text-purple-600 font-medium">Company</p>
          {company.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {company.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const DivisionNode = ({ data }: { data: DivisionNodeData }) => {
  const { division, isSelected, onSelect } = data;

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'relative px-4 py-3 rounded-lg border-2 bg-white shadow-sm cursor-pointer transition-all',
        'min-w-[160px] max-w-[220px]',
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-blue-300'
      )}
    >
      {/* Target handle (top) - for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />

      {/* Source handle (bottom) - for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />

      <div className="flex items-start gap-2">
        <div className="p-2 bg-blue-100 rounded-lg shrink-0">
          <FolderTree className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {division.name}
          </h4>
          <p className="text-xs text-blue-600">Division</p>
          {division.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {division.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const DepartmentNode = ({ data }: { data: DepartmentNodeData }) => {
  const { department, isSelected, onSelect } = data;

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'relative px-4 py-3 rounded-lg border-2 bg-white shadow-sm cursor-pointer transition-all',
        'min-w-[160px] max-w-[220px]',
        isSelected
          ? 'border-green-500 ring-2 ring-green-200'
          : 'border-gray-200 hover:border-green-300'
      )}
    >
      {/* Target handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />

      {/* Source handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />

      <div className="flex items-start gap-2">
        <div className="p-2 bg-green-100 rounded-lg shrink-0">
          <Briefcase className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {department.name}
          </h4>
          <p className="text-xs text-green-600">Department</p>
          {department.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {department.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const TeamNode = ({ data }: { data: TeamNodeData }) => {
  const { team, isSelected, onSelect, agentCount } = data;

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'relative px-4 py-3 rounded-lg border-2 bg-white shadow-sm cursor-pointer transition-all',
        'min-w-[160px] max-w-[220px]',
        isSelected
          ? 'border-amber-500 ring-2 ring-amber-200'
          : 'border-gray-200 hover:border-amber-300'
      )}
    >
      {/* Target handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />

      <div className="flex items-start gap-2">
        <div className="p-2 bg-amber-100 rounded-lg shrink-0">
          <Users className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {team.name}
          </h4>
          <p className="text-xs text-amber-600">Team</p>
          {team.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {team.description}
            </p>
          )}
          {agentCount > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
              <User className="w-3 h-3" />
              <span>{agentCount} agents</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  company: CompanyNode,
  division: DivisionNode,
  department: DepartmentNode,
  team: TeamNode,
};

// === Main Component ===

export function OrgChartCanvas() {
  const {
    currentCompany,
    divisions,
    departments,
    teams,
    agents,
    selectedDivisionId,
    selectedDepartmentId,
    selectedTeamId,
    setSelectedDivision,
    setSelectedDepartment,
    setSelectedTeam,
  } = useCompanyStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Calculate positions for hierarchy layout
  const calculateLayout = useMemo(() => {
    if (!currentCompany) return { nodes: [], edges: [] };

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const xSpacing = 250;
    const ySpacing = 150;
    const centerX = 400;

    // Company node at top
    newNodes.push({
      id: currentCompany.companyId,
      type: 'company',
      position: { x: centerX - 100, y: 20 },
      data: {
        company: currentCompany,
        isSelected: true,
        onSelect: () => {},
      },
    });

    // Divisions on second level
    divisions.forEach((division, index) => {
      const divisionX = centerX - ((divisions.length - 1) * xSpacing) / 2 + index * xSpacing;
      const divisionY = 20 + ySpacing;

      newNodes.push({
        id: division.divisionId,
        type: 'division',
        position: { x: divisionX, y: divisionY },
        data: {
          division,
          isSelected: selectedDivisionId === division.divisionId,
          onSelect: () => {
            setSelectedDivision(division.divisionId);
          },
        },
      });

      // Edge from company to division
      newEdges.push({
        id: `edge-${currentCompany.companyId}-${division.divisionId}`,
        source: currentCompany.companyId,
        target: division.divisionId,
        type: 'smoothstep',
        style: { stroke: '#a855f7', strokeWidth: 2 },
      });

      // Departments under this division
      const divisionDepartments = departments.filter(
        (d) => d.divisionId === division.divisionId
      );

      divisionDepartments.forEach((dept, deptIndex) => {
        const deptX = divisionX - ((divisionDepartments.length - 1) * 150) / 2 + deptIndex * 150;
        const deptY = divisionY + ySpacing;

        newNodes.push({
          id: dept.departmentId,
          type: 'department',
          position: { x: deptX, y: deptY },
          data: {
            department: dept,
            isSelected: selectedDepartmentId === dept.departmentId,
            onSelect: () => {
              setSelectedDepartment(dept.departmentId);
            },
          },
        });

        // Edge from division to department
        newEdges.push({
          id: `edge-${division.divisionId}-${dept.departmentId}`,
          source: division.divisionId,
          target: dept.departmentId,
          type: 'smoothstep',
          style: { stroke: '#3b82f6', strokeWidth: 2 },
        });

        // Teams under this department
        const deptTeams = teams.filter((t) => t.departmentId === dept.departmentId);

        deptTeams.forEach((team, teamIndex) => {
          const teamX = deptX - ((deptTeams.length - 1) * 120) / 2 + teamIndex * 120;
          const teamY = deptY + ySpacing;

          const teamAgents = agents.filter((a) => a.teamId === team.teamId);

          newNodes.push({
            id: team.teamId,
            type: 'team',
            position: { x: teamX, y: teamY },
            data: {
              team,
              isSelected: selectedTeamId === team.teamId,
              onSelect: () => {
                setSelectedTeam(team.teamId);
              },
              agentCount: teamAgents.length,
            },
          });

          // Edge from department to team
          newEdges.push({
            id: `edge-${dept.departmentId}-${team.teamId}`,
            source: dept.departmentId,
            target: team.teamId,
            type: 'smoothstep',
            style: { stroke: '#22c55e', strokeWidth: 2 },
          });
        });
      });
    });

    return { nodes: newNodes, edges: newEdges };
  }, [currentCompany, divisions, departments, teams, agents, selectedDivisionId, selectedDepartmentId, selectedTeamId, setSelectedDivision, setSelectedDepartment, setSelectedTeam]);

  // Update nodes and edges when data changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = calculateLayout;
    setNodes(newNodes);
    setEdges(newEdges);
  }, [calculateLayout, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  if (!currentCompany) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Building2 className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">No company selected</p>
        <p className="text-sm">Create or select a company to view the organization</p>
      </div>
    );
  }

  if (divisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <FolderTree className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">No divisions defined</p>
        <p className="text-sm">Add divisions to start building your organization</p>
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
