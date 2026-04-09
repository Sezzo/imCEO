import axios from 'axios';

export const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// === Backend-aligned Types ===

export interface Company {
  companyId: string;
  name: string;
  description: string | null;
  industry: string | null;
  primaryObjective: string | null;
  operatingMode: string | null;
  globalPrompt: string | null;
  globalPolicies: unknown;
  globalSkills: unknown;
  globalMcps: unknown;
  globalPlugins: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Division {
  divisionId: string;
  companyId: string;
  name: string;
  description: string | null;
  parentDivisionId: string | null;
  headRoleId: string | null;
  policies: unknown;
  defaultWorkflows: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  departmentId: string;
  divisionId: string;
  name: string;
  description: string | null;
  headRoleId: string | null;
  scope: string | null;
  policies: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  teamId: string;
  departmentId: string;
  name: string;
  description: string | null;
  mission: string | null;
  teamType: string | null;
  leadRoleId: string | null;
  defaultModelProfileId: string | null;
  defaultSkillBundleId: string | null;
  defaultMcpBundleId: string | null;
  allowedInteractions: unknown;
  escalationChainId: string | null;
  costBudgetPolicyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleTemplate {
  roleTemplateId: string;
  companyId: string;
  name: string;
  hierarchyLevel: 'CEO' | 'Executive' | 'Management' | 'Lead' | 'Specialist' | 'Governance' | 'Observer';
  description: string | null;
  purpose: string | null;
  primaryResponsibilities: unknown;
  nonResponsibilities: unknown;
  decisionScope: unknown;
  escalationScope: unknown;
  requiredArtifacts: unknown;
  requiredReviews: unknown;
  defaultModelProfileId: string | null;
  defaultSkillBundleId: string | null;
  costClass: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProfile {
  agentId: string;
  teamId: string;
  roleTemplateId: string | null;
  displayName: string;
  internalName: string;
  seniority: string | null;
  status: 'active' | 'inactive' | 'suspended';
  customPromptOverride: string | null;
  maxParallelTasks: number;
  maxContextBudget: number | null;
  maxCostPerTask: number | null;
  createdAt: string;
  updatedAt: string;
}

// Work Item Types
export type WorkItemType = 'Vision' | 'Goal' | 'Initiative' | 'Program' | 'Workstream' | 'Epic' | 'Story' | 'Task' | 'Subtask' | 'Bug' | 'Spike' | 'ReviewTask' | 'TestTask' | 'ReleaseTask';
export type WorkItemState = 'Draft' | 'Proposed' | 'Approved' | 'Planned' | 'Ready' | 'InProgress' | 'WaitingOnDependency' | 'InReview' | 'ChangesRequested' | 'InTest' | 'AwaitingApproval' | 'ApprovedForCompletion' | 'Done' | 'Archived' | 'Reopened' | 'Rejected' | 'Cancelled' | 'Blocked';

export interface WorkItem {
  workItemId: string;
  type: WorkItemType;
  title: string;
  description: string | null;
  parentWorkItemId: string | null;
  companyId: string | null;
  divisionId: string | null;
  departmentId: string | null;
  owningTeamId: string | null;
  owningRoleId: string | null;
  assignedAgentId: string | null;
  priority: string | null;
  severity: string | null;
  state: WorkItemState;
  approvalState: string | null;
  riskScore: number | null;
  costLimit: number | null;
  estimatedEffort: number | null;
  actualEffort: number | null;
  createdAt: string;
  startedAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
}

// Artifact Types
export type ArtifactType = 'VisionBrief' | 'StrategicMemo' | 'GoalDefinition' | 'ArchitectureProposal' | 'ADR' | 'SystemDesign' | 'TechnicalSpec' | 'APIContract' | 'TaskBrief' | 'TestPlan' | 'TestReport' | 'ReviewReport' | 'DocumentationDraft' | 'ReleaseNotes' | 'SecurityReview' | 'ComplianceReport';
export type ArtifactStatus = 'Draft' | 'InPreparation' | 'UnderReview' | 'Approved' | 'Superseded' | 'Archived';

export interface Artifact {
  artifactId: string;
  type: ArtifactType;
  title: string;
  description: string | null;
  status: ArtifactStatus;
  version: string;
  ownerTeamId: string | null;
  ownerAgentId: string | null;
  sourceWorkItemId: string | null;
  content: string | null;
  contentHash: string | null;
  storageUri: string | null;
  approvalState: string | null;
  createdAt: string;
  updatedAt: string;
}

// === API Functions ===

export const companyApi = {
  create: (data: { name: string; description?: string; industry?: string }) =>
    apiClient.post<{ data: Company }>('/companies', data),

  get: (id: string) =>
    apiClient.get<{ data: Company }>(`/companies/${id}`),

  list: () =>
    apiClient.get<{ data: Company[] }>('/companies'),

  update: (id: string, data: Partial<Company>) =>
    apiClient.put<{ data: Company }>(`/companies/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/companies/${id}`),
};

export const divisionApi = {
  create: (data: { companyId: string; name: string; description?: string; parentDivisionId?: string }) =>
    apiClient.post<{ data: Division }>('/divisions', data),

  get: (id: string) =>
    apiClient.get<{ data: Division }>(`/divisions/${id}`),

  list: () =>
    apiClient.get<{ data: Division[] }>('/divisions'),

  listByCompany: (companyId: string) =>
    apiClient.get<{ data: Division[] }>(`/companies/${companyId}/divisions`),

  update: (id: string, data: Partial<Division>) =>
    apiClient.put<{ data: Division }>(`/divisions/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/divisions/${id}`),
};

export const departmentApi = {
  create: (data: { divisionId: string; name: string; description?: string }) =>
    apiClient.post<{ data: Department }>('/departments', data),

  get: (id: string) =>
    apiClient.get<{ data: Department }>(`/departments/${id}`),

  list: () =>
    apiClient.get<{ data: Department[] }>('/departments'),

  listByDivision: (divisionId: string) =>
    apiClient.get<{ data: Department[] }>(`/divisions/${divisionId}/departments`),

  update: (id: string, data: Partial<Department>) =>
    apiClient.put<{ data: Department }>(`/departments/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/departments/${id}`),
};

export const teamApi = {
  create: (data: { departmentId: string; name: string; description?: string; mission?: string }) =>
    apiClient.post<{ data: Team }>('/teams', data),

  get: (id: string) =>
    apiClient.get<{ data: Team }>(`/teams/${id}`),

  list: () =>
    apiClient.get<{ data: Team[] }>('/teams'),

  listByDepartment: (departmentId: string) =>
    apiClient.get<{ data: Team[] }>(`/departments/${departmentId}/teams`),

  update: (id: string, data: Partial<Team>) =>
    apiClient.put<{ data: Team }>(`/teams/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/teams/${id}`),
};

export const roleTemplateApi = {
  create: (data: { companyId: string; name: string; hierarchyLevel: RoleTemplate['hierarchyLevel']; description?: string }) =>
    apiClient.post<{ data: RoleTemplate }>('/role-templates', data),

  get: (id: string) =>
    apiClient.get<{ data: RoleTemplate }>(`/role-templates/${id}`),

  list: () =>
    apiClient.get<{ data: RoleTemplate[] }>('/role-templates'),

  listByCompany: (companyId: string) =>
    apiClient.get<{ data: RoleTemplate[] }>(`/companies/${companyId}/role-templates`),

  update: (id: string, data: Partial<RoleTemplate>) =>
    apiClient.put<{ data: RoleTemplate }>(`/role-templates/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/role-templates/${id}`),
};

export const agentProfileApi = {
  create: (data: { teamId: string; displayName: string; internalName: string; roleTemplateId?: string }) =>
    apiClient.post<{ data: AgentProfile }>('/agent-profiles', data),

  get: (id: string) =>
    apiClient.get<{ data: AgentProfile }>(`/agent-profiles/${id}`),

  list: () =>
    apiClient.get<{ data: AgentProfile[] }>('/agent-profiles'),

  listByTeam: (teamId: string) =>
    apiClient.get<{ data: AgentProfile[] }>(`/teams/${teamId}/agents`),

  update: (id: string, data: Partial<AgentProfile>) =>
    apiClient.put<{ data: AgentProfile }>(`/agent-profiles/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/agent-profiles/${id}`),
};

export const workItemApi = {
  create: (data: Omit<WorkItem, 'workItemId' | 'createdAt' | 'startedAt' | 'completedAt' | 'actualEffort' | 'state' | 'approvalState' | 'riskScore'>) =>
    apiClient.post<{ data: WorkItem }>('/work-items', data),

  get: (id: string) =>
    apiClient.get<{ data: WorkItem }>(`/work-items/${id}`),

  list: (filters?: { state?: string; type?: string; teamId?: string }) =>
    apiClient.get<{ data: WorkItem[] }>('/work-items', { params: filters }),

  update: (id: string, data: Partial<WorkItem>) =>
    apiClient.put<{ data: WorkItem }>(`/work-items/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/work-items/${id}`),

  transition: (id: string, toState: WorkItemState, reason?: string) =>
    apiClient.post<{ data: WorkItem }>(`/work-items/${id}/transition`, { toState, reason }),

  getHistory: (id: string) =>
    apiClient.get<{ data: unknown[] }>(`/work-items/${id}/history`),

  getBoard: () =>
    apiClient.get<{ data: Record<WorkItemState, WorkItem[]> }>('/work-items/board'),
};

export const artifactApi = {
  create: (data: { type: ArtifactType; title: string; description?: string; content?: string; ownerTeamId?: string; sourceWorkItemId?: string }) =>
    apiClient.post<{ data: Artifact }>('/artifacts', data),

  get: (id: string) =>
    apiClient.get<{ data: Artifact }>(`/artifacts/${id}`),

  list: (filters?: { type?: string; status?: string; workItemId?: string }) =>
    apiClient.get<{ data: Artifact[] }>('/artifacts', { params: filters }),

  update: (id: string, data: Partial<Artifact>) =>
    apiClient.put<{ data: Artifact }>(`/artifacts/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/artifacts/${id}`),
};

// Legacy exports for backward compatibility during migration
export type Organization = Company;
export type Role = RoleTemplate;
export type Agent = AgentProfile;
export const organizationApi = companyApi;
export const roleApi = roleTemplateApi;
export const agentApi = agentProfileApi;
