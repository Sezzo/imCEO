import { cleanTestDatabase, disconnectTestDatabase, setupTestDatabase } from './database';

beforeAll(async () => await setupTestDatabase());
beforeEach(async () => await cleanTestDatabase());
afterAll(async () => await disconnectTestDatabase());
