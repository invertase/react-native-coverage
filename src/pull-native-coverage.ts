import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { assertAndroidJacoco } from './assert-coverage';
import type { CoverageConfig } from './config';
import { DEFAULT_COVERAGE_CONFIG } from './config';
import { EXIT_OK, EXIT_STRICT_EMPTY, StrictEmptyError } from './exit-codes';

export type PullOptions = {
  softFail?: boolean;
  outputDir?: string;
  config?: CoverageConfig;
};

export function getAdbBinary(): string {
  return process.env.ANDROID_HOME
    ? `${process.env.ANDROID_HOME}/platform-tools/adb`
    : 'adb';
}

export function resolveAndroidDeviceId(preferredDeviceId?: string): string {
  if (preferredDeviceId) {
    return preferredDeviceId;
  }

  if (process.env.ANDROID_SERIAL) {
    return process.env.ANDROID_SERIAL;
  }

  const adb = getAdbBinary();
  const output = execSync(`${adb} devices`, { encoding: 'utf8' });
  const deviceLine = output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .find((line) => line.endsWith('\tdevice'));

  if (!deviceLine) {
    throw new Error('No online Android device found for native coverage pull');
  }

  return deviceLine.split('\t')[0]!;
}

export function androidCoverageFileExists(
  deviceId: string,
  config: CoverageConfig = DEFAULT_COVERAGE_CONFIG
): boolean {
  const adb = getAdbBinary();
  const serial = deviceId ? `-s ${deviceId}` : '';
  const appId = config.app.androidApplicationId;
  const relative = config.android.coverageRelativePath;

  try {
    execSync(`${adb} ${serial} shell "run-as ${appId} test -f ${relative}"`, {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/** Fallback when Gradle buildDirectory cannot be queried (common non-redirected apps). */
export const DEFAULT_ANDROID_COVERAGE_PULL_DIR =
  'android/app/build/outputs/code_coverage';

/**
 * Cap for `:app:rnCoveragePrintAppBuildDir` (cold `--no-daemon` Gradle).
 * On timeout/failure, pull falls back to {@link DEFAULT_ANDROID_COVERAGE_PULL_DIR}.
 */
export const GRADLE_APP_BUILD_DIR_QUERY_TIMEOUT_MS = 90_000;

export type ResolveAndroidCoveragePullDirOptions = {
  cwd?: string;
  androidDir?: string;
  config?: CoverageConfig;
  /** Injected for tests — return absolute app buildDirectory or null. */
  queryAppBuildDir?: (androidDir: string) => string | null;
};

/**
 * Resolve the host staging directory for pulled Emma `.ec` files.
 * Prefer config `android.coveragePullDir`, then the app's effective
 * `layout.buildDirectory` via `:app:rnCoveragePrintAppBuildDir`, then the
 * conventional `android/app/build/outputs/code_coverage` path.
 */
export function resolveAndroidCoveragePullDir(
  options: ResolveAndroidCoveragePullDirOptions = {}
): string {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const configured = config.android.coveragePullDir?.trim();
  if (configured) {
    return path.resolve(cwd, configured);
  }

  const androidDir = path.resolve(
    cwd,
    options.androidDir ?? path.join(cwd, 'android')
  );
  const query =
    options.queryAppBuildDir ??
    ((dir: string) => queryGradleAppBuildDirectory(dir));
  const appBuildDir = query(androidDir);
  if (appBuildDir) {
    return path.join(appBuildDir, 'outputs', 'code_coverage');
  }

  return path.resolve(cwd, DEFAULT_ANDROID_COVERAGE_PULL_DIR);
}

/**
 * Query `:app:rnCoveragePrintAppBuildDir` for the app layout.buildDirectory.
 * Returns null when Gradle is unavailable or the task is missing.
 */
export function queryGradleAppBuildDirectory(
  androidDir: string
): string | null {
  const gradlew = path.join(
    androidDir,
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'
  );
  if (!fs.existsSync(gradlew)) {
    return null;
  }

  try {
    const result = spawnSync(
      gradlew,
      [':app:rnCoveragePrintAppBuildDir', '-q', '--no-daemon'],
      {
        cwd: androidDir,
        encoding: 'utf8',
        shell: true,
        env: process.env,
        timeout: GRADLE_APP_BUILD_DIR_QUERY_TIMEOUT_MS,
      }
    );
    if (result.error || result.status !== 0) {
      return null;
    }
    const lines = String(result.stdout ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const buildDir = lines[lines.length - 1];
    if (!buildDir || !path.isAbsolute(buildDir)) {
      return null;
    }
    return buildDir;
  } catch {
    return null;
  }
}

/**
 * Pull Android Emma/Jacoco `.ec` from the device into `outputDir`.
 * Ported from RNFB tests/scripts/pull-native-coverage.js with config injection.
 */
export function pullAndroidCoverage(
  deviceId: string,
  options: PullOptions = {}
): string | null {
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const softFail = options.softFail ?? false;
  // Default under the app layout.buildDirectory so subsequent `jacocoTestReport`
  // finds the .ec (fileTree over that root). Artifacts/ dirs alone leave the task SKIPPED.
  const localDestDir =
    options.outputDir ?? resolveAndroidCoveragePullDir({ config });
  const localDestFile = path.join(localDestDir, 'emulator_coverage.ec');
  const staging = config.android.detoxStagingPath;
  const adb = getAdbBinary();
  const serial = deviceId ? `-s ${deviceId}` : '';
  const appId = config.app.androidApplicationId;
  const relative = config.android.coverageRelativePath;

  try {
    // Staging lives under /data/local/tmp/...; the parent dir is not created by
    // the emulator (unlike Detox's /data/local/tmp/detox). Redirect fails with
    // "No such file or directory" if we skip mkdir.
    const stagingDir = path.posix.dirname(staging);
    execSync(`${adb} ${serial} shell "mkdir -p ${stagingDir}"`);
    execSync(
      `${adb} ${serial} shell "run-as ${appId} cat ${relative} > ${staging}"`
    );
    fs.mkdirSync(localDestDir, { recursive: true });
    execSync(`${adb} ${serial} pull ${staging} ${localDestFile}`);

    console.log(`Coverage data downloaded to: ${localDestFile}`);
    return localDestFile;
  } catch (error) {
    const message = `Android native coverage pull failed: ${(error as Error).message}`;
    if (softFail) {
      console.warn(`[rn-coverage] ${message}`);
      return null;
    }
    throw new Error(message);
  }
}

export async function pullAndroidCoverageWithRetry(
  deviceId: string,
  options: PullOptions & { retries?: number; intervalMs?: number } = {}
): Promise<string | null> {
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const softFail = options.softFail ?? !config.strict;
  const retries = options.retries ?? 15;
  const intervalMs = options.intervalMs ?? 2000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    if (androidCoverageFileExists(deviceId, config)) {
      const pulled = pullAndroidCoverage(deviceId, {
        ...options,
        softFail: true,
        config,
      });
      if (pulled) {
        return pulled;
      }
    } else if (attempt === 1 || attempt % 5 === 0) {
      console.log(
        `[rn-coverage] Waiting for ${config.android.coverageRelativePath} (attempt ${attempt}/${retries})`
      );
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  const existed = androidCoverageFileExists(deviceId, config);
  const message = existed
    ? `Android native coverage pull failed after ${retries} attempts (file present but staging/pull failed)`
    : `Android native coverage file not found after ${retries} attempts`;
  if (softFail) {
    console.warn(`[rn-coverage] ${message}`);
    return null;
  }
  throw new StrictEmptyError(message);
}

/**
 * Pull iOS LLVM `.profraw` files from a simulator app container.
 * Ported from RNFB with config-driven bundle id / output paths.
 */
export function pullIosCoverage(
  deviceId: string,
  options: PullOptions = {}
): string[] {
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const softFail = options.softFail ?? !config.strict;
  const localDestDir =
    options.outputDir ?? path.resolve(process.cwd(), 'coverage/ios');
  const bundleId = config.app.iosBundleId;

  try {
    const container = execSync(
      `xcrun simctl get_app_container ${deviceId} ${bundleId} data`,
      { encoding: 'utf8' }
    ).trim();
    fs.mkdirSync(localDestDir, { recursive: true });

    const profrawList = execSync(
      `find "${container}" \\( -path "*/Documents/coverage.profraw" -o -path "*/tmp/coverage.profraw" -o -name '*.profraw' \\)`,
      { encoding: 'utf8' }
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    if (profrawList.length === 0) {
      const message = `No iOS coverage profraw files found under ${container}`;
      if (softFail) {
        console.warn(`[rn-coverage] ${message}`);
        return [];
      }
      throw new StrictEmptyError(message);
    }

    const destPaths = profrawList.map((src, index) => {
      const suffix = profrawList.length > 1 ? `_${index}` : '';
      const dest = path.join(
        localDestDir,
        `simulator_coverage${suffix}.profraw`
      );
      execSync(`cp "${src}" "${dest}"`);
      return dest;
    });

    console.log(
      `Coverage data downloaded to: ${localDestDir} (${profrawList.length} profraw file(s))`
    );
    return destPaths;
  } catch (error) {
    if (error instanceof StrictEmptyError) {
      throw error;
    }
    const message = `iOS native coverage pull failed: ${(error as Error).message}`;
    if (softFail) {
      console.warn(`[rn-coverage] ${message}`);
      return [];
    }
    throw new Error(message);
  }
}

export type AndroidReportOptions = {
  androidDir?: string;
  jacocoXml?: string;
  config?: CoverageConfig;
  /** When true (default), assert Jacoco XML after a successful Gradle report. */
  assertAfterReport?: boolean;
};

/**
 * Run a consumer Jacoco report Gradle task, then optionally assert LINE hits.
 */
export function runJacocoTestReport(
  options: AndroidReportOptions | string = {}
): { ok: boolean; exitCode: number } {
  const normalized: AndroidReportOptions =
    typeof options === 'string' ? { androidDir: options } : options;
  const config = normalized.config ?? DEFAULT_COVERAGE_CONFIG;
  const androidDir =
    normalized.androidDir ?? path.resolve(process.cwd(), 'android');

  const result = spawnSync('./gradlew', ['jacocoTestReport'], {
    cwd: androidDir,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.warn(
      `[rn-coverage] jacocoTestReport exited with status ${result.status ?? 'unknown'}`
    );
    return { ok: false, exitCode: result.status ?? 1 };
  }

  const shouldAssert = normalized.assertAfterReport ?? true;
  if (!shouldAssert) {
    return { ok: true, exitCode: EXIT_OK };
  }

  const jacocoXml =
    normalized.jacocoXml ??
    path.resolve(process.cwd(), config.android.jacocoReportXml);
  const assertResult = assertAndroidJacoco(jacocoXml, config.strict, config);
  if (assertResult.code === EXIT_OK) {
    console.log(`[rn-coverage] ${assertResult.message}`);
    return { ok: true, exitCode: EXIT_OK };
  }
  if (assertResult.code === EXIT_STRICT_EMPTY) {
    console.error(`[rn-coverage] ${assertResult.message}`);
    return { ok: false, exitCode: EXIT_STRICT_EMPTY };
  }
  console.warn(`[rn-coverage] ${assertResult.message}`);
  return { ok: true, exitCode: EXIT_OK };
}
