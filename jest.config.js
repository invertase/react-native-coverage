module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  modulePathIgnorePatterns: [
    '<rootDir>/example/node_modules',
    '<rootDir>/lib/',
    '<rootDir>/plugin/build/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.ts',
    '!src/cli/**',
    '!src/NativeCoverage.ts',
    '!src/index.tsx',
  ],
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['lcov', 'text-summary'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node',
          verbatimModuleSyntax: false,
          esModuleInterop: true,
        },
      },
    ],
  },
};
