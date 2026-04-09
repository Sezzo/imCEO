import { useState, useMemo } from 'react';

export interface Team {
  team_id: string;
  department_id: string;
  name: string;
  description: string;
  mission: string;
  team_type: string;
  lead_role_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TeamsListProps {
  teams: Team[];
  onSelectTeam: (team: Team) => void;
  onCreateTeam: () => void;
  onEditTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
}

export function TeamsList({
  teams,
  onSelectTeam,
  onCreateTeam,
  onEditTeam,
  onDeleteTeam,
}: TeamsListProps) {
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const matchesText =
        !filterText ||
        team.name.toLowerCase().includes(filterText.toLowerCase()) ||
        team.description.toLowerCase().includes(filterText.toLowerCase()) ||
        team.mission.toLowerCase().includes(filterText.toLowerCase());

      const matchesType = filterType === 'all' || team.team_type === filterType;

      return matchesText && matchesType;
    });
  }, [teams, filterText, filterType]);

  const teamTypes = useMemo(() => {
    const types = new Set(teams.map((t) => t.team_type));
    return Array.from(types);
  }, [teams]);

  return (
    <div className="teams-list">
      <div className="teams-list-header">
        <h2>Teams</h2>
        <button className="btn-primary" onClick={onCreateTeam}>
          + Neues Team
        </button>
      </div>

      <div className="teams-filters">
        <input
          type="text"
          placeholder="Teams suchen..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="filter-input"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="filter-select"
        >
          <option value="all">Alle Typen</option>
          {teamTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="teams-count">
        {filteredTeams.length} von {teams.length} Teams angezeigt
      </div>

      <div className="teams-grid">
        {filteredTeams.map((team) => (
          <div
            key={team.team_id}
            className="team-card"
            onClick={() => onSelectTeam(team)}
          >
            <div className="team-card-header">
              <h3 className="team-name">{team.name}</h3>
              <span className="team-type-badge">{team.team_type}</span>
            </div>

            <p className="team-description">{team.description}</p>

            <div className="team-mission">
              <strong>Mission:</strong> {team.mission}
            </div>

            <div className="team-meta">
              <span className="team-meta-item">
                Lead: {team.lead_role_id || 'Nicht zugewiesen'}
              </span>
              <span className="team-meta-item">
                Dept: {team.department_id}
              </span>
            </div>

            <div className="team-actions">
              <button
                className="btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTeam(team);
                }}
              >
                Bearbeiten
              </button>
              <button
                className="btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTeam(team.team_id);
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTeams.length === 0 && (
        <div className="teams-empty">
          <p>Keine Teams gefunden.</p>
          {filterText && (
            <button
              className="btn-link"
              onClick={() => {
                setFilterText('');
                setFilterType('all');
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
