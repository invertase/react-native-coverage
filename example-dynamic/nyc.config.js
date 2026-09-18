const path = require('path');

/**
 * Keep this aligned with example/nyc.config.js and both babel configs: the
 * fixture workspace is outside this harness, so instrumentation and remap are
 * both rooted at the monorepo. SF: paths come out workspace-relative.
 */
module.exports = {
  'check-coverage': false,
  'include': [
    'example-dynamic/App.tsx',
    'example-dynamic/index.js',
    'example-dynamic/src/**/*.{ts,tsx,js,jsx}',
    'example/fixture-lib/src/**/*.{ts,tsx}',
  ],
  'exclude': ['**/node_modules/**', '**/__tests__/**'],
  'cwd': path.resolve(__dirname, '..'),
  'sourceMap': true,
  'exclude-after-remap': true,
  'instrument': false,
  'reporter': ['lcov', 'text-summary', 'html'],
};
