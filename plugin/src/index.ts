import type { ConfigPlugin } from 'expo/config-plugins';
import {
  createRunOncePlugin,
  withAppBuildGradle,
  withDangerousMod,
  withPodfileProperties,
} from 'expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

const PACKAGE_NAME = 'react-native-coverage';

const PODFILE_MARKER = '# react-native-coverage: post_install coverage flags';

/**
 * Expo config plugin — safe split:
 * - Android: enable testCoverageEnabled on debug app builds (minimal wiring)
 * - iOS: dynamic frameworks (primary multi-image cell) + Podfile Ruby helper
 * Full Gradle/CocoaPods polish is a later build-integration item.
 */
const withReactNativeCoverage: ConfigPlugin = (config) => {
  // Primary proof cell is iOS dynamic frameworks (mode-c LINKEDIT). Static remains a later CI cell.
  config = withPodfileProperties(config, (cfg) => {
    cfg.modResults['ios.useFrameworks'] = 'dynamic';
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      return cfg;
    }

    const marker =
      '// react-native-coverage: enable testCoverageEnabled in debug builds';
    if (!cfg.modResults.contents.includes(marker)) {
      // Prefer injecting into android.buildTypes.debug when present.
      if (
        cfg.modResults.contents.includes('buildTypes') &&
        cfg.modResults.contents.includes('debug')
      ) {
        cfg.modResults.contents = cfg.modResults.contents.replace(
          /debug\s*\{/,
          `debug {\n            testCoverageEnabled true\n            ${marker}`
        );
      } else {
        cfg.modResults.contents += `\n${marker}\n`;
      }
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return cfg;
      }
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(PODFILE_MARKER)) {
        return cfg;
      }

      const requireLine =
        "require_relative '../node_modules/react-native-coverage/cocoapods/coverage_post_install'\n";

      if (!contents.includes('coverage_post_install')) {
        contents = requireLine + contents;
      }

      const helperCall = `
  ${PODFILE_MARKER}
  ReactNativeCoverage.apply_post_install!(installer, framework_name_prefixes: ['CoverageFixture'])
`;

      if (contents.includes('post_install do |installer|')) {
        contents = contents.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${helperCall}`
        );
      } else {
        contents += `
post_install do |installer|
${helperCall}
end
`;
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);

  return config;
};

export default createRunOncePlugin(
  withReactNativeCoverage,
  PACKAGE_NAME,
  '0.1.0'
);
