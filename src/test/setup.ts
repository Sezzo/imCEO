// Vitest setup file - runs before each test file
import './singleton';

// Global test utilities
(globalThis as any).describeIf = (condition: boolean) => condition ? describe : describe.skip;
(globalThis as any).itIf = (condition: boolean) => condition ? it : it.skip;
