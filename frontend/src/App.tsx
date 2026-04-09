import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Save, Trash2, X } from 'lucide-react';
import { OrgChartCanvas } from './components/company-designer/OrgChartCanvas';
import { useCompanyStore } from './store/companyStore';
import { organizationApi, roleApi, type Organization, type Role } from './api/client';

function App() {
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [roleLevel, setRoleLevel] = useState(1);
  const [reportsTo, setReportsTo] = useState('');
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    currentOrganization,
    roles,
    selectedRoleId,
    isLoading,
    error,
    setOrganization,
    setRoles,
    addRole,
    updateRole,
    removeRole,
    setSelectedRole,
    setLoading,
    setError,
  } = useCompanyStore();

  // Create organization
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    setIsSaving(true);
    try {
      const response = await organizationApi.create({
        name: orgName,
        description: orgDescription,
      });
      setOrganization(response.data.organization);
      setOrgName('');
      setOrgDescription('');
      setShowOrgForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsSaving(false);
    }
  };

  // Create role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !roleTitle.trim()) return;

    setIsSaving(true);
    try {
      const response = await roleApi.create(currentOrganization.id, {
        title: roleTitle,
        level: roleLevel,
        reportsTo: reportsTo || null,
      });
      addRole(response.data.role);
      setRoleTitle('');
      setRoleLevel(1);
      setReportsTo('');
      setShowRoleForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete role
  const handleDeleteRole = async (roleId: string) => {
    if (!currentOrganization) return;
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await roleApi.delete(currentOrganization.id, roleId);
      removeRole(roleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  // Load existing organizations on mount
  useEffect(() => {
    const loadOrgs = async () => {
      try {
        const response = await organizationApi.list();
        if (response.data.organizations.length > 0) {
          // Load the first organization for now
          const org = response.data.organizations[0];
          setOrganization(org);

          // Load roles for this organization
          const rolesResponse = await roleApi.list(org.id);
          setRoles(rolesResponse.data.roles);
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
      }
    };

    loadOrgs();
  }, [setOrganization, setRoles]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

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
          {/* Organization Section */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-900">Organization</h2>
              {!currentOrganization && (
                <button
                  onClick={() => setShowOrgForm(true)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {currentOrganization ? (
              <div className="p-3 bg-white rounded border border-gray-200">
                <h3 className="font-medium text-gray-900">{currentOrganization.name}</h3>
                {currentOrganization.description && (
                  <p className="text-sm text-gray-500 mt-1">
                    {currentOrganization.description}
                  </p>
                )}
              </div>
            ) : showOrgForm ? (
              <form onSubmit={handleCreateOrg} className="space-y-2">
                <input
                  type="text"
                  placeholder="Organization name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
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
                    onClick={() => setShowOrgForm(false)}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-gray-400">No organization created yet</p>
            )}
          </div>

          {/* Roles Section */}
          {currentOrganization && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-900">Roles ({roles.length})</h2>
                <button
                  onClick={() => setShowRoleForm(true)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {showRoleForm && (
                <form onSubmit={handleCreateRole} className="space-y-2 mb-3 p-2 bg-white rounded border border-gray-200">
                  <input
                    type="text"
                    placeholder="Role title (e.g., CEO)"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="Level"
                      value={roleLevel}
                      onChange={(e) => setRoleLevel(parseInt(e.target.value) || 1)}
                      className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                      value={reportsTo}
                      onChange={(e) => setReportsTo(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Reports to...</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.title}
                        </option>
                      ))}
                    </select>
                  </div>
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
                      onClick={() => setShowRoleForm(false)}
                      className="px-2 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-1">
                {roles.length === 0 ? (
                  <p className="text-sm text-gray-400">No roles defined yet</p>
                ) : (
                  roles.map((role) => (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`
                        flex items-center justify-between p-2 rounded cursor-pointer text-sm
                        ${selectedRoleId === role.id ? 'bg-purple-100 border border-purple-300' : 'bg-white border border-gray-200 hover:border-purple-300'}
                      `}
                    >
                      <div className="min-w-0">
                        <span className="font-medium truncate block">{role.title}</span>
                        <span className="text-xs text-gray-500">Level {role.level}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(role.id);
                        }}
                        className="p-1 hover:bg-red-100 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Selected Role Details */}
          {selectedRole && (
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <h3 className="font-medium text-purple-900">{selectedRole.title}</h3>
              <div className="mt-2 space-y-1 text-sm">
                <p className="text-purple-700">Level: {selectedRole.level}</p>
                {selectedRole.reportsTo && (
                  <p className="text-purple-700">
                    Reports to: {roles.find(r => r.id === selectedRole.reportsTo)?.title || 'Unknown'}
                  </p>
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
        {currentOrganization ? (
          <OrgChartCanvas />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Building2 className="w-16 h-16 mb-4" />
            <p className="text-lg">Create an organization to start designing</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
