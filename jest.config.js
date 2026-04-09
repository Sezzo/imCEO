/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      diagnostics: {
        warnOnly: true,
      },
    }],
  },
  collectCoverageFrom: [
    'src/application/services/company.service.ts',
    'src/application/services/division.service.ts',
    'src/application/services/department.service.ts',
    'src/application/services/team.service.ts',
    'src/application/services/role-template.service.ts',
    'src/application/services/agent-profile.service.ts',
    'src/application/services/work-item.service.ts',
    'src/application/services/artifact.service.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
