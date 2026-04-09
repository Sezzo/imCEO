// Vitest setup file - runs before each test file
import './singleton';

// Global test utilities
global.describeIf = (condition: boolean) => condition ? describe : describe.skip;
global.itIf = (condition: boolean) => condition ? it : it.skip;
