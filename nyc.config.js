/**
 * NYC config for package unit / library TypeScript sources (repo root).
 */
module.exports = {
  'check-coverage': false,
  'include': ['src/**/*.{ts,tsx}'],
  'exclude': ['**/__tests__/**', 'src/cli/**', '**/NativeCoverage.ts'],
  'cwd': __dirname,
  'sourceMap': true,
  'exclude-after-remap': true,
  'instrument': false,
  'reporter': ['lcov', 'text-summary', 'html'],
};
