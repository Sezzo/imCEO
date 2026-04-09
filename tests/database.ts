import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

const TEST_DB_PATH = path.join(process.cwd(), 'tests', 'test.db');
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

export const testPrisma = new PrismaClient({
  datasources: { db: { url: `file:${TEST_DB_PATH}` } },
});

export async function setupTestDatabase() {
  try {
    execSync('npx prisma db push --schema=prisma/schema.test.prisma --accept-data-loss', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
    });
  } catch (error) {
    execSync('npx prisma migrate dev --schema=prisma/schema.test.prisma --name init', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
    });
  }
}

export async function cleanTestDatabase() {
  const tables = ['agent_session', 'team_session', 'approval_request', 'review', 'artifact', 'work_item_history', 'work_item', 'agent_profile', 'role_template', 'team', 'department', 'division', 'policy', 'company'];
  for (const table of tables) {
    try { await testPrisma.$executeRawUnsafe(`DELETE FROM ${table}`); } catch (e) {}
  }
}

export async function disconnectTestDatabase() {
  await testPrisma.$disconnect();
}
