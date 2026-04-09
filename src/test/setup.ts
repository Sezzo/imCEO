// Jest setup file - runs before each test file
import './singleton';

// Increase timeout for async tests
jest.setTimeout(10000);

// Global test utilities
global.describeIf = (condition: boolean) => condition ? describe : describe.skip;
global.itIf = (condition: boolean) => condition ? it : it.skip;
