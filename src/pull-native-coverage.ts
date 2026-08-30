import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { CoverageConfig } from './config';
import { DEFAULT_COVERAGE_CONFIG } from './config';

export type PullOptions = {
  softFail?: boolean;
  outputDir?: string;
  config?: CoverageConfig;
};

function getAdbBinary(): string {
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
  const localDestDir =
    options.outputDir ?? path.resolve(process.cwd(), 'coverage/android');
  const localDestFile = path.join(localDestDir, 'emulator_coverage.ec');
  const staging = config.android.detoxStagingPath;
  const adb = getAdbBinary();
  const serial = deviceId ? `-s ${deviceId}` : '';
  const appId = config.app.androidApplicationId;
  const relative = config.android.coverageRelativePath;

  try {
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
  const softFail = options.softFail ?? true;
  const retries = options.retries ?? 15;
  const intervalMs = options.intervalMs ?? 2000;
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;

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

  const message = `Android native coverage file not found after ${retries} attempts`;
  if (softFail) {
    console.warn(`[rn-coverage] ${message}`);
    return null;
  }
  throw new Error(message);
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
  const localDestDir =
    options.outputDir ?? path.resolve(process.cwd(), 'coverage/ios');
  const bundleId = config.app.iosBundleId;

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
    throw new Error(`No iOS coverage profraw files found under ${container}`);
  }

  const destPaths = profrawList.map((src, index) => {
    const suffix = profrawList.length > 1 ? `_${index}` : '';
    const dest = path.join(localDestDir, `simulator_coverage${suffix}.profraw`);
    execSync(`cp "${src}" "${dest}"`);
    return dest;
  });

  console.log(
    `Coverage data downloaded to: ${localDestDir} (${profrawList.length} profraw file(s))`
  );
  return destPaths;
}

/**
 * Run a consumer Jacoco report Gradle task.
 * TODO: resolve gradle project from config instead of cwd guess.
 */
export function runJacocoTestReport(
  androidDir: string = path.resolve(process.cwd(), 'android')
): boolean {
  const result = spawnSync('./gradlew', ['jacocoTestReport'], {
    cwd: androidDir,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.warn(
      `[rn-coverage] jacocoTestReport exited with status ${result.status ?? 'unknown'}`
    );
    return false;
  }

  return true;
}
