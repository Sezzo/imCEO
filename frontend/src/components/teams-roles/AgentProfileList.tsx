import { useState, useMemo } from 'react';

export type AgentStatus =
  | 'active'
  | 'idle'
  | 'busy'
  | 'offline'
  | 'error'
  | 'suspended';

export interface AgentProfile {
  agent_id: string;
  team_id: string;
  role_template_id: string;
  display_name: string;
  internal_name: string;
  seniority: 'junior' | 'mid' | 'senior' | 'principal';
  status: AgentStatus;
  max_parallel_tasks: number;
  active_tasks: number;
  created_at: string;
  updated_at: string;
}

interface AgentProfileListProps {
  agents: AgentProfile[];
  teams: { team_id: string; name: string }[];
  roles: { role_template_id: string; name: string }[];
  onSelectAgent: (agent: AgentProfile) => void;
  onCreateAgent: () => void;
  onEditAgent: (agent: AgentProfile) => void;
  onDeleteAgent: (agentId: string) => void;
  onActivateAgent: (agentId: string) => void;
  onDeactivateAgent: (agentId: string) => void;
}

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; color: string; bgColor: string }
> = {
  active: {
    label: 'Aktiv',
    color: '#27ae60',
    bgColor: 'rgba(39, 174, 96, 0.1)',
  },
  idle: {
    label: 'Bereit',
    color: '#3498db',
    bgColor: 'rgba(52, 152, 219, 0.1)',
  },
  busy: {
    label: 'Beschäftigt',
    color: '#f39c12',
    bgColor: 'rgba(243, 156, 18, 0.1)',
  },
  offline: {
    label: 'Offline',
    color: '#7f8c8d',
    bgColor: 'rgba(127, 140, 141, 0.1)',
  },
  error: {
    label: 'Fehler',
    color: '#e74c3c',
    bgColor: 'rgba(231, 76, 60, 0.1)',
  },
  suspended: {
    label: 'Suspendiert',
    color: '#95a5a6',
    bgColor: 'rgba(149, 165, 166, 0.1)',
  },
};

const SENIORITY_LABELS: Record<string, string> = {
  junior: 'Junior',
  mid: 'Professional',
  senior: 'Senior',
  principal: 'Principal',
};

export function AgentProfileList({
  agents,
  teams,
  roles,
  onSelectAgent,
  onCreateAgent,
  onEditAgent,
  onDeleteAgent,
  onActivateAgent,
  onDeactivateAgent,
}: AgentProfileListProps) {
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<AgentStatus | 'all'>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesText =
        !filterText ||
        agent.display_name.toLowerCase().includes(filterText.toLowerCase()) ||
        agent.internal_name.toLowerCase().includes(filterText.toLowerCase());

      const matchesStatus =
        filterStatus === 'all' || agent.status === filterStatus;
      const matchesTeam =
        filterTeam === 'all' || agent.team_id === filterTeam;

      return matchesText && matchesStatus && matchesTeam;
    });
  }, [agents, filterText, filterStatus, filterTeam]);

  const statusCounts = useMemo(() => {
    const counts: Record<AgentStatus | 'all', number> = {
      all: agents.length,
      active: 0,
      idle: 0,
      busy: 0,
      offline: 0,
      error: 0,
      suspended: 0,
    };

    agents.forEach((agent) => {
      counts[agent.status]++;
    });

    return counts;
  }, [agents]);

  const getTeamName = (teamId: string) => {
    const team = teams.find((t) => t.team_id === teamId);
    return team?.name || teamId;
  };

  const getRoleName = (roleId: string) => {
    const role = roles.find((r) => r.role_template_id === roleId);
    return role?.name || roleId;
  };

  return (
    <div className="agent-profile-list">
      <div className="agent-list-header">
        <h2>Agent-Profile</h2>
        <button className="btn-primary" onClick={onCreateAgent}>
          + Neuer Agent
        </button>
      </div>

      <div className="status-overview">
        {(Object.keys(STATUS_CONFIG) as AgentStatus[]).map((status) => (
          <div
            key={status}
            className={`status-pill ${filterStatus === status ? 'active' : ''}`}
            onClick={() =>
              setFilterStatus(filterStatus === status ? 'all' : status)
            }
            style={{
              borderColor: STATUS_CONFIG[status].color,
              backgroundColor:
                filterStatus === status
                  ? STATUS_CONFIG[status].bgColor
                  : 'transparent',
            }}
          >
            <span
              className="status-dot"
              style={{ backgroundColor: STATUS_CONFIG[status].color }}
            />
            <span className="status-label">{STATUS_CONFIG[status].label}</span>
            <span className="status-count">{statusCounts[status]}</span>
          </div>
        ))}
      </div>

      <div className="agent-filters">
        <input
          type="text"
          placeholder="Agents suchen..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="filter-input"
        />
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="filter-select"
        >
          <option value="all">Alle Teams</option>
          {teams.map((team) => (
            <option key={team.team_id} value={team.team_id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      <div className="agents-count">
        {filteredAgents.length} von {agents.length} Agents angezeigt
      </div>

      <div className="agents-table-container">
        <table className="agents-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Name</th>
              <th>Intern</th>
              <th>Team</th>
              <th>Rolle</th>
              <th>Seniority</th>
              <th>Tasks</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.map((agent) => {
              const statusConfig = STATUS_CONFIG[agent.status];
              return (
                <tr
                  key={agent.agent_id}
                  onClick={() => onSelectAgent(agent)}
                  className="agent-row"
                >
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: statusConfig.bgColor,
                        color: statusConfig.color,
                        border: `1px solid ${statusConfig.color}`,
                      }}
                    >
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="agent-name">{agent.display_name}</td>
                  <td className="agent-internal">{agent.internal_name}</td>
                  <td>{getTeamName(agent.team_id)}</td>
                  <td>{getRoleName(agent.role_template_id)}</td>
                  <td>
                    <span className={`seniority-badge ${agent.seniority}`}>
                      {SENIORITY_LABELS[agent.seniority]}
                    </span>
                  </td>
                  <td>
                    <div className="task-indicator">
                      <span
                        className={`task-bar ${
                          agent.active_tasks > 0 ? 'active' : ''
                        }`}
                        style={{
                          width: `${
                            (agent.active_tasks / agent.max_parallel_tasks) *
                            100
                          }%`,
                        }}
                      />
                      <span className="task-count">
                        {agent.active_tasks}/{agent.max_parallel_tasks}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="agent-actions">
                      {agent.status === 'offline' ||
                      agent.status === 'suspended' ? (
                        <button
                          className="btn-icon activate"
                          onClick={(e) => {
                            e.stopPropagation();
                            onActivateAgent(agent.agent_id);
                          }}
                          title="Aktivieren"
                        >
                          ▶
                        </button>
                      ) : (
                        <button
                          className="btn-icon deactivate"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeactivateAgent(agent.agent_id);
                          }}
                          title="Deaktivieren"
                        >
                          ⏸
                        </button>
                      )}
                      <button
                        className="btn-icon edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditAgent(agent);
                        }}
                        title="Bearbeiten"
                      >
                        ✎
                      </button>
                      <button
                        className="btn-icon delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAgent(agent.agent_id);
                        }}
                        title="Löschen"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredAgents.length === 0 && (
        <div className="agents-empty">
          <p>Keine Agents gefunden.</p>
          {(filterText || filterStatus !== 'all' || filterTeam !== 'all') && (
            <button
              className="btn-link"
              onClick={() => {
                setFilterText('');
                setFilterStatus('all');
                setFilterTeam('all');
              }}
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
