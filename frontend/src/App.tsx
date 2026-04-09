import { useState, useEffect } from 'react';
import { Building2, Plus, Save, Trash2, X, ChevronRight, ChevronDown, Briefcase, Users, Layout, Kanban } from 'lucide-react';
import { OrgChartCanvas } from './components/company-designer/OrgChartCanvas';
import { WorkItemBoard } from './components/work-items/WorkItemBoard';
import { useCompanyStore } from './store/companyStore';
import {
  companyApi,
  divisionApi,
  departmentApi,
  teamApi,
  type Company,
  type Division,
  type Department,
  type Team,
} from './api/client';

type View = 'company-designer' | 'work-items';

function App() {
  // Navigation state
  const [currentView, setCurrentView] = useState<View>('company-designer');

  // Company creation form state
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Division creation form state
  const [divisionName, setDivisionName] = useState('');
  const [divisionDescription, setDivisionDescription] = useState('');
  const [showDivisionForm, setShowDivisionForm] = useState(false);
  const [divisionFormParentId, setDivisionFormParentId] = useState<string | null>(null);

  // Department creation form state
  const [departmentName, setDepartmentName] = useState('');
  const [departmentDescription, setDepartmentDescription] = useState('');
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [departmentFormDivisionId, setDepartmentFormDivisionId] = useState<string | null>(null);

  // Team creation form state
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamMission, setTeamMission] = useState('');
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamFormDepartmentId, setTeamFormDepartmentId] = useState<string | null>(null);

  // UI state
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  const {
    currentCompany,
    divisions,
    departments,
    teams,
    selectedDivisionId,
    selectedDepartmentId,
    selectedTeamId,
    isLoading,
    error,
    setCompany,
    setDivisions,
    setDepartments,
    setTeams,
    addDivision,
    addDepartment,
    addTeam,
    removeDivision,
    removeDepartment,
    removeTeam,
    setSelectedDivision,
    setSelectedDepartment,
    setSelectedTeam,
    setLoading,
    setError,
  } = useCompanyStore();

  // Create company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setIsSaving(true);
    try {
      const response = await companyApi.create({
        name: companyName,
        description: companyDescription,
      });
      setCompany(response.data.data);
      setCompanyName('');
      setCompanyDescription('');
      setShowCompanyForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setIsSaving(false);
    }
  };

  // Create division
  const handleCreateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !divisionName.trim()) return;

    setIsSaving(true);
    try {
      const response = await divisionApi.create({
        companyId: currentCompany.companyId,
        name: divisionName,
        description: divisionDescription,
        parentDivisionId: divisionFormParentId || undefined,
      });
      addDivision(response.data.data);
      setDivisionName('');
      setDivisionDescription('');
      setDivisionFormParentId(null);
      setShowDivisionForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create division');
    } finally {
      setIsSaving(false);
    }
  };

  // Create department
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentFormDivisionId || !departmentName.trim()) return;

    setIsSaving(true);
    try {
      const response = await departmentApi.create({
        divisionId: departmentFormDivisionId,
        name: departmentName,
        description: departmentDescription,
      });
      addDepartment(response.data.data);
      setDepartmentName('');
      setDepartmentDescription('');
      setDepartmentFormDivisionId(null);
      setShowDepartmentForm(false);
      // Expand the division to show the new department
      setExpandedDivisions((prev) => new Set(prev).add(departmentFormDivisionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create department');
    } finally {
      setIsSaving(false);
    }
  };

  // Create team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamFormDepartmentId || !teamName.trim()) return;

    setIsSaving(true);
    try {
      const response = await teamApi.create({
        departmentId: teamFormDepartmentId,
        name: teamName,
        description: teamDescription,
        mission: teamMission,
      });
      addTeam(response.data.data);
      setTeamName('');
      setTeamDescription('');
      setTeamMission('');
      setTeamFormDepartmentId(null);
      setShowTeamForm(false);
      // Find parent division and expand it
      const dept = departments.find(d => d.departmentId === teamFormDepartmentId);
      if (dept) {
        setExpandedDivisions((prev) => new Set(prev).add(dept.divisionId));
        setExpandedDepartments((prev) => new Set(prev).add(teamFormDepartmentId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete handlers
  const handleDeleteDivision = async (divisionId: string) => {
    if (!confirm('Are you sure you want to delete this division? All departments and teams within it will also be deleted.')) return;

    try {
      await divisionApi.delete(divisionId);
      removeDivision(divisionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete division');
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (!confirm('Are you sure you want to delete this department? All teams within it will also be deleted.')) return;

    try {
      await departmentApi.delete(departmentId);
      removeDepartment(departmentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete department');
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;

    try {
      await teamApi.delete(teamId);
      removeTeam(teamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team');
    }
  };

  // Toggle expansion
  const toggleDivision = (divisionId: string) => {
    setExpandedDivisions((prev) => {
      const next = new Set(prev);
      if (next.has(divisionId)) {
        next.delete(divisionId);
      } else {
        next.add(divisionId);
      }
      return next;
    });
  };

  const toggleDepartment = (departmentId: string) => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(departmentId)) {
        next.delete(departmentId);
      } else {
        next.add(departmentId);
      }
      return next;
    });
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const companiesResponse = await companyApi.list();
        if (companiesResponse.data.data.length > 0) {
          const company = companiesResponse.data.data[0];
          setCompany(company);

          // Load all related data
          const [divisionsRes, departmentsRes, teamsRes] = await Promise.all([
            divisionApi.listByCompany(company.companyId),
            departmentApi.list(),
            teamApi.list(),
          ]);

          setDivisions(divisionsRes.data.data);
          setDepartments(departmentsRes.data.data);
          setTeams(teamsRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setCompany, setDivisions, setDepartments, setTeams, setLoading, setError]);

  // Helper to get departments for a division
  const getDepartmentsForDivision = (divisionId: string) =>
    departments.filter((d) => d.divisionId === divisionId);

  // Helper to get teams for a department
  const getTeamsForDepartment = (departmentId: string) =>
    teams.filter((t) => t.departmentId === departmentId);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-600" />
            imCEO
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI Company Operating System</p>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-2 border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentView('company-designer')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'company-designer'
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Layout className="w-4 h-4" />
              Company Designer
            </button>
            <button
              onClick={() => setCurrentView('work-items')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'work-items'
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Kanban className="w-4 h-4" />
              Work Items
            </button>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Company Section */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-900">Company</h2>
              {!currentCompany && (
                <button
                  onClick={() => setShowCompanyForm(true)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {currentCompany ? (
              <div className="p-3 bg-white rounded border border-gray-200">
                <h3 className="font-medium text-gray-900">{currentCompany.name}</h3>
                {currentCompany.description && (
                  <p className="text-sm text-gray-500 mt-1">{currentCompany.description}</p>
                )}
              </div>
            ) : showCompanyForm ? (
              <form onSubmit={handleCreateCompany} className="space-y-2">
                <input
                  type="text"
                  placeholder="Company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCompanyForm(false)}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-gray-400">No company created yet</p>
            )}
          </div>

          {/* Organization Hierarchy */}
          {currentCompany && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-900">Organization</h2>
                <button
                  onClick={() => {
                    setDivisionFormParentId(null);
                    setShowDivisionForm(true);
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Division Form */}
              {showDivisionForm && (
                <form onSubmit={handleCreateDivision} className="space-y-2 mb-3 p-2 bg-white rounded border border-gray-200">
                  <div className="text-xs text-gray-500 font-medium">New Division</div>
                  <input
                    type="text"
                    placeholder="Division name"
                    value={divisionName}
                    onChange={(e) => setDivisionName(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={divisionDescription}
                    onChange={(e) => setDivisionDescription(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 px-2 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      <Save className="w-3 h-3 inline mr-1" />
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDivisionForm(false);
                        setDivisionFormParentId(null);
                      }}
                      className="px-2 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </form>
              )}

              {/* Hierarchy Tree */}
              <div className="space-y-1">
                {divisions.length === 0 ? (
                  <p className="text-sm text-gray-400">No divisions yet. Add one to start.</p>
                ) : (
                  divisions.map((division) => {
                    const divisionDepts = getDepartmentsForDivision(division.divisionId);
                    const isExpanded = expandedDivisions.has(division.divisionId);

                    return (
                      <div key={division.divisionId} className="space-y-1">
                        {/* Division Row */}
                        <div
                          onClick={() => {
                            toggleDivision(division.divisionId);
                            setSelectedDivision(division.divisionId);
                          }}
                          className={`
                            flex items-center justify-between p-2 rounded cursor-pointer text-sm
                            ${selectedDivisionId === division.divisionId
                              ? 'bg-purple-100 border border-purple-300'
                              : 'bg-white border border-gray-200 hover:border-purple-300'
                            }
                          `}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            {divisionDepts.length > 0 ? (
                              isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
                              )
                            ) : (
                              <span className="w-3 shrink-0" />
                            )}
                            <span className="font-medium truncate">{division.name}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDivision(division.divisionId);
                            }}
                            className="p-1 hover:bg-red-100 hover:text-red-600 rounded shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Departments under Division */}
                        {isExpanded && (
                          <div className="ml-4 space-y-1">
                            {/* Add Department Button */}
                            {showDepartmentForm && departmentFormDivisionId === division.divisionId ? (
                              <form onSubmit={handleCreateDepartment} className="space-y-2 p-2 bg-blue-50 rounded border border-blue-200">
                                <input
                                  type="text"
                                  placeholder="Department name"
                                  value={departmentName}
                                  onChange={(e) => setDepartmentName(e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                />
                                <input
                                  type="text"
                                  placeholder="Description (optional)"
                                  value={departmentDescription}
                                  onChange={(e) => setDepartmentDescription(e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    <Plus className="w-3 h-3 inline mr-1" />
                                    Add
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowDepartmentForm(false);
                                      setDepartmentFormDivisionId(null);
                                    }}
                                    className="px-2 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <button
                                onClick={() => {
                                  setDepartmentFormDivisionId(division.divisionId);
                                  setShowDepartmentForm(true);
                                }}
                                className="w-full flex items-center gap-1 p-1.5 text-xs text-blue-600 hover:bg-blue-100 rounded"
                              >
                                <Plus className="w-3 h-3" />
                                Add Department
                              </button>
                            )}

                            {/* Departments List */}
                            {divisionDepts.map((dept) => {
                              const deptTeams = getTeamsForDepartment(dept.departmentId);
                              const isDeptExpanded = expandedDepartments.has(dept.departmentId);

                              return (
                                <div key={dept.departmentId}>
                                  {/* Department Row */}
                                  <div
                                    onClick={() => {
                                      toggleDepartment(dept.departmentId);
                                      setSelectedDepartment(dept.departmentId);
                                    }}
                                    className={`
                                      flex items-center justify-between p-2 rounded cursor-pointer text-sm
                                      ${selectedDepartmentId === dept.departmentId
                                        ? 'bg-blue-100 border border-blue-300'
                                        : 'bg-white border border-gray-200 hover:border-blue-300'
                                      }
                                    `}
                                  >
                                    <div className="flex items-center gap-1 min-w-0">
                                      {deptTeams.length > 0 ? (
                                        isDeptExpanded ? (
                                          <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
                                        )
                                      ) : (
                                        <span className="w-3 shrink-0" />
                                      )}
                                      <Briefcase className="w-3 h-3 text-blue-500 shrink-0" />
                                      <span className="truncate">{dept.name}</span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDepartment(dept.departmentId);
                                      }}
                                      className="p-1 hover:bg-red-100 hover:text-red-600 rounded shrink-0"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Teams under Department */}
                                  {isDeptExpanded && (
                                    <div className="ml-4 space-y-1">
                                      {/* Add Team Button */}
                                      {showTeamForm && teamFormDepartmentId === dept.departmentId ? (
                                        <form onSubmit={handleCreateTeam} className="space-y-2 p-2 bg-amber-50 rounded border border-amber-200">
                                          <input
                                            type="text"
                                            placeholder="Team name"
                                            value={teamName}
                                            onChange={(e) => setTeamName(e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            autoFocus
                                          />
                                          <input
                                            type="text"
                                            placeholder="Description (optional)"
                                            value={teamDescription}
                                            onChange={(e) => setTeamDescription(e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                                          />
                                          <input
                                            type="text"
                                            placeholder="Mission (optional)"
                                            value={teamMission}
                                            onChange={(e) => setTeamMission(e.target.value)}
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              type="submit"
                                              disabled={isSaving}
                                              className="flex-1 px-2 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 disabled:opacity-50"
                                            >
                                              <Plus className="w-3 h-3 inline mr-1" />
                                              Add
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setShowTeamForm(false);
                                                setTeamFormDepartmentId(null);
                                              }}
                                              className="px-2 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </form>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setTeamFormDepartmentId(dept.departmentId);
                                            setShowTeamForm(true);
                                          }}
                                          className="w-full flex items-center gap-1 p-1.5 text-xs text-amber-600 hover:bg-amber-100 rounded"
                                        >
                                          <Plus className="w-3 h-3" />
                                          Add Team
                                        </button>
                                      )}

                                      {/* Teams List */}
                                      {deptTeams.map((team) => (
                                        <div
                                          key={team.teamId}
                                          onClick={() => setSelectedTeam(team.teamId)}
                                          className={`
                                            flex items-center justify-between p-2 rounded cursor-pointer text-sm
                                            ${selectedTeamId === team.teamId
                                              ? 'bg-amber-100 border border-amber-300'
                                              : 'bg-white border border-gray-200 hover:border-amber-300'
                                            }
                                          `}
                                        >
                                          <div className="flex items-center gap-1 min-w-0">
                                            <Users className="w-3 h-3 text-amber-500 shrink-0" />
                                            <span className="truncate">{team.name}</span>
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteTeam(team.teamId);
                                            }}
                                            className="p-1 hover:bg-red-100 hover:text-red-600 rounded shrink-0"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading...</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden">
        {currentView === 'company-designer' ? (
          currentCompany ? (
            <OrgChartCanvas />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Building2 className="w-16 h-16 mb-4" />
              <p className="text-lg">Create a company to start designing</p>
            </div>
          )
        ) : (
          <WorkItemBoard />
        )}
      </main>
    </div>
  );
}

export default App;
