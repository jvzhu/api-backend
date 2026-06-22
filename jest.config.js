/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/types/**/*.d.ts'],
  coverageDirectory: 'coverage',
  clearMocks: true,
};
