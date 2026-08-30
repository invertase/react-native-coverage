/**
 * Example harness config (Pattern C).
 */
module.exports = {
  nativeModuleName: 'Coverage',
  app: {
    androidApplicationId: 'com.example.coverage',
    iosBundleId: 'com.example.coverage',
    iosProductName: 'CoverageExample',
  },
  ios: {
    frameworkNamePrefixes: ['CoverageFixture'],
  },
  android: {
    libraryProjectMatchers: ['coverage-fixture'],
    detoxStagingPath: '/data/local/tmp/coverage/coverage.ec',
    coverageRelativePath: 'files/coverage.ec',
    jacocoReportXml:
      'android/app/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml',
  },
  sourcePathRewrite: [
    { kind: 'after-marker', marker: '/fixture-lib/', includeMarker: true },
  ],
  strict: true,
  assert: {
    lcovPathIncludes: ['fixture-lib', 'CoverageFixture'],
    jacocoPackageIncludes: ['coverage.fixture'],
    defaultLcovPath: 'coverage/ios/lcov.info',
    defaultJacocoXmlPath:
      'android/app/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml',
  },
};
