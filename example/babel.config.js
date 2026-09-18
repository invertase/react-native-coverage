const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');

module.exports = function (api) {
  // RN_COVERAGE_JS must invalidate the cached config, not stick from first use.
  api.cache.using(() => process.env.RN_COVERAGE_JS);
  const plugins = [];
  // Instrument Metro bundles for Istanbul when RN_COVERAGE_JS=1 (e2e CI).
  // Scope matches example-dynamic so both cells emit workspace-relative paths.
  if (process.env.RN_COVERAGE_JS === '1') {
    plugins.push([
      'istanbul',
      {
        cwd: workspaceRoot,
        include: [
          'example/App.tsx',
          'example/index.ts',
          'example/src/**/*.{ts,tsx,js,jsx}',
          'example/fixture-lib/src/**/*.{ts,tsx}',
        ],
      },
    ]);
  }
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
