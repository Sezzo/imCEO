import { PrismaClient } from '@prisma/client';
import path from 'path';

// Set test environment variables BEFORE importing anything else
process.env.NODE_ENV = 'test';
const TEST_DB_PATH = path.join(process.cwd(), 'tests', 'test.db');
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
process.env.JWT_SECRET = 'test-secret-key';
process.env.LOG_LEVEL = 'error';

// Now import Fastify and routes
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

// Import all routes
import { healthRoutes } from '../../src/interface/http/routes/health.routes';
import { companyRoutes } from '../../src/interface/http/routes/company.routes';
import { divisionRoutes } from '../../src/interface/http/routes/division.routes';
import { departmentRoutes } from '../../src/interface/http/routes/department.routes';
import { teamRoutes } from '../../src/interface/http/routes/team.routes';
import { roleTemplateRoutes } from '../../src/interface/http/routes/role-template.routes';
import { agentProfileRoutes } from '../../src/interface/http/routes/agent-profile.routes';
import { workItemRoutes } from '../../src/interface/http/routes/work-item.routes';
import { artifactRoutes } from '../../src/interface/http/routes/artifact.routes';
import { policyRoutes } from '../../src/interface/http/routes/policy.routes';
import { sessionRoutes } from '../../src/interface/http/routes/sessions.routes';

// Create test Prisma client - uses SQLite from environment
export const testPrisma = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: `file:${TEST_DB_PATH}`,
    },
  },
});

// Check if database is available (always true for SQLite)
let databaseAvailable = false;
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await testPrisma.$connect();
    await testPrisma.$queryRaw`SELECT 1`;
    databaseAvailable = true;
    return true;
  } catch (error) {
    databaseAvailable = false;
    console.warn('Database not available, skipping integration tests');
    return false;
  }
}

export function isDatabaseAvailable(): boolean {
  return databaseAvailable;
}

// Build test server
export async function buildTestServer() {
  const server = Fastify({
    logger: false, // Disable logging for tests
  });

  // Register minimal plugins
  await server.register(cors, {
    origin: '*',
    credentials: true,
  });

  await server.register(helmet);

  // Register routes
  await server.register(healthRoutes, { prefix: '/api/v1' });
  await server.register(companyRoutes, { prefix: '/api/v1' });
  await server.register(divisionRoutes, { prefix: '/api/v1' });
  await server.register(departmentRoutes, { prefix: '/api/v1' });
  await server.register(teamRoutes, { prefix: '/api/v1' });
  await server.register(roleTemplateRoutes, { prefix: '/api/v1' });
  await server.register(agentProfileRoutes, { prefix: '/api/v1' });
  await server.register(workItemRoutes, { prefix: '/api/v1' });
  await server.register(artifactRoutes, { prefix: '/api/v1' });
  await server.register(policyRoutes, { prefix: '/api/v1' });
  await server.register(sessionRoutes, { prefix: '/api/v1' });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
      });
    }

    reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: error.name,
      message: error.message,
    });
  });

  // Not found handler
  server.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
    });
  });

  return server;
}

// Clean database helper
export async function cleanDatabase() {
  if (!databaseAvailable) {
    return;
  }

  try {
    // Delete in reverse order of dependencies
    await testPrisma.agentSession.deleteMany();
    await testPrisma.teamSession.deleteMany();
    await testPrisma.approvalRequest.deleteMany();
    await testPrisma.review.deleteMany();
    await testPrisma.artifact.deleteMany();
    await testPrisma.workItemHistory.deleteMany();
    await testPrisma.workItem.deleteMany();
    await testPrisma.agentProfile.deleteMany();
    await testPrisma.roleTemplate.deleteMany();
    await testPrisma.team.deleteMany();
    await testPrisma.department.deleteMany();
    await testPrisma.division.deleteMany();
    await testPrisma.policy.deleteMany();
    await testPrisma.company.deleteMany();
  } catch (error) {
    console.warn('Failed to clean database:', error);
  }
}

// Seed test data helpers
export async function createTestCompany(data?: Partial<any>) {
  if (!databaseAvailable) {
    throw new Error('Database not available');
  }

  return testPrisma.company.create({
    data: {
      name: 'Test Company',
      description: 'A test company',
      industry: 'Technology',
      ...data,
    },
  });
}

export async function createTestDivision(companyId: string, data?: Partial<any>) {
  if (!databaseAvailable) {
    throw new Error('Database not available');
  }

  return testPrisma.division.create({
    data: {
      companyId,
      name: 'Test Division',
      description: 'A test division',
      ...data,
    },
  });
}

export async function createTestDepartment(divisionId: string, data?: Partial<any>) {
  if (!databaseAvailable) {
    throw new Error('Database not available');
  }

  return testPrisma.department.create({
    data: {
      divisionId,
      name: 'Test Department',
      description: 'A test department',
      ...data,
    },
  });
}

export async function createTestTeam(departmentId: string, data?: Partial<any>) {
  if (!databaseAvailable) {
    throw new Error('Database not available');
  }

  return testPrisma.team.create({
    data: {
      departmentId,
      name: 'Test Team',
      description: 'A test team',
      ...data,
    },
  });
}

export async function createTestRoleTemplate(companyId: string, data?: Partial<any>) {
  if (!databaseAvailable) {
    throw new Error('Database not available');
  }

  return testPrisma.roleTemplate.create({
    data: {
      companyId,
      name: 'Test Role',
      hierarchyLevel: 'Specialist',
      description: 'A test role template',
      ...data,
    },
  });
}

export async function createTestAgentProfile(teamId: string, data?: Partial<any>) {
  if (!databaseAvailable) {
    throw new Error('Database not available');
  }

  return testPrisma.agentProfile.create({
    data: {
      teamId,
      displayName: 'Test Agent',
      internalName: 'test-agent',
      ...data,
    },
  });
}
