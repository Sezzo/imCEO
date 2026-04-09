import { useState, useMemo } from 'react';

export const HIERARCHY_LEVELS = [
  'CEO',
  'Executive',
  'Management',
  'Lead',
  'Specialist',
  'Governance',
  'Observer',
] as const;

export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number];

export interface RoleTemplate {
  role_template_id: string;
  name: string;
  hierarchy_level: HierarchyLevel;
  description: string;
  purpose: string;
  primary_responsibilities: string[];
  non_responsibilities: string[];
  decision_scope: string;
  escalation_scope: string;
  created_at: string;
  updated_at: string;
}

interface RoleTemplateListProps {
  roleTemplates: RoleTemplate[];
  onSelectRole: (role: RoleTemplate) => void;
  onCreateRole: () => void;
  onEditRole: (role: RoleTemplate) => void;
  onDeleteRole: (roleId: string) => void;
}

const HIERARCHY_COLORS: Record<HierarchyLevel, string> = {
  CEO: '#d4af37',
  Executive: '#c0392b',
  Management: '#8e44ad',
  Lead: '#2980b9',
  Specialist: '#27ae60',
  Governance: '#f39c12',
  Observer: '#7f8c8d',
};

export function RoleTemplateList({
  roleTemplates,
  onSelectRole,
  onCreateRole,
  onEditRole,
  onDeleteRole,
}: RoleTemplateListProps) {
  const [filterText, setFilterText] = useState('');
  const [filterLevel, setFilterLevel] = useState<HierarchyLevel | 'all'>('all');

  const filteredRoles = useMemo(() => {
    return roleTemplates.filter((role) => {
      const matchesText =
        !filterText ||
        role.name.toLowerCase().includes(filterText.toLowerCase()) ||
        role.description.toLowerCase().includes(filterText.toLowerCase()) ||
        role.purpose.toLowerCase().includes(filterText.toLowerCase());

      const matchesLevel =
        filterLevel === 'all' || role.hierarchy_level === filterLevel;

      return matchesText && matchesLevel;
    });
  }, [roleTemplates, filterText, filterLevel]);

  const rolesByLevel = useMemo(() => {
    const grouped: Record<HierarchyLevel, RoleTemplate[]> = {
      CEO: [],
      Executive: [],
      Management: [],
      Lead: [],
      Specialist: [],
      Governance: [],
      Observer: [],
    };

    filteredRoles.forEach((role) => {
      grouped[role.hierarchy_level].push(role);
    });

    return grouped;
  }, [filteredRoles]);

  return (
    <div className="role-template-list">
      <div className="role-list-header">
        <h2>Rollen-Templates</h2>
        <button className="btn-primary" onClick={onCreateRole}>
          + Neue Rolle
        </button>
      </div>

      <div className="hierarchy-legend">
        {HIERARCHY_LEVELS.map((level) => (
          <div key={level} className="hierarchy-legend-item">
            <span
              className="hierarchy-dot"
              style={{ backgroundColor: HIERARCHY_COLORS[level] }}
            />
            <span className="hierarchy-label">{level}</span>
          </div>
        ))}
      </div>

      <div className="role-filters">
        <input
          type="text"
          placeholder="Rollen suchen..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="filter-input"
        />
        <select
          value={filterLevel}
          onChange={(e) =>
            setFilterLevel(e.target.value as HierarchyLevel | 'all')
          }
          className="filter-select"
        >
          <option value="all">Alle Ebenen</option>
          {HIERARCHY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      <div className="roles-count">
        {filteredRoles.length} von {roleTemplates.length} Rollen angezeigt
      </div>

      <div className="roles-container">
        {HIERARCHY_LEVELS.map((level) => {
          const levelRoles = rolesByLevel[level];
          if (filterLevel !== 'all' && filterLevel !== level) return null;
          if (levelRoles.length === 0 && filterLevel === 'all') return null;

          return (
            <div key={level} className="role-level-section">
              <div
                className="role-level-header"
                style={{ borderLeftColor: HIERARCHY_COLORS[level] }}
              >
                <span
                  className="hierarchy-badge"
                  style={{
                    backgroundColor: HIERARCHY_COLORS[level],
                    color: level === 'CEO' ? '#000' : '#fff',
                  }}
                >
                  {level}
                </span>
                <span className="role-count">{levelRoles.length} Rollen</span>
              </div>

              <div className="role-cards">
                {levelRoles.map((role) => (
                  <div
                    key={role.role_template_id}
                    className="role-card"
                    onClick={() => onSelectRole(role)}
                  >
                    <div className="role-card-header">
                      <h3 className="role-name">{role.name}</h3>
                    </div>

                    <p className="role-description">{role.description}</p>

                    <div className="role-purpose">
                      <strong>Zweck:</strong> {role.purpose}
                    </div>

                    <div className="role-responsibilities">
                      <strong>Verantwortlichkeiten:</strong>
                      <ul>
                        {role.primary_responsibilities
                          .slice(0, 3)
                          .map((resp, idx) => (
                            <li key={idx}>{resp}</li>
                          ))}
                        {role.primary_responsibilities.length > 3 && (
                          <li className="more-items">
                            +{role.primary_responsibilities.length - 3} weitere
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="role-actions">
                      <button
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditRole(role);
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRole(role.role_template_id);
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {levelRoles.length === 0 && filterLevel === level && (
                <div className="level-empty">
                  Keine Rollen auf dieser Ebene gefunden.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredRoles.length === 0 && (
        <div className="roles-empty">
          <p>Keine Rollen gefunden.</p>
          {filterText && (
            <button
              className="btn-link"
              onClick={() => {
                setFilterText('');
                setFilterLevel('all');
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
