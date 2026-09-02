module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  // Instrument Metro bundles for Istanbul when RN_COVERAGE_JS=1 (e2e CI).
  if (process.env.RN_COVERAGE_JS === '1') {
    plugins.push('istanbul');
  }
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
