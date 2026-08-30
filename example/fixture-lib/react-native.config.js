module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath:
          'import com.coverage.fixture.CoverageFixturePackage;',
        packageInstance: 'new CoverageFixturePackage()',
      },
      ios: {},
    },
  },
};
