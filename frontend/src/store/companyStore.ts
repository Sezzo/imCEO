import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Company,
  Division,
  Department,
  Team,
  RoleTemplate,
  AgentProfile,
  WorkItem,
  Artifact,
} from '../api/client';

interface CompanyState {
  // Current selections
  currentCompany: Company | null;
  selectedDivisionId: string | null;
  selectedDepartmentId: string | null;
  selectedTeamId: string | null;
  selectedRoleTemplateId: string | null;
  selectedAgentId: string | null;
  selectedWorkItemId: string | null;

  // Data collections
  divisions: Division[];
  departments: Department[];
  teams: Team[];
  roleTemplates: RoleTemplate[];
  agents: AgentProfile[];
  workItems: WorkItem[];
  artifacts: Artifact[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setCompany: (company: Company | null) => void;
  setDivisions: (divisions: Division[]) => void;
  setDepartments: (departments: Department[]) => void;
  setTeams: (teams: Team[]) => void;
  setRoleTemplates: (templates: RoleTemplate[]) => void;
  setAgents: (agents: AgentProfile[]) => void;
  setWorkItems: (workItems: WorkItem[]) => void;
  setArtifacts: (artifacts: Artifact[]) => void;

  // Add single items
  addDivision: (division: Division) => void;
  addDepartment: (department: Department) => void;
  addTeam: (team: Team) => void;
  addRoleTemplate: (template: RoleTemplate) => void;
  addAgent: (agent: AgentProfile) => void;
  addWorkItem: (workItem: WorkItem) => void;
  addArtifact: (artifact: Artifact) => void;

  // Update items
  updateDivision: (id: string, updates: Partial<Division>) => void;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  updateTeam: (id: string, updates: Partial<Team>) => void;
  updateRoleTemplate: (id: string, updates: Partial<RoleTemplate>) => void;
  updateAgent: (id: string, updates: Partial<AgentProfile>) => void;
  updateWorkItem: (id: string, updates: Partial<WorkItem>) => void;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;

  // Remove items
  removeDivision: (id: string) => void;
  removeDepartment: (id: string) => void;
  removeTeam: (id: string) => void;
  removeRoleTemplate: (id: string) => void;
  removeAgent: (id: string) => void;
  removeWorkItem: (id: string) => void;
  removeArtifact: (id: string) => void;

  // Selection actions
  setSelectedDivision: (id: string | null) => void;
  setSelectedDepartment: (id: string | null) => void;
  setSelectedTeam: (id: string | null) => void;
  setSelectedRoleTemplate: (id: string | null) => void;
  setSelectedAgent: (id: string | null) => void;
  setSelectedWorkItem: (id: string | null) => void;

  // Loading and error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;

  // Helpers
  getDivisionsForCompany: () => Division[];
  getDepartmentsForDivision: (divisionId: string) => Department[];
  getTeamsForDepartment: (departmentId: string) => Team[];
  getAgentsForTeam: (teamId: string) => AgentProfile[];
  getWorkItemsForTeam: (teamId: string) => WorkItem[];
  getArtifactsForWorkItem: (workItemId: string) => Artifact[];
}

const initialState = {
  currentCompany: null,
  selectedDivisionId: null,
  selectedDepartmentId: null,
  selectedTeamId: null,
  selectedRoleTemplateId: null,
  selectedAgentId: null,
  selectedWorkItemId: null,

  divisions: [],
  departments: [],
  teams: [],
  roleTemplates: [],
  agents: [],
  workItems: [],
  artifacts: [],

  isLoading: false,
  error: null,
};

export const useCompanyStore = create<CompanyState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Set collections
      setCompany: (company) =>
        set({ currentCompany: company }, false, 'setCompany'),

      setDivisions: (divisions) =>
        set({ divisions }, false, 'setDivisions'),

      setDepartments: (departments) =>
        set({ departments }, false, 'setDepartments'),

      setTeams: (teams) =>
        set({ teams }, false, 'setTeams'),

      setRoleTemplates: (roleTemplates) =>
        set({ roleTemplates }, false, 'setRoleTemplates'),

      setAgents: (agents) =>
        set({ agents }, false, 'setAgents'),

      setWorkItems: (workItems) =>
        set({ workItems }, false, 'setWorkItems'),

      setArtifacts: (artifacts) =>
        set({ artifacts }, false, 'setArtifacts'),

      // Add single items
      addDivision: (division) =>
        set((state) => ({
          divisions: [...state.divisions, division],
        }), false, 'addDivision'),

      addDepartment: (department) =>
        set((state) => ({
          departments: [...state.departments, department],
        }), false, 'addDepartment'),

      addTeam: (team) =>
        set((state) => ({
          teams: [...state.teams, team],
        }), false, 'addTeam'),

      addRoleTemplate: (template) =>
        set((state) => ({
          roleTemplates: [...state.roleTemplates, template],
        }), false, 'addRoleTemplate'),

      addAgent: (agent) =>
        set((state) => ({
          agents: [...state.agents, agent],
        }), false, 'addAgent'),

      addWorkItem: (workItem) =>
        set((state) => ({
          workItems: [...state.workItems, workItem],
        }), false, 'addWorkItem'),

      addArtifact: (artifact) =>
        set((state) => ({
          artifacts: [...state.artifacts, artifact],
        }), false, 'addArtifact'),

      // Update items
      updateDivision: (id, updates) =>
        set((state) => ({
          divisions: state.divisions.map((d) =>
            d.divisionId === id ? { ...d, ...updates } : d
          ),
        }), false, 'updateDivision'),

      updateDepartment: (id, updates) =>
        set((state) => ({
          departments: state.departments.map((d) =>
            d.departmentId === id ? { ...d, ...updates } : d
          ),
        }), false, 'updateDepartment'),

      updateTeam: (id, updates) =>
        set((state) => ({
          teams: state.teams.map((t) =>
            t.teamId === id ? { ...t, ...updates } : t
          ),
        }), false, 'updateTeam'),

      updateRoleTemplate: (id, updates) =>
        set((state) => ({
          roleTemplates: state.roleTemplates.map((r) =>
            r.roleTemplateId === id ? { ...r, ...updates } : r
          ),
        }), false, 'updateRoleTemplate'),

      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) =>
            a.agentId === id ? { ...a, ...updates } : a
          ),
        }), false, 'updateAgent'),

      updateWorkItem: (id, updates) =>
        set((state) => ({
          workItems: state.workItems.map((w) =>
            w.workItemId === id ? { ...w, ...updates } : w
          ),
        }), false, 'updateWorkItem'),

      updateArtifact: (id, updates) =>
        set((state) => ({
          artifacts: state.artifacts.map((a) =>
            a.artifactId === id ? { ...a, ...updates } : a
          ),
        }), false, 'updateArtifact'),

      // Remove items
      removeDivision: (id) =>
        set((state) => ({
          divisions: state.divisions.filter((d) => d.divisionId !== id),
          selectedDivisionId: state.selectedDivisionId === id ? null : state.selectedDivisionId,
        }), false, 'removeDivision'),

      removeDepartment: (id) =>
        set((state) => ({
          departments: state.departments.filter((d) => d.departmentId !== id),
          selectedDepartmentId: state.selectedDepartmentId === id ? null : state.selectedDepartmentId,
        }), false, 'removeDepartment'),

      removeTeam: (id) =>
        set((state) => ({
          teams: state.teams.filter((t) => t.teamId !== id),
          selectedTeamId: state.selectedTeamId === id ? null : state.selectedTeamId,
        }), false, 'removeTeam'),

      removeRoleTemplate: (id) =>
        set((state) => ({
          roleTemplates: state.roleTemplates.filter((r) => r.roleTemplateId !== id),
          selectedRoleTemplateId: state.selectedRoleTemplateId === id ? null : state.selectedRoleTemplateId,
        }), false, 'removeRoleTemplate'),

      removeAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.agentId !== id),
          selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId,
        }), false, 'removeAgent'),

      removeWorkItem: (id) =>
        set((state) => ({
          workItems: state.workItems.filter((w) => w.workItemId !== id),
          selectedWorkItemId: state.selectedWorkItemId === id ? null : state.selectedWorkItemId,
        }), false, 'removeWorkItem'),

      removeArtifact: (id) =>
        set((state) => ({
          artifacts: state.artifacts.filter((a) => a.artifactId !== id),
        }), false, 'removeArtifact'),

      // Selection actions
      setSelectedDivision: (id) =>
        set({ selectedDivisionId: id }, false, 'setSelectedDivision'),

      setSelectedDepartment: (id) =>
        set({ selectedDepartmentId: id }, false, 'setSelectedDepartment'),

      setSelectedTeam: (id) =>
        set({ selectedTeamId: id }, false, 'setSelectedTeam'),

      setSelectedRoleTemplate: (id) =>
        set({ selectedRoleTemplateId: id }, false, 'setSelectedRoleTemplate'),

      setSelectedAgent: (id) =>
        set({ selectedAgentId: id }, false, 'setSelectedAgent'),

      setSelectedWorkItem: (id) =>
        set({ selectedWorkItemId: id }, false, 'setSelectedWorkItem'),

      // Loading and error
      setLoading: (loading) =>
        set({ isLoading: loading }, false, 'setLoading'),

      setError: (error) =>
        set({ error }, false, 'setError'),

      // Reset
      reset: () => set(initialState, false, 'reset'),

      // Helpers
      getDivisionsForCompany: () => {
        const { currentCompany, divisions } = get();
        if (!currentCompany) return [];
        return divisions.filter((d) => d.companyId === currentCompany.companyId);
      },

      getDepartmentsForDivision: (divisionId) => {
        const { departments } = get();
        return departments.filter((d) => d.divisionId === divisionId);
      },

      getTeamsForDepartment: (departmentId) => {
        const { teams } = get();
        return teams.filter((t) => t.departmentId === departmentId);
      },

      getAgentsForTeam: (teamId) => {
        const { agents } = get();
        return agents.filter((a) => a.teamId === teamId);
      },

      getWorkItemsForTeam: (teamId) => {
        const { workItems } = get();
        return workItems.filter((w) => w.owningTeamId === teamId);
      },

      getArtifactsForWorkItem: (workItemId) => {
        const { artifacts } = get();
        return artifacts.filter((a) => a.sourceWorkItemId === workItemId);
      },
    }),
    { name: 'imceo-store' }
  )
);
