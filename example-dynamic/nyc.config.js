/**
 * Keep this aligned with example/nyc.config.js. The fixture workspace is
 * outside this harness cwd but is bundled and exercised by the dynamic cell.
 */
module.exports = {
  'check-coverage': false,
  'include': [
    'App.tsx',
    'index.js',
    'src/**/*.{ts,tsx,js,jsx}',
    '../example/fixture-lib/src/**/*.{ts,tsx}',
    'coverage-fixture/**/*.{ts,tsx}',
    'node_modules/coverage-fixture/**/*.{ts,tsx}',
  ],
  'exclude': [
    '**/node_modules/**',
    '!**/node_modules/coverage-fixture/**',
    '**/__tests__/**',
  ],
  'cwd': __dirname,
  'sourceMap': true,
  'exclude-after-remap': true,
  'instrument': false,
  'reporter': ['lcov', 'text-summary', 'html'],
};
