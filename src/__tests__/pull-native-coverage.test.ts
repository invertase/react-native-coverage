import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveCoverageConfig } from '../config';
import { EXIT_STRICT_EMPTY, StrictEmptyError } from '../exit-codes';
import {
  androidCoverageFileExists,
  DEFAULT_ANDROID_COVERAGE_PULL_DIR,
  GRADLE_APP_BUILD_DIR_QUERY_TIMEOUT_MS,
  pullAndroidCoverage,
  pullAndroidCoverageWithRetry,
  pullIosCoverage,
  queryGradleAppBuildDirectory,
  resolveAndroidCoveragePullDir,
  resolveAndroidDeviceId,
  runJacocoTestReport,
} from '../pull-native-coverage';
import {
  DEFAULT_ANDROID_COVERAGE_PULL_DIR as nodeDefaultAndroidCoveragePullDir,
  queryGradleAppBuildDirectory as nodeQueryGradleAppBuildDirectory,
  resolveAndroidCoveragePullDir as nodeResolveAndroidCoveragePullDir,
} from '../node';

jest.mock('node:child_process', () => {
  const actual = jest.requireActual('node:child_process');
  return {
    ...actual,
    execSync: jest.fn(),
    spawnSync: jest.fn(),
  };
});

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockedSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

describe('resolveAndroidDeviceId', () => {
  const previousSerial = process.env.ANDROID_SERIAL;

  afterEach(() => {
    mockedExecSync.mockReset();
    if (previousSerial === undefined) {
      delete process.env.ANDROID_SERIAL;
    } else {
      process.env.ANDROID_SERIAL = previousSerial;
    }
  });

  it('prefers explicit device id', () => {
    expect(resolveAndroidDeviceId('device-1')).toBe('device-1');
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  it('uses ANDROID_SERIAL when set', () => {
    process.env.ANDROID_SERIAL = 'serial-9';
    expect(resolveAndroidDeviceId()).toBe('serial-9');
  });

  it('parses first online device from adb devices fixture', () => {
    delete process.env.ANDROID_SERIAL;
    const fixture = fs.readFileSync(
      path.join(__dirname, '../../fixtures/pull/adb-devices.txt'),
      'utf8'
    );
    mockedExecSync.mockReturnValue(fixture);
    expect(resolveAndroidDeviceId()).toBe('emulator-5554');
  });
});

describe('resolveAndroidCoveragePullDir', () => {
  it('uses config android.coveragePullDir when set', () => {
    const dir = resolveAndroidCoveragePullDir({
      cwd: '/repo',
      config: resolveCoverageConfig({
        android: { coveragePullDir: 'custom/out/code_coverage' },
      }),
      queryAppBuildDir: () => {
        throw new Error('should not query gradle');
      },
    });
    expect(dir).toBe(path.resolve('/repo', 'custom/out/code_coverage'));
  });

  it('joins queried app buildDirectory with outputs/code_coverage', () => {
    const dir = resolveAndroidCoveragePullDir({
      cwd: '/repo',
      config: resolveCoverageConfig(),
      queryAppBuildDir: () => '/redirected/app-build',
    });
    expect(dir).toBe(
      path.join('/redirected/app-build', 'outputs', 'code_coverage')
    );
  });

  it('falls back to conventional app/build path when query returns null', () => {
    const dir = resolveAndroidCoveragePullDir({
      cwd: '/repo',
      config: resolveCoverageConfig(),
      queryAppBuildDir: () => null,
    });
    expect(dir).toBe(path.resolve('/repo', DEFAULT_ANDROID_COVERAGE_PULL_DIR));
  });

  it('uses the default Gradle query when queryAppBuildDir is omitted', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-pull-dir-default-'));
    const androidDir = path.join(tmp, 'custom-android');
    fs.mkdirSync(androidDir);
    const previous = process.cwd();
    process.chdir(tmp);
    try {
      expect(resolveAndroidCoveragePullDir()).toBe(
        path.resolve(process.cwd(), DEFAULT_ANDROID_COVERAGE_PULL_DIR)
      );
      expect(
        resolveAndroidCoveragePullDir({
          cwd: tmp,
          androidDir,
          config: resolveCoverageConfig(),
        })
      ).toBe(path.resolve(tmp, DEFAULT_ANDROID_COVERAGE_PULL_DIR));
      expect(mockedSpawnSync).not.toHaveBeenCalled();
    } finally {
      process.chdir(previous);
    }
  });
});

describe('queryGradleAppBuildDirectory', () => {
  afterEach(() => {
    mockedSpawnSync.mockReset();
  });

  it('queries Gradle with a timeout and returns the last absolute path', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-gradle-query-'));
    const gradlewName =
      process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    const gradlew = path.join(tmp, gradlewName);
    fs.writeFileSync(gradlew, '');

    mockedSpawnSync.mockReturnValue({
      status: 0,
      signal: null,
      output: [],
      pid: 1,
      stdout: 'noise\n/redirected/app/build\n',
      stderr: '',
    } as ReturnType<typeof spawnSync>);

    expect(queryGradleAppBuildDirectory(tmp)).toBe('/redirected/app/build');
    expect(mockedSpawnSync).toHaveBeenCalledWith(
      gradlew,
      [':app:rnCoveragePrintAppBuildDir', '-q', '--no-daemon'],
      expect.objectContaining({
        cwd: tmp,
        timeout: GRADLE_APP_BUILD_DIR_QUERY_TIMEOUT_MS,
      })
    );
  });

  it('returns null when spawnSync times out so callers can fall back', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-gradle-timeout-'));
    const gradlewName =
      process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    fs.writeFileSync(path.join(tmp, gradlewName), '');

    const timedOut = Object.assign(new Error('Timed out'), {
      code: 'ETIMEDOUT',
    });
    mockedSpawnSync.mockReturnValue({
      status: null,
      signal: 'SIGTERM',
      output: [],
      pid: 1,
      stdout: '',
      stderr: '',
      error: timedOut,
    } as ReturnType<typeof spawnSync>);

    expect(queryGradleAppBuildDirectory(tmp)).toBeNull();
  });

  it('returns null when gradlew is missing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-gradle-missing-'));
    expect(queryGradleAppBuildDirectory(tmp)).toBeNull();
    expect(mockedSpawnSync).not.toHaveBeenCalled();
  });

  it('returns null when Gradle exits non-zero', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-gradle-status-'));
    const gradlewName =
      process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    fs.writeFileSync(path.join(tmp, gradlewName), '');

    mockedSpawnSync.mockReturnValue({
      status: 1,
      signal: null,
      output: [],
      pid: 1,
      stdout: '/redirected/app/build\n',
      stderr: 'task failed',
    } as ReturnType<typeof spawnSync>);

    expect(queryGradleAppBuildDirectory(tmp)).toBeNull();
  });

  it('returns null when the last stdout line is not absolute', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-gradle-relative-'));
    const gradlewName =
      process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    fs.writeFileSync(path.join(tmp, gradlewName), '');

    mockedSpawnSync.mockReturnValue({
      status: 0,
      signal: null,
      output: [],
      pid: 1,
      stdout: '/ignored/absolute\napp/build\n',
      stderr: '',
    } as ReturnType<typeof spawnSync>);

    expect(queryGradleAppBuildDirectory(tmp)).toBeNull();
  });

  it('returns null when stdout has no path', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-gradle-empty-'));
    const gradlewName =
      process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    fs.writeFileSync(path.join(tmp, gradlewName), '');

    mockedSpawnSync.mockReturnValue({
      status: 0,
      signal: null,
      output: [],
      pid: 1,
      stdout: undefined,
      stderr: '',
    } as unknown as ReturnType<typeof spawnSync>);

    expect(queryGradleAppBuildDirectory(tmp)).toBeNull();
  });

  it('returns null when spawnSync throws', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-gradle-throw-'));
    const gradlewName =
      process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    fs.writeFileSync(path.join(tmp, gradlewName), '');

    mockedSpawnSync.mockImplementation(() => {
      throw new Error('spawn failed');
    });

    expect(queryGradleAppBuildDirectory(tmp)).toBeNull();
  });
});

describe('pullAndroidCoverage', () => {
  afterEach(() => {
    mockedExecSync.mockReset();
  });

  it('softFail returns null when adb pull fails', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('adb failed');
    });
    const result = pullAndroidCoverage('emulator-5554', {
      softFail: true,
      outputDir: path.join(os.tmpdir(), 'rnc-pull-android'),
      config: resolveCoverageConfig(),
    });
    expect(result).toBeNull();
  });

  it('writes local ec path on success', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-pull-ok-'));
    const cmds: string[] = [];
    mockedExecSync.mockImplementation((cmd: string) => {
      const command = String(cmd);
      cmds.push(command);
      if (command.includes('pull')) {
        fs.writeFileSync(path.join(tmp, 'emulator_coverage.ec'), 'ec');
      }
      return '';
    });
    const result = pullAndroidCoverage('emulator-5554', {
      softFail: false,
      outputDir: tmp,
      config: resolveCoverageConfig(),
    });
    expect(result).toBe(path.join(tmp, 'emulator_coverage.ec'));
    expect(fs.existsSync(result!)).toBe(true);
    expect(cmds.some((c) => c.includes('mkdir -p'))).toBe(true);
  });

  it('resolves the pull dir when outputDir is omitted', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-pull-omit-out-'));
    const previous = process.cwd();
    process.chdir(tmp);
    try {
      const destDir = path.resolve(
        process.cwd(),
        DEFAULT_ANDROID_COVERAGE_PULL_DIR
      );
      const cmds: string[] = [];
      mockedExecSync.mockImplementation((cmd: string) => {
        const command = String(cmd);
        cmds.push(command);
        if (command.includes('pull')) {
          fs.writeFileSync(path.join(destDir, 'emulator_coverage.ec'), 'ec');
        }
        return '';
      });
      const result = pullAndroidCoverage('emulator-5554', {
        softFail: false,
        config: resolveCoverageConfig(),
      });
      expect(result).toBe(path.join(destDir, 'emulator_coverage.ec'));
      expect(fs.existsSync(result!)).toBe(true);
      expect(mockedSpawnSync).not.toHaveBeenCalled();
      expect(cmds.some((c) => c.includes('mkdir -p'))).toBe(true);
    } finally {
      process.chdir(previous);
    }
  });
});

describe('node entry re-exports', () => {
  it('re-exports the Android pull-dir helpers', () => {
    expect(nodeDefaultAndroidCoveragePullDir).toBe(
      DEFAULT_ANDROID_COVERAGE_PULL_DIR
    );
    expect(nodeQueryGradleAppBuildDirectory).toBe(queryGradleAppBuildDirectory);
    expect(nodeResolveAndroidCoveragePullDir).toBe(
      resolveAndroidCoveragePullDir
    );
  });
});

describe('androidCoverageFileExists', () => {
  afterEach(() => {
    mockedExecSync.mockReset();
  });

  it('returns true when run-as test succeeds', () => {
    mockedExecSync.mockReturnValue('');
    expect(
      androidCoverageFileExists('emulator-5554', resolveCoverageConfig())
    ).toBe(true);
  });

  it('returns false when run-as test throws', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('missing');
    });
    expect(
      androidCoverageFileExists('emulator-5554', resolveCoverageConfig())
    ).toBe(false);
  });
});

describe('pullIosCoverage', () => {
  afterEach(() => {
    mockedExecSync.mockReset();
  });

  it('copies profraw from simulated container into output dir', () => {
    const container = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-ios-c-'));
    const docs = path.join(container, 'Documents');
    fs.mkdirSync(docs);
    fs.writeFileSync(path.join(docs, 'coverage.profraw'), 'raw');
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-ios-o-'));

    mockedExecSync.mockImplementation((cmd: string) => {
      const command = String(cmd);
      if (command.includes('get_app_container')) {
        return `${container}\n`;
      }
      if (command.startsWith('find ')) {
        return `${path.join(docs, 'coverage.profraw')}\n`;
      }
      if (command.startsWith('cp ')) {
        const match = command.match(/cp "([^"]+)" "([^"]+)"/);
        if (match) {
          fs.copyFileSync(match[1]!, match[2]!);
        }
        return '';
      }
      return '';
    });

    const pulled = pullIosCoverage('UDID', {
      outputDir: output,
      softFail: false,
      config: resolveCoverageConfig(),
    });
    expect(pulled).toHaveLength(1);
    expect(fs.existsSync(pulled[0]!)).toBe(true);
  });

  it('throws StrictEmptyError when no profraw and not softFail', () => {
    const container = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-ios-empty-'));
    mockedExecSync.mockImplementation((cmd: string) => {
      const command = String(cmd);
      if (command.includes('get_app_container')) {
        return `${container}\n`;
      }
      if (command.startsWith('find ')) {
        return '\n';
      }
      return '';
    });

    expect(() =>
      pullIosCoverage('UDID', {
        softFail: false,
        config: resolveCoverageConfig({ strict: true }),
      })
    ).toThrow(StrictEmptyError);
  });

  it('returns [] in softFail when no profraw', () => {
    const container = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-ios-soft-'));
    mockedExecSync.mockImplementation((cmd: string) => {
      const command = String(cmd);
      if (command.includes('get_app_container')) {
        return `${container}\n`;
      }
      if (command.startsWith('find ')) {
        return '\n';
      }
      return '';
    });

    const pulled = pullIosCoverage('UDID', {
      softFail: true,
      config: resolveCoverageConfig({ strict: false }),
    });
    expect(pulled).toEqual([]);
  });
});

describe('pullAndroidCoverageWithRetry', () => {
  afterEach(() => {
    mockedExecSync.mockReset();
  });

  it('throws StrictEmptyError by default when strict and .ec never appears', async () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('missing');
    });

    await expect(
      pullAndroidCoverageWithRetry('emulator-5554', {
        retries: 2,
        intervalMs: 1,
        config: resolveCoverageConfig({ strict: true }),
      })
    ).rejects.toBeInstanceOf(StrictEmptyError);
  });

  it('returns null when softFail overrides strict config', async () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('missing');
    });

    const result = await pullAndroidCoverageWithRetry('emulator-5554', {
      softFail: true,
      retries: 2,
      intervalMs: 1,
      config: resolveCoverageConfig({ strict: true }),
    });
    expect(result).toBeNull();
  });

  it('defaults softFail from !config.strict (non-strict → null)', async () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('missing');
    });

    const result = await pullAndroidCoverageWithRetry('emulator-5554', {
      retries: 2,
      intervalMs: 1,
      config: resolveCoverageConfig({ strict: false }),
    });
    expect(result).toBeNull();
  });
});

describe('runJacocoTestReport', () => {
  afterEach(() => {
    mockedSpawnSync.mockReset();
  });

  it('returns exit 2 when Gradle succeeds but Jacoco assert is empty', () => {
    mockedSpawnSync.mockReturnValue({
      status: 0,
      signal: null,
      output: [],
      pid: 0,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
    } as ReturnType<typeof spawnSync>);

    const fixtures = path.join(__dirname, '../../fixtures/assert');
    const result = runJacocoTestReport({
      androidDir: fixtures,
      jacocoXml: path.join(fixtures, 'empty-hits-jacoco.xml'),
      config: resolveCoverageConfig({
        strict: true,
        assert: { jacocoPackageIncludes: ['example.lib'] },
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(EXIT_STRICT_EMPTY);
  });
});
