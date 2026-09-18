const path = require('path');

/**
 * NYC config for example e2e JS coverage (instrumented by babel-plugin-istanbul).
 * Remaps Metro/Istanbul hits back to TypeScript sources when source maps exist.
 * Rooted at the monorepo so both cells emit workspace-relative SF: paths.
 */
module.exports = {
  'check-coverage': false,
  'include': [
    'example/App.tsx',
    'example/index.ts',
    'example/src/**/*.{ts,tsx,js,jsx}',
    'example/fixture-lib/src/**/*.{ts,tsx}',
  ],
  'exclude': ['**/node_modules/**', '**/__tests__/**'],
  'cwd': path.resolve(__dirname, '..'),
  'sourceMap': true,
  'exclude-after-remap': true,
  'instrument': false,
  'reporter': ['lcov', 'text-summary', 'html'],
};
