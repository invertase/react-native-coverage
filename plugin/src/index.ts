import type { ConfigPlugin } from 'expo/config-plugins';
import { createRunOncePlugin, withAppBuildGradle } from 'expo/config-plugins';

const PACKAGE_NAME = 'react-native-coverage';

/**
 * Expo config plugin — safe split (scaffold stub):
 * - Android: placeholder app-target Gradle notes (full Jacoco wiring later)
 * - iOS app-target: stable mods only in later items
 * - Pod LLVM flags: use the shipped Ruby helper (cocoapods/coverage_post_install.rb),
 *   not Podfile regex as the primary path.
 */
const withReactNativeCoverage: ConfigPlugin = (config) => {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      return cfg;
    }

    const marker =
      '// react-native-coverage: enable testCoverageEnabled in debug builds';
    if (!cfg.modResults.contents.includes(marker)) {
      cfg.modResults.contents += `\n${marker}\n`;
    }
    return cfg;
  });
};

export default createRunOncePlugin(
  withReactNativeCoverage,
  PACKAGE_NAME,
  '0.1.0'
);
