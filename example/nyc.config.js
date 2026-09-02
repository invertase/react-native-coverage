/**
 * NYC config for example e2e JS coverage (instrumented by babel-plugin-istanbul).
 * Remaps Metro/Istanbul hits back to TypeScript sources when source maps exist.
 */
module.exports = {
  'check-coverage': false,
  'include': [
    'App.tsx',
    'index.ts',
    'src/**/*.{ts,tsx,js,jsx}',
    'fixture-lib/src/**/*.{ts,tsx}',
  ],
  'exclude': ['**/node_modules/**', '**/__tests__/**'],
  'cwd': __dirname,
  'sourceMap': true,
  'exclude-after-remap': true,
  'instrument': false,
  'reporter': ['lcov', 'text-summary', 'html'],
};
