import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Neutral defaults — no consumer product names.
 * Pattern C: this package targets dedicated test apps only.
 */
export type SourcePathRewriteRule =
  | {
      kind: 'after-marker';
      /** Substring to locate (e.g. `/packages/`). */
      marker: string;
      /**
       * When true (default), the returned path starts at `marker` without a
       * leading slash (e.g. `packages/...`). When false, returns the substring
       * after the marker.
       */
      includeMarker?: boolean;
    }
  | {
      kind: 'regex';
      pattern: string;
      flags?: string;
      replacement: string;
    };

export type CoverageAssertConfig = {
  /**
   * Substrings that must appear in ≥1 LCOV `SF:` path.
   * Empty → any SF: path counts. Default `packages/` matches common monorepos.
   */
  lcovPathIncludes: string[];
  /**
   * Case-insensitive substrings matching Jacoco `<package name="">`.
   * Empty falls back to `android.libraryProjectMatchers`, then any package.
   */
  jacocoPackageIncludes: string[];
  /** Default relative path for `rn-coverage assert --lcov`. */
  defaultLcovPath: string;
  /** Default relative path for `rn-coverage assert --jacoco-xml`. */
  defaultJacocoXmlPath: string;
};

export type CoverageConfig = {
  /** TurboModule / NativeModules name. Default: `Coverage`. */
  nativeModuleName: string;
  app: {
    androidApplicationId: string;
    iosBundleId: string;
    iosProductName: string;
  };
  ios: {
    /** Framework basename prefixes to include as llvm-cov `-object`s. */
    frameworkNamePrefixes: string[];
  };
  android: {
    libraryProjectMatchers: string[];
    /** Optional staging path used by some e2e runners (e.g. Detox). */
    detoxStagingPath: string;
    coverageRelativePath: string;
    /** Relative path to jacocoTestReport.xml after `android report`. */
    jacocoReportXml: string;
  };
  /** Rules applied left-to-right to LCOV `SF:` paths. */
  sourcePathRewrite: SourcePathRewriteRule[];
  /**
   * When true (recommended in CI), pull/export/report/assert exit 2 if
   * expected hits/artifacts are empty.
   */
  strict: boolean;
  /** Presence-guard matchers and default artifact paths. */
  assert: CoverageAssertConfig;
};

export const DEFAULT_COVERAGE_CONFIG: CoverageConfig = {
  nativeModuleName: 'Coverage',
  app: {
    androidApplicationId: 'com.example.coverage',
    iosBundleId: 'com.example.coverage',
    iosProductName: 'CoverageExample',
  },
  ios: {
    frameworkNamePrefixes: [],
  },
  android: {
    libraryProjectMatchers: [],
    detoxStagingPath: '/data/local/tmp/coverage/coverage.ec',
    coverageRelativePath: 'files/coverage.ec',
    jacocoReportXml:
      'android/app/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml',
  },
  sourcePathRewrite: [],
  strict: true,
  assert: {
    lcovPathIncludes: ['packages/'],
    jacocoPackageIncludes: [],
    defaultLcovPath: 'coverage/ios/lcov.info',
    defaultJacocoXmlPath:
      'android/app/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml',
  },
};

export type CoverageConfigInput = {
  nativeModuleName?: string;
  app?: Partial<CoverageConfig['app']>;
  ios?: Partial<CoverageConfig['ios']>;
  android?: Partial<CoverageConfig['android']>;
  sourcePathRewrite?: SourcePathRewriteRule[];
  strict?: boolean;
  assert?: Partial<CoverageAssertConfig>;
};

export function resolveCoverageConfig(
  input: CoverageConfigInput = {}
): CoverageConfig {
  return {
    nativeModuleName:
      input.nativeModuleName ?? DEFAULT_COVERAGE_CONFIG.nativeModuleName,
    app: {
      ...DEFAULT_COVERAGE_CONFIG.app,
      ...input.app,
    },
    ios: {
      ...DEFAULT_COVERAGE_CONFIG.ios,
      ...input.ios,
    },
    android: {
      ...DEFAULT_COVERAGE_CONFIG.android,
      ...input.android,
    },
    sourcePathRewrite:
      input.sourcePathRewrite ?? DEFAULT_COVERAGE_CONFIG.sourcePathRewrite,
    strict: input.strict ?? DEFAULT_COVERAGE_CONFIG.strict,
    assert: {
      ...DEFAULT_COVERAGE_CONFIG.assert,
      ...input.assert,
    },
  };
}

const CONFIG_FILENAMES = [
  'react-native-coverage.config.js',
  'react-native-coverage.config.cjs',
  'react-native-coverage.config.mjs',
] as const;

/**
 * Load config from `cwd` (or `configPath`). Missing file → defaults.
 */
export async function loadCoverageConfig(
  cwd: string = process.cwd(),
  configPath?: string
): Promise<CoverageConfig> {
  const resolvedPath =
    configPath != null
      ? path.resolve(cwd, configPath)
      : CONFIG_FILENAMES.map((name) => path.join(cwd, name)).find((p) =>
          fs.existsSync(p)
        );

  if (resolvedPath == null || !fs.existsSync(resolvedPath)) {
    return resolveCoverageConfig();
  }

  const mod = await import(pathToFileURL(resolvedPath).href);
  const raw = (mod.default ?? mod) as CoverageConfigInput;
  return resolveCoverageConfig(raw);
}
