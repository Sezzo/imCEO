import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Deep mock type for Prisma
export type PrismaMock = {
  [K in keyof PrismaClient]: PrismaClient[K] extends (...args: any[]) => any
    ? vi.Mock
    : PrismaMock;
};

// Create a mock factory function
const createPrismaMock = () => {
  const mock: any = {};

  // List all Prisma models that need mocking
  const models = [
    'company',
    'division',
    'department',
    'team',
    'roleTemplate',
    'agentProfile',
    'workItem',
    'workItemHistory',
    'artifact',
    'review',
    'policy',
    'approvalRequest',
    'teamSession',
    'agentSession',
    'modelProfile',
    'reportingLine',
    'escalationChain',
    'escalationEvent',
    'auditEvent',
    'costRecord',
    'delegation',
    'skillDefinition',
    'skillBundle',
    'skillBundleItem',
    'skillAssignment',
    'mcpDefinition',
    'mcpBundle',
    'mcpBundleItem',
    'mcpAssignment',
    'pluginDefinition',
    'pluginBundle',
    'pluginBundleItem',
    'pluginAssignment',
    'policyViolation',
    'costBudget',
  ];

  for (const model of models) {
    mock[model] = {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    };
  }

  // Add transaction methods - will be defined after mock creation
  mock.$transaction = vi.fn();
  mock.$connect = vi.fn();
  mock.$disconnect = vi.fn();
  mock.$queryRaw = vi.fn();
  mock.$executeRaw = vi.fn();
  mock.$queryRawUnsafe = vi.fn();
  mock.$executeRawUnsafe = vi.fn();

  return mock as PrismaMock;
};

// Create the mock
export const prismaMock = createPrismaMock();

// Define $transaction implementation separately to ensure proper scoping
prismaMock.$transaction.mockImplementation((args: any): Promise<any[]> => {
  // If called with array, return a promise that resolves to array
  if (Array.isArray(args)) {
    // Create a promise chain that resolves each promise and collects results
    return new Promise((resolve) => {
      const results: any[] = [];
      let index = 0;

      function processNext(): void {
        if (index >= args.length) {
          resolve(results);
          return;
        }
        const promise = Promise.resolve(args[index]);
        index++;
        promise.then((result) => {
          results.push(result);
          processNext();
        });
      }

      processNext();
    });
  }
  // If called with callback, execute callback
  if (typeof args === 'function') {
    return Promise.resolve(args(prismaMock));
  }
  return Promise.resolve([]);
});

// Store reference to mock for database config
let mockPrismaInstance: any = null;

export function setMockPrisma(instance: any) {
  mockPrismaInstance = instance;
}

export function getMockPrisma() {
  return mockPrismaInstance;
}

// Define enums as string constants for SQLite compatibility
const WorkItemType = {
  Vision: 'Vision',
  Goal: 'Goal',
  Epic: 'Epic',
  Feature: 'Feature',
  Story: 'Story',
  Task: 'Task',
  Bug: 'Bug',
  Improvement: 'Improvement',
  Spike: 'Spike',
};

const WorkItemState = {
  Draft: 'Draft',
  Proposed: 'Proposed',
  Ready: 'Ready',
  Approved: 'Approved',
  InProgress: 'InProgress',
  WaitingOnDependency: 'WaitingOnDependency',
  InReview: 'InReview',
  ChangesRequested: 'ChangesRequested',
  ApprovedForCompletion: 'ApprovedForCompletion',
  Done: 'Done',
  Cancelled: 'Cancelled',
};

const ArtifactType = {
  Document: 'Document',
  TechnicalSpec: 'TechnicalSpec',
  Architecture: 'Architecture',
  Design: 'Design',
  Code: 'Code',
  TestPlan: 'TestPlan',
  TestCase: 'TestCase',
  TestResult: 'TestResult',
  Review: 'Review',
  MeetingNotes: 'MeetingNotes',
  Decision: 'Decision',
  Policy: 'Policy',
};

const ArtifactStatus = {
  Draft: 'Draft',
  InReview: 'InReview',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Archived: 'Archived',
};

const PolicyType = {
  AccessControl: 'AccessControl',
  ApprovalWorkflow: 'ApprovalWorkflow',
  CostLimit: 'CostLimit',
  Escalation: 'Escalation',
  Audit: 'Audit',
  Compliance: 'Compliance',
};

const PolicyAction = {
  RequireApproval: 'RequireApproval',
  AutoApprove: 'AutoApprove',
  AutoReject: 'AutoReject',
  RequireReview: 'RequireReview',
  Notify: 'Notify',
};

const ReviewType = {
  Technical: 'Technical',
  Design: 'Design',
  Code: 'Code',
  Test: 'Test',
  Documentation: 'Documentation',
};

const ReviewResult = {
  Approved: 'Approved',
  Rejected: 'Rejected',
  NeedsChanges: 'NeedsChanges',
};

const ApprovalRequestState = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Escalated: 'Escalated',
};

const AuditEventType = {
  Create: 'Create',
  Update: 'Update',
  Delete: 'Delete',
  Read: 'Read',
};

const AuditSeverity = {
  Info: 'Info',
  Warning: 'Warning',
  Error: 'Error',
  Critical: 'Critical',
};

const DelegationType = {
  Full: 'Full',
  Partial: 'Partial',
};

const DelegationState = {
  Active: 'Active',
  Expired: 'Expired',
  Revoked: 'Revoked',
};

const EscalationTrigger = {
  CostExceeded: 'CostExceeded',
  TimeExceeded: 'TimeExceeded',
  FailedAttempts: 'FailedAttempts',
  Manual: 'Manual',
};

const EscalationState = {
  Active: 'Active',
  Resolved: 'Resolved',
  Ignored: 'Ignored',
};

const ReportingLineType = {
  Direct: 'Direct',
  Dotted: 'Dotted',
  Matrix: 'Matrix',
};

// Mock the PrismaClient
vi.mock('@prisma/client', async (importOriginal) => {
  return {
    PrismaClient: vi.fn(() => {
      const mock = getMockPrisma() || {};
      return mock;
    }),
    // Export all enums
    WorkItemType,
    WorkItemState,
    ArtifactType,
    ArtifactStatus,
    PolicyType,
    PolicyAction,
    ReviewType,
    ReviewResult,
    ApprovalRequestState,
    AuditEventType,
    AuditSeverity,
    DelegationType,
    DelegationState,
    EscalationTrigger,
    EscalationState,
    ReportingLineType,
  };
});

// Mock the database config - using factory that returns the mock
vi.mock('../src/config/database', async (importOriginal) => {
  return {
    get prisma() {
      return getMockPrisma() || {};
    },
    disconnectDatabase: vi.fn(),
  };
});

// Set the mock instance after creation
setMockPrisma(prismaMock);

// Reset all mocks before each test (but preserve implementations)
beforeEach(() => {
  vi.clearAllMocks();
});

// Re-apply $transaction implementation after each reset
beforeEach(() => {
  prismaMock.$transaction.mockImplementation((args: any): Promise<any[]> => {
    // If called with array, return a promise that resolves to array
    if (Array.isArray(args)) {
      return new Promise((resolve) => {
        const results: any[] = [];
        let index = 0;

        function processNext(): void {
          if (index >= args.length) {
            resolve(results);
            return;
          }
          const promise = Promise.resolve(args[index]);
          index++;
          promise.then((result) => {
            results.push(result);
            processNext();
          });
        }

        processNext();
      });
    }
    // If called with callback, execute callback
    if (typeof args === 'function') {
      return Promise.resolve(args(prismaMock));
    }
    return Promise.resolve([]);
  });
});
