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

  // Add transaction methods
  mock.$transaction = vi.fn((cb: any) => cb(mock));
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

// Mock the PrismaClient
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn(() => prismaMock),
  };
});

// Reset all mocks before each test
beforeEach(() => {
  vi.resetAllMocks();
});
