const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');

module.exports = function (api) {
  // RN_COVERAGE_JS must invalidate the cached config, not stick from first use.
  api.cache.using(() => process.env.RN_COVERAGE_JS);
  const plugins = [];
  if (process.env.RN_COVERAGE_JS === '1') {
    // coverage-fixture symlinks out to example/fixture-lib, so Metro hands
    // babel a realpath outside this harness. Root istanbul at the workspace
    // or the shared fixture sources are silently left uninstrumented.
    plugins.push([
      'istanbul',
      {
        cwd: workspaceRoot,
        include: [
          'example-dynamic/App.tsx',
          'example-dynamic/index.js',
          'example-dynamic/src/**/*.{ts,tsx,js,jsx}',
          'example/fixture-lib/src/**/*.{ts,tsx}',
        ],
      },
    ]);
  }
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins,
  };
};
