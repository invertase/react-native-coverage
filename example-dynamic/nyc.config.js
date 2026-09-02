module.exports = {
  'check-coverage': false,
  'include': ['App.tsx', 'index.js', 'src/**/*.{ts,tsx,js,jsx}'],
  'exclude': ['**/node_modules/**'],
  'cwd': __dirname,
  'sourceMap': true,
  'exclude-after-remap': true,
  'instrument': false,
  'reporter': ['lcov', 'text-summary', 'html'],
};
