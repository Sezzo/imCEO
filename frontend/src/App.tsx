import { useState, useEffect } from 'react';
import { Building2, Plus, Save, Trash2, X, ChevronRight, ChevronDown } from 'lucide-react';
import { OrgChartCanvas } from './components/company-designer/OrgChartCanvas';
import { useCompanyStore } from './store/companyStore';
import { companyApi, divisionApi, type Company, type Division } from './api/client';

function App() {
  // Company creation form state
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Division creation form state
  const [divisionName, setDivisionName] = useState('');
  const [divisionDescription, setDivisionDescription] = useState('');
  const [showDivisionForm, setShowDivisionForm] = useState(false);

  // UI state
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());

  const {
    currentCompany,
    divisions,
    selectedDivisionId,
    isLoading,
    error,
    setCompany,
    setDivisions,
    addDivision,
    removeDivision,
    setSelectedDivision,
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
      });
      addDivision(response.data.data);
      setDivisionName('');
      setDivisionDescription('');
      setShowDivisionForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create division');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete division
  const handleDeleteDivision = async (divisionId: string) => {
    if (!confirm('Are you sure you want to delete this division?')) return;

    try {
      await divisionApi.delete(divisionId);
      removeDivision(divisionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete division');
    }
  };

  // Toggle division expansion
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

  // Load existing companies on mount
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await companyApi.list();
        if (response.data.data.length > 0) {
          // Load the first company for now
          const company = response.data.data[0];
          setCompany(company);

          // Load divisions for this company
          const divisionsResponse = await divisionApi.listByCompany(company.companyId);
          setDivisions(divisionsResponse.data.data);
        }
      } catch (err) {
        console.error('Failed to load companies:', err);
      }
    };

    loadCompanies();
  }, [setCompany, setDivisions]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-600" />
            imCEO
          </h1>
          <p className="text-sm text-gray-500 mt-1">Company Designer</p>
        </div>

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
                  <p className="text-sm text-gray-500 mt-1">
                    {currentCompany.description}
                  </p>
                )}
                <div className="mt-2 text-xs text-gray-400">
                  ID: {currentCompany.companyId.slice(0, 8)}...
                </div>
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

          {/* Divisions Section */}
          {currentCompany && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-900">Divisions ({divisions.length})</h2>
                <button
                  onClick={() => setShowDivisionForm(true)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {showDivisionForm && (
                <form onSubmit={handleCreateDivision} className="space-y-2 mb-3 p-2 bg-white rounded border border-gray-200">
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
                      onClick={() => setShowDivisionForm(false)}
                      className="px-2 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-1">
                {divisions.length === 0 ? (
                  <p className="text-sm text-gray-400">No divisions defined yet</p>
                ) : (
                  divisions.map((division) => (
                    <div key={division.divisionId}>
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
                          {expandedDivisions.has(division.divisionId) ? (
                            <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
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

                      {/* Placeholder for departments - will be expanded later */}
                      {expandedDivisions.has(division.divisionId) && (
                        <div className="ml-4 mt-1 space-y-1">
                          <div className="p-2 text-sm text-gray-400 italic">
                            Departments will appear here...
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 h-full">
        {currentCompany ? (
          <OrgChartCanvas />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Building2 className="w-16 h-16 mb-4" />
            <p className="text-lg">Create a company to start designing</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
