import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { CoverageConfig } from './config';
import { DEFAULT_COVERAGE_CONFIG } from './config';
import { StrictEmptyError } from './exit-codes';
import { getAdbBinary, resolveAndroidDeviceId } from './pull-native-coverage';

export type JsPullOptions = {
  softFail?: boolean;
  outputDir?: string;
  config?: CoverageConfig;
};

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Pull Android Istanbul JSON written by `dumpJsCoverage` (`files/coverage-final.json`).
 */
export function pullAndroidJsCoverage(
  deviceId: string,
  options: JsPullOptions = {}
): string | null {
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const softFail = options.softFail ?? !config.strict;
  const localDestDir =
    options.outputDir ?? path.resolve(process.cwd(), 'coverage/js');
  const localDestFile = path.join(localDestDir, 'coverage-final.json');
  const relative = config.js.androidRelativePath;
  const staging = config.js.androidStagingPath;
  const adb = getAdbBinary();
  const serial = deviceId ? `-s ${deviceId}` : '';

  try {
    const stagingDir = path.posix.dirname(staging);
    execSync(`${adb} ${serial} shell "mkdir -p ${stagingDir}"`);
    execSync(
      `${adb} ${serial} shell "run-as ${config.app.androidApplicationId} cat ${relative} > ${staging}"`
    );
    ensureDir(localDestDir);
    execSync(`${adb} ${serial} pull ${staging} ${localDestFile}`);
    console.log(`JS coverage downloaded to: ${localDestFile}`);
    return localDestFile;
  } catch (error) {
    const message = `Android JS coverage pull failed: ${(error as Error).message}`;
    if (softFail) {
      console.warn(`[rn-coverage] ${message}`);
      return null;
    }
    throw new Error(message);
  }
}

/**
 * Pull iOS Istanbul JSON from the simulator data container.
 */
export function pullIosJsCoverage(
  deviceId: string,
  options: JsPullOptions = {}
): string | null {
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const softFail = options.softFail ?? !config.strict;
  const localDestDir =
    options.outputDir ?? path.resolve(process.cwd(), 'coverage/js');
  const localDestFile = path.join(localDestDir, 'coverage-final.json');
  const relative = config.js.iosRelativePath;
  const bundleId = config.app.iosBundleId;

  try {
    const container = execSync(
      `xcrun simctl get_app_container ${deviceId} ${bundleId} data`,
      { encoding: 'utf8' }
    ).trim();
    const src = path.join(container, relative);
    if (!fs.existsSync(src)) {
      const message = `iOS JS coverage missing at ${src}`;
      if (softFail) {
        console.warn(`[rn-coverage] ${message}`);
        return null;
      }
      throw new StrictEmptyError(message);
    }
    ensureDir(localDestDir);
    fs.copyFileSync(src, localDestFile);
    console.log(`JS coverage downloaded to: ${localDestFile}`);
    return localDestFile;
  } catch (error) {
    if (error instanceof StrictEmptyError) {
      throw error;
    }
    const message = `iOS JS coverage pull failed: ${(error as Error).message}`;
    if (softFail) {
      console.warn(`[rn-coverage] ${message}`);
      return null;
    }
    throw new Error(message);
  }
}

export type JsReportOptions = {
  /** Istanbul coverage-final.json (or directory of JSON files). */
  input: string;
  /** Directory for lcov.info / HTML (NYC report-dir). */
  outputDir?: string;
  /** Working directory for NYC include globs (usually repo or app root). */
  cwd?: string;
  /** Optional path to nyc.config.js */
  nycConfig?: string;
  softFail?: boolean;
};

/**
 * Run NYC report with source-map remap (TypeScript SF: paths).
 * Expects pre-instrumented coverage JSON (`instrument: false` in nyc config).
 */
export function reportJsCoverage(options: JsReportOptions): {
  ok: boolean;
  lcovPath: string | null;
} {
  const cwd = options.cwd ?? process.cwd();
  const outputDir = options.outputDir ?? path.resolve(cwd, 'coverage/js');
  const softFail = options.softFail ?? false;
  const nycOutput = path.join(outputDir, '.nyc_output');
  ensureDir(nycOutput);
  ensureDir(outputDir);

  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    const message = `JS coverage input missing: ${inputPath}`;
    if (softFail) {
      console.warn(`[rn-coverage] ${message}`);
      return { ok: false, lcovPath: null };
    }
    throw new StrictEmptyError(message);
  }

  if (fs.statSync(inputPath).isDirectory()) {
    for (const name of fs.readdirSync(inputPath)) {
      if (name.endsWith('.json')) {
        fs.copyFileSync(path.join(inputPath, name), path.join(nycOutput, name));
      }
    }
  } else {
    fs.copyFileSync(inputPath, path.join(nycOutput, 'coverage-final.json'));
  }

  const resolveNycBin = (): string => {
    const bases = [cwd, process.cwd()];
    for (const base of bases) {
      try {
        return createRequire(path.join(base, 'package.json')).resolve(
          'nyc/bin/nyc.js'
        );
      } catch {
        // try next
      }
      const direct = path.join(base, 'node_modules', 'nyc', 'bin', 'nyc.js');
      if (fs.existsSync(direct)) {
        return direct;
      }
    }
    throw new Error(
      'nyc is required for `rn-coverage js report` — yarn add nyc in the package or test app'
    );
  };
  const nycBin = resolveNycBin();

  const args = [
    nycBin,
    'report',
    '--reporter=lcov',
    '--reporter=text-summary',
    `--report-dir=${outputDir}`,
    `--temp-dir=${nycOutput}`,
    '--exclude-after-remap',
  ];
  if (options.nycConfig) {
    args.push(`--nycrc-path=${path.resolve(options.nycConfig)}`);
  }

  try {
    execFileSync(process.execPath, args, {
      cwd,
      stdio: 'inherit',
    });
  } catch (error) {
    const message = `NYC report failed: ${(error as Error).message}`;
    if (softFail) {
      console.warn(`[rn-coverage] ${message}`);
      return { ok: false, lcovPath: null };
    }
    throw new Error(message);
  }

  const lcovPath = path.join(outputDir, 'lcov.info');
  if (!fs.existsSync(lcovPath) || fs.statSync(lcovPath).size === 0) {
    const message = `JS LCOV missing or empty after NYC report: ${lcovPath}`;
    if (softFail) {
      console.warn(`[rn-coverage] ${message}`);
      return { ok: false, lcovPath: null };
    }
    throw new StrictEmptyError(message);
  }

  console.log(`[rn-coverage] JS LCOV written to ${lcovPath}`);
  return { ok: true, lcovPath };
}

export { resolveAndroidDeviceId };
