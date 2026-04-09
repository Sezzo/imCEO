import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Organization, Role, Agent } from '../api/client';

interface CompanyState {
  currentOrganization: Organization | null;
  roles: Role[];
  agents: Map<string, Agent[]>;
  selectedRoleId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setOrganization: (org: Organization | null) => void;
  setRoles: (roles: Role[]) => void;
  addRole: (role: Role) => void;
  updateRole: (roleId: string, updates: Partial<Role>) => void;
  removeRole: (roleId: string) => void;
  setAgentsForRole: (roleId: string, agents: Agent[]) => void;
  setSelectedRole: (roleId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  currentOrganization: null,
  roles: [],
  agents: new Map(),
  selectedRoleId: null,
  isLoading: false,
  error: null,
};

export const useCompanyStore = create<CompanyState>()(
  devtools(
    (set) => ({
      ...initialState,

      setOrganization: (org) =>
        set({ currentOrganization: org }, false, 'setOrganization'),

      setRoles: (roles) =>
        set({ roles }, false, 'setRoles'),

      addRole: (role) =>
        set((state) => ({
          roles: [...state.roles, role],
        }), false, 'addRole'),

      updateRole: (roleId, updates) =>
        set((state) => ({
          roles: state.roles.map((r) =>
            r.id === roleId ? { ...r, ...updates } : r
          ),
        }), false, 'updateRole'),

      removeRole: (roleId) =>
        set((state) => ({
          roles: state.roles.filter((r) => r.id !== roleId),
          selectedRoleId: state.selectedRoleId === roleId ? null : state.selectedRoleId,
        }), false, 'removeRole'),

      setAgentsForRole: (roleId, agents) =>
        set((state) => {
          const newAgents = new Map(state.agents);
          newAgents.set(roleId, agents);
          return { agents: newAgents };
        }, false, 'setAgentsForRole'),

      setSelectedRole: (roleId) =>
        set({ selectedRoleId: roleId }, false, 'setSelectedRole'),

      setLoading: (loading) =>
        set({ isLoading: loading }, false, 'setLoading'),

      setError: (error) =>
        set({ error }, false, 'setError'),

      reset: () => set(initialState, false, 'reset'),
    }),
    { name: 'company-store' }
  )
);
