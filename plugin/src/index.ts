import type { ConfigPlugin } from 'expo/config-plugins';
import {
  createRunOncePlugin,
  withAppBuildGradle,
  withDangerousMod,
  withPodfileProperties,
  withProjectBuildGradle,
} from 'expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

const PACKAGE_NAME = 'react-native-coverage';

/** Bump when Podfile injection shape changes so re-prebuild rewrites. */
const PODFILE_MARKER = '# react-native-coverage: post_install coverage flags';
const ROOT_GRADLE_MARKER = '// react-native-coverage: root instrumentation';
const APP_GRADLE_MARKER = '// react-native-coverage: app jacoco report';
const APP_DEBUG_MARKER =
  '// react-native-coverage: enable testCoverageEnabled in debug builds';

export type ReactNativeCoveragePluginProps = {
  /** iOS Mach-O / framework basename prefixes for multi-image LINKEDIT flush. */
  frameworkNamePrefixes?: string[];
  /** Android Gradle project-name substrings to instrument + report. */
  libraryProjectMatchers?: string[];
  /**
   * Restore Coverage / fixture pods as dynamic frameworks after Expo's
   * React-Core staticlib downgrade.
   *
   * Default **false** for Expo: Expo forces React-Core (and many RN pods) to
   * static libraries, so dynamic Coverage* pods fail CocoaPods' transitive
   * static→dynamic check. Set true on bare RN / RNFB hosts that build React
   * as dynamic frameworks (primary multi-image LINKEDIT cell).
   */
  forceDynamicFrameworks?: boolean;
  /** Wire Gradle helpers + testCoverageEnabled. Default true. */
  enableAndroidCoverage?: boolean;
};

const DEFAULT_PREFIXES = ['CoverageFixture'];
const DEFAULT_MATCHERS = ['coverage-fixture', 'react-native-coverage'];

function resolvePackageRootGroovy(): string {
  return (
    'new File(["node", "--print", ' +
    `"require.resolve('${PACKAGE_NAME}/package.json')"` +
    '].execute(null, rootDir).text.trim()).getParentFile()'
  );
}

/**
 * Expo config plugin — safe split:
 * - Android: root instrumentation helper + app Jacoco report + testCoverageEnabled
 * - iOS: dynamic frameworks (Podfile.properties) + Ruby helper require/call
 * - Pod LLVM flags + dynamic-framework restore: shipped Ruby helper (not regex)
 */
const withReactNativeCoverage: ConfigPlugin<
  ReactNativeCoveragePluginProps | void
> = (config, props) => {
  const frameworkNamePrefixes = props?.frameworkNamePrefixes?.length
    ? props.frameworkNamePrefixes
    : DEFAULT_PREFIXES;
  const libraryProjectMatchers = props?.libraryProjectMatchers?.length
    ? props.libraryProjectMatchers
    : DEFAULT_MATCHERS;
  const forceDynamicFrameworks = props?.forceDynamicFrameworks === true;
  const enableAndroidCoverage = props?.enableAndroidCoverage !== false;

  // Primary proof cell is iOS dynamic frameworks (mode-c LINKEDIT).
  config = withPodfileProperties(config, (cfg) => {
    cfg.modResults['ios.useFrameworks'] = 'dynamic';
    return cfg;
  });

  if (enableAndroidCoverage) {
    config = withProjectBuildGradle(config, (cfg) => {
      if (cfg.modResults.language !== 'groovy') {
        return cfg;
      }
      if (cfg.modResults.contents.includes(ROOT_GRADLE_MARKER)) {
        return cfg;
      }

      const matchersLiteral = libraryProjectMatchers
        .map((m) => `'${m.replace(/'/g, "\\'")}'`)
        .join(', ');

      const snippet = `
${ROOT_GRADLE_MARKER}
ext.coverageLibraryProjectMatchers = [${matchersLiteral}]
def rnCoverageRoot = ${resolvePackageRootGroovy()}
apply from: new File(rnCoverageRoot, "android/rn-coverage.gradle")
`;

      cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${snippet}\n`;
      return cfg;
    });

    config = withAppBuildGradle(config, (cfg) => {
      if (cfg.modResults.language !== 'groovy') {
        return cfg;
      }

      if (!cfg.modResults.contents.includes(APP_DEBUG_MARKER)) {
        // Prefer buildTypes.debug — do NOT match signingConfigs.debug.
        if (
          /buildTypes\s*\{[\s\S]*?\bdebug\s*\{/.test(cfg.modResults.contents)
        ) {
          cfg.modResults.contents = cfg.modResults.contents.replace(
            /(buildTypes\s*\{[\s\S]*?\bdebug\s*\{)/,
            `$1\n            testCoverageEnabled true\n            ${APP_DEBUG_MARKER}`
          );
        } else {
          cfg.modResults.contents += `\n${APP_DEBUG_MARKER}\n`;
        }
      }

      if (!cfg.modResults.contents.includes(APP_GRADLE_MARKER)) {
        const snippet = `
${APP_GRADLE_MARKER}
def rnCoverageRoot = ${resolvePackageRootGroovy()}
apply from: new File(rnCoverageRoot, "android/rn-coverage-jacoco.gradle")
`;
        cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${snippet}\n`;
      }

      return cfg;
    });
  }

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'Podfile'
      );
      if (!fs.existsSync(podfilePath)) {
        return cfg;
      }
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Skip only when the full helper shape is already present.
      if (
        contents.includes(PODFILE_MARKER) &&
        contents.includes('force_dynamic_frameworks:') &&
        contents.includes('install_installer_hooks!')
      ) {
        return cfg;
      }

      const requireLine =
        "require_relative '../node_modules/react-native-coverage/cocoapods/coverage_post_install'\n";

      if (!contents.includes('coverage_post_install')) {
        contents = requireLine + contents;
      }

      // Strip older helper injection so we can rewrite cleanly.
      contents = contents.replace(
        /\n?[ \t]*# react-native-coverage: post_install coverage flags(?: \(05C4\))?\n[ \t]*ReactNativeCoverage\.apply_post_install!\([\s\S]*?\)\n?/g,
        '\n'
      );
      contents = contents.replace(
        /\n?[ \t]*ReactNativeCoverage\.install_installer_hooks!\n?/g,
        '\n'
      );
      contents = contents.replace(
        /\n?[ \t]*ReactNativeCoverage\.install_installer_hooks!\([\s\S]*?\)\n?/g,
        '\n'
      );

      const prefixesRuby = frameworkNamePrefixes
        .map((p) => `'${p.replace(/'/g, "\\'")}'`)
        .join(', ');

      const hooksLine = `
# react-native-coverage: wrap Installer after Expo use_expo_modules! patch
ReactNativeCoverage.install_installer_hooks!(
  force_dynamic_frameworks: ${forceDynamicFrameworks}
)
`;

      // Must run AFTER react_native_post_install so RN does not wipe OTHER_CFLAGS.
      const helperCall = `
  ${PODFILE_MARKER}
  ReactNativeCoverage.apply_post_install!(
    installer,
    framework_name_prefixes: [${prefixesRuby}],
    force_dynamic_frameworks: ${forceDynamicFrameworks}
  )
`;

      if (!contents.includes('install_installer_hooks!')) {
        if (contents.includes('post_install do |installer|')) {
          contents = contents.replace(
            /post_install do \|installer\|/,
            `${hooksLine}post_install do |installer|`
          );
        } else {
          contents += `\n${hooksLine}\n`;
        }
      }

      if (contents.includes('react_native_post_install(')) {
        contents = contents.replace(
          /(react_native_post_install\([\s\S]*?\))\n/,
          `$1\n${helperCall}`
        );
      } else if (contents.includes('post_install do |installer|')) {
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
