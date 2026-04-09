import { vi } from 'vitest';
import {
  mockCompany,
  mockDivisions,
  mockDepartments,
  mockTeams,
  mockRoleTemplates,
  mockAgents,
  mockWorkItems,
  mockArtifacts,
} from './store';

// Mock API responses
export const mockApiResponses = {
  company: {
    create: vi.fn(() => Promise.resolve({ data: { data: mockCompany } })),
    get: vi.fn(() => Promise.resolve({ data: { data: mockCompany } })),
    list: vi.fn(() => Promise.resolve({ data: { data: [mockCompany] } })),
    update: vi.fn(() => Promise.resolve({ data: { data: mockCompany } })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },

  division: {
    create: vi.fn(() => Promise.resolve({ data: { data: mockDivisions[0] } })),
    get: vi.fn(() => Promise.resolve({ data: { data: mockDivisions[0] } })),
    list: vi.fn(() => Promise.resolve({ data: { data: mockDivisions } })),
    listByCompany: vi.fn(() => Promise.resolve({ data: { data: mockDivisions } })),
    update: vi.fn(() => Promise.resolve({ data: { data: mockDivisions[0] } })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },

  department: {
    create: vi.fn(() => Promise.resolve({ data: { data: mockDepartments[0] } })),
    get: vi.fn(() => Promise.resolve({ data: { data: mockDepartments[0] } })),
    list: vi.fn(() => Promise.resolve({ data: { data: mockDepartments } })),
    listByDivision: vi.fn(() => Promise.resolve({ data: { data: mockDepartments } })),
    update: vi.fn(() => Promise.resolve({ data: { data: mockDepartments[0] } })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },

  team: {
    create: vi.fn(() => Promise.resolve({ data: { data: mockTeams[0] } })),
    get: vi.fn(() => Promise.resolve({ data: { data: mockTeams[0] } })),
    list: vi.fn(() => Promise.resolve({ data: { data: mockTeams } })),
    listByDepartment: vi.fn(() => Promise.resolve({ data: { data: mockTeams } })),
    update: vi.fn(() => Promise.resolve({ data: { data: mockTeams[0] } })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },

  roleTemplate: {
    create: vi.fn(() => Promise.resolve({ data: { data: mockRoleTemplates[0] } })),
    get: vi.fn(() => Promise.resolve({ data: { data: mockRoleTemplates[0] } })),
    list: vi.fn(() => Promise.resolve({ data: { data: mockRoleTemplates } })),
    listByCompany: vi.fn(() => Promise.resolve({ data: { data: mockRoleTemplates } })),
    update: vi.fn(() => Promise.resolve({ data: { data: mockRoleTemplates[0] } })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },

  agentProfile: {
    create: vi.fn(() => Promise.resolve({ data: { data: mockAgents[0] } })),
    get: vi.fn(() => Promise.resolve({ data: { data: mockAgents[0] } })),
    list: vi.fn(() => Promise.resolve({ data: { data: mockAgents } })),
    listByTeam: vi.fn(() => Promise.resolve({ data: { data: mockAgents } })),
    update: vi.fn(() => Promise.resolve({ data: { data: mockAgents[0] } })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },

  workItem: {
    create: vi.fn(() => Promise.resolve({ data: { data: mockWorkItems[0] } })),
    get: vi.fn(() => Promise.resolve({ data: { data: mockWorkItems[0] } })),
    list: vi.fn(() => Promise.resolve({ data: { data: mockWorkItems } })),
    update: vi.fn(() => Promise.resolve({ data: { data: mockWorkItems[0] } })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    transition: vi.fn(() => Promise.resolve({ data: { data: { ...mockWorkItems[0], state: 'Done' } } })),
    getHistory: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    getBoard: vi.fn(() => Promise.resolve({
      data: {
        data: {
          Draft: [],
          Proposed: [],
          Approved: [],
          Planned: [],
          Ready: [],
          InProgress: [mockWorkItems[0]],
          WaitingOnDependency: [],
          InReview: [],
          ChangesRequested: [],
          InTest: [],
          AwaitingApproval: [],
          ApprovedForCompletion: [],
          Done: [mockWorkItems[1]],
          Archived: [],
          Reopened: [],
          Rejected: [],
          Cancelled: [],
          Blocked: [],
        },
      },
    })),
  },

  artifact: {
    create: vi.fn(() => Promise.resolve({ data: { data: mockArtifacts[0] } })),
    get: vi.fn(() => Promise.resolve({ data: { data: mockArtifacts[0] } })),
    list: vi.fn(() => Promise.resolve({ data: { data: mockArtifacts } })),
    update: vi.fn(() => Promise.resolve({ data: { data: mockArtifacts[0] } })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
};

// Helper to reset all mocks
export const resetApiMocks = () => {
  Object.values(mockApiResponses).forEach((api) => {
    Object.values(api).forEach((mock) => {
      if (typeof mock === 'function' && 'mockClear' in mock) {
        mock.mockClear();
      }
    });
  });
};
