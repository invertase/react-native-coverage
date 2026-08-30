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
  };
  /** Rules applied left-to-right to LCOV `SF:` paths. */
  sourcePathRewrite: SourcePathRewriteRule[];
  /**
   * When true (recommended in CI), pull/export/report exit 2 if expected
   * hits/artifacts are empty. Optional `rn-coverage assert` is a dedicated
   * post-pipeline check with the same semantics (full UX in a later item).
   */
  strict: boolean;
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
  },
  sourcePathRewrite: [],
  strict: true,
};

export type CoverageConfigInput = {
  nativeModuleName?: string;
  app?: Partial<CoverageConfig['app']>;
  ios?: Partial<CoverageConfig['ios']>;
  android?: Partial<CoverageConfig['android']>;
  sourcePathRewrite?: SourcePathRewriteRule[];
  strict?: boolean;
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
