import axios from 'axios';

export const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  organizationId: string;
  title: string;
  level: number;
  reportsTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  roleId: string;
  name: string;
  type: string;
  model: string;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrgRequest {
  name: string;
  description?: string;
}

export interface CreateRoleRequest {
  title: string;
  level: number;
  reportsTo?: string | null;
}

export interface UpdateRoleRequest {
  title?: string;
  level?: number;
  reportsTo?: string | null;
}

export const organizationApi = {
  create: (data: CreateOrgRequest) =>
    apiClient.post<{ organization: Organization }>('/organizations', data),

  get: (id: string) =>
    apiClient.get<{ organization: Organization }>(`/organizations/${id}`),

  list: () =>
    apiClient.get<{ organizations: Organization[] }>('/organizations'),

  update: (id: string, data: Partial<CreateOrgRequest>) =>
    apiClient.patch<{ organization: Organization }>(`/organizations/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/organizations/${id}`),
};

export const roleApi = {
  create: (orgId: string, data: CreateRoleRequest) =>
    apiClient.post<{ role: Role }>(`/organizations/${orgId}/roles`, data),

  list: (orgId: string) =>
    apiClient.get<{ roles: Role[] }>(`/organizations/${orgId}/roles`),

  update: (orgId: string, roleId: string, data: UpdateRoleRequest) =>
    apiClient.patch<{ role: Role }>(`/organizations/${orgId}/roles/${roleId}`, data),

  delete: (orgId: string, roleId: string) =>
    apiClient.delete(`/organizations/${orgId}/roles/${roleId}`),
};

export const agentApi = {
  listForRole: (orgId: string, roleId: string) =>
    apiClient.get<{ agents: Agent[] }>(`/organizations/${orgId}/roles/${roleId}/agents`),
};
