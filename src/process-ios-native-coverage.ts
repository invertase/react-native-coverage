import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { assertIosLcov } from './assert-coverage';
import type { CoverageConfig, SourcePathRewriteRule } from './config';
import { DEFAULT_COVERAGE_CONFIG } from './config';
import { EXIT_OK, EXIT_STRICT_EMPTY, StrictEmptyError } from './exit-codes';
import { normalizeSourcePath } from './path-rewrite';

export type IosExportOptions = {
  derivedData: string;
  configuration: string;
  appName: string;
  output: string;
  config?: CoverageConfig;
  /** When true, delete processed `.profraw` files after a successful export. */
  deleteProfraw?: boolean;
  /**
   * When true (default), run LCOV presence assert after export.
   * Soft mode (`config.strict === false`) warns; strict throws for CLI exit 2.
   */
  assertAfterExport?: boolean;
};

export type IosCoverageContext = {
  productsDir: string;
  appBinary: string;
  coverageObjects: string[];
  profrawFiles: string[];
  profileDataDir: string;
  simulatorCoverageDir: string;
};

export function walkFiles(
  dir: string,
  matcher: (filePath: string) => boolean,
  results: string[] = []
): string[] {
  if (!fs.existsSync(dir)) {
    return results;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, matcher, results);
    } else if (matcher(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Collect app binary + matching embedded frameworks for llvm-cov `-object`.
 * Framework matching uses `config.ios.frameworkNamePrefixes` (neutral; empty by default).
 */
export function collectCoverageObjects(
  productsDir: string,
  appName: string,
  frameworkNamePrefixes: string[] = []
): string[] {
  const objects: string[] = [];
  const seen = new Set<string>();

  const addObject = (candidate: string | undefined) => {
    if (!candidate || seen.has(candidate) || !fs.existsSync(candidate)) {
      return;
    }
    seen.add(candidate);
    objects.push(candidate);
  };

  addObject(path.join(productsDir, `${appName}.app`, appName));

  // Expo / Xcode companion image: LLVM counters for statically merged pods often
  // live in AppName.debug.dylib (MH_DYLIB) rather than the MH_EXECUTE binary.
  addObject(path.join(productsDir, `${appName}.app`, `${appName}.debug.dylib`));

  const matchesPrefix = (name: string) =>
    frameworkNamePrefixes.length === 0
      ? false
      : frameworkNamePrefixes.some((prefix) => name.startsWith(prefix));

  const embeddedFrameworksDir = path.join(
    productsDir,
    `${appName}.app`,
    'Frameworks'
  );
  if (fs.existsSync(embeddedFrameworksDir)) {
    for (const entry of fs.readdirSync(embeddedFrameworksDir)) {
      if (!entry.endsWith('.framework') || !matchesPrefix(entry)) {
        continue;
      }
      const frameworkName = entry.slice(0, -'.framework'.length);
      addObject(path.join(embeddedFrameworksDir, entry, frameworkName));
    }
  }

  if (objects.length <= 1 && fs.existsSync(productsDir)) {
    for (const entry of fs.readdirSync(productsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !matchesPrefix(entry.name)) {
        continue;
      }
      const frameworkName = entry.name;
      addObject(
        path.join(
          productsDir,
          frameworkName,
          `${frameworkName}.framework`,
          frameworkName
        )
      );
    }
  }

  return objects;
}

export function resolveIosCoverageContext(
  derivedData: string,
  configuration: string,
  appName: string,
  frameworkNamePrefixes: string[] = []
): IosCoverageContext {
  const productsDir = path.join(
    derivedData,
    'Build/Products',
    `${configuration}-iphonesimulator`
  );
  const appBinary = path.join(productsDir, `${appName}.app`, appName);
  const profileDataDir = path.join(derivedData, 'Build/ProfileData');
  const simulatorCoverageDir = path.join(derivedData, 'output/coverage');

  const profrawFiles = [
    ...walkFiles(simulatorCoverageDir, (filePath) =>
      filePath.endsWith('.profraw')
    ),
    ...walkFiles(profileDataDir, (filePath) => filePath.endsWith('.profraw')),
  ];

  const coverageObjects = collectCoverageObjects(
    productsDir,
    appName,
    frameworkNamePrefixes
  );

  return {
    productsDir,
    appBinary,
    coverageObjects,
    profrawFiles,
    profileDataDir,
    simulatorCoverageDir,
  };
}

export async function rewriteLcovFile(
  inputPath: string,
  outputPath: string,
  rules: SourcePathRewriteRule[]
): Promise<{ sourceFileCount: number }> {
  const input = fs.createReadStream(inputPath, { encoding: 'utf8' });
  const output = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });

  let sourceFileCount = 0;

  for await (const line of lines) {
    if (line.startsWith('SF:')) {
      sourceFileCount += 1;
      const normalizedPath = normalizeSourcePath(line.slice(3), rules);
      output.write(`SF:${normalizedPath}\n`);
    } else {
      output.write(`${line}\n`);
    }
  }

  await new Promise<void>((resolve, reject) => {
    output.end(() => resolve());
    output.on('error', reject);
  });

  return { sourceFileCount };
}

function runOrThrow(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const err = error as { stderr?: Buffer; stdout?: Buffer; message: string };
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stdout = err.stdout ? err.stdout.toString() : '';
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${stderr || stdout || err.message}`
    );
  }
}

function runToFileOrThrow(
  command: string,
  args: string[],
  outputPath: string
): void {
  try {
    execFileSync(command, args, {
      stdio: ['ignore', fs.openSync(outputPath, 'w'), 'pipe'],
    });
  } catch (error) {
    const err = error as { stderr?: Buffer; message: string };
    const stderr = err.stderr ? err.stderr.toString() : '';
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${stderr || err.message}`
    );
  }
}

function buildObjectArgs(coverageObjects: string[]): string[] {
  const args: string[] = [];
  for (const objectPath of coverageObjects) {
    args.push('-object', objectPath);
  }
  return args;
}

/**
 * Merge profraw → profdata → LCOV with path rewrite + optional presence assert.
 */
export async function exportIosLcov(
  options: IosExportOptions
): Promise<string> {
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const ctx = resolveIosCoverageContext(
    options.derivedData,
    options.configuration,
    options.appName,
    config.ios.frameworkNamePrefixes
  );

  if (ctx.profrawFiles.length === 0) {
    const message = `No .profraw files under ${ctx.simulatorCoverageDir} or ${ctx.profileDataDir}.`;
    if (config.strict) {
      throw new StrictEmptyError(message);
    }
    console.warn(`[rn-coverage] ${message} (soft; continuing)`);
    return options.output;
  }

  if (!fs.existsSync(ctx.appBinary)) {
    throw new Error(`App binary not found at ${ctx.appBinary}`);
  }

  if (ctx.coverageObjects.length === 0) {
    throw new Error(`No coverage objects found under ${ctx.productsDir}`);
  }

  fs.mkdirSync(path.dirname(options.output), { recursive: true });

  const profdataPath = path.join(path.dirname(options.output), 'profdata');
  runOrThrow('xcrun', [
    'llvm-profdata',
    'merge',
    '-sparse',
    ...ctx.profrawFiles,
    '-o',
    profdataPath,
  ]);

  const rawLcovPath = path.join(path.dirname(options.output), 'lcov.raw');
  try {
    const exportArgs = [
      'llvm-cov',
      'export',
      '-instr-profile',
      profdataPath,
      ...buildObjectArgs(ctx.coverageObjects),
      '-format=lcov',
    ];
    runToFileOrThrow('xcrun', exportArgs, rawLcovPath);

    const { sourceFileCount } = await rewriteLcovFile(
      rawLcovPath,
      options.output,
      config.sourcePathRewrite
    );

    console.log(
      `[rn-coverage] Wrote ${options.output} (${sourceFileCount} source file(s))`
    );

    const shouldAssert = options.assertAfterExport ?? true;
    if (shouldAssert) {
      const result = assertIosLcov(options.output, config.strict, config);
      if (result.code === EXIT_OK) {
        console.log(`[rn-coverage] ${result.message}`);
      } else if (result.code === EXIT_STRICT_EMPTY) {
        throw new StrictEmptyError(result.message);
      } else {
        console.warn(`[rn-coverage] ${result.message}`);
      }
    }

    if (options.deleteProfraw !== false) {
      ctx.profrawFiles.forEach((profrawPath) => {
        fs.rmSync(profrawPath, { force: true });
      });
    }
  } finally {
    fs.rmSync(rawLcovPath, { force: true });
  }

  return options.output;
}

export type IosReportOptions = {
  derivedData: string;
  configuration?: string;
  appName?: string;
  profdata?: string;
  outputDir?: string;
  config?: CoverageConfig;
};

/**
 * HTML report via `llvm-cov show -format=html`.
 */
export function reportIosHtml(options: IosReportOptions): string {
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const configuration = options.configuration ?? 'Debug';
  const appName = options.appName ?? config.app.iosProductName;
  const ctx = resolveIosCoverageContext(
    options.derivedData,
    configuration,
    appName,
    config.ios.frameworkNamePrefixes
  );

  const profdataPath =
    options.profdata ?? path.resolve(process.cwd(), 'coverage/ios/profdata');
  const outputDir =
    options.outputDir ?? path.resolve(process.cwd(), 'coverage/ios/html');

  if (!fs.existsSync(profdataPath)) {
    const message = `profdata not found at ${profdataPath} (run ios export first)`;
    if (config.strict) {
      throw new StrictEmptyError(message);
    }
    console.warn(`[rn-coverage] ${message}`);
    return outputDir;
  }

  if (ctx.coverageObjects.length === 0) {
    throw new Error(`No coverage objects found under ${ctx.productsDir}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  runOrThrow('xcrun', [
    'llvm-cov',
    'show',
    '-format=html',
    `-output-dir=${outputDir}`,
    '-instr-profile',
    profdataPath,
    ...buildObjectArgs(ctx.coverageObjects),
  ]);

  console.log(`[rn-coverage] Wrote HTML report to ${outputDir}`);
  return outputDir;
}

export type IosSummaryOptions = {
  derivedData: string;
  configuration?: string;
  appName?: string;
  profdata?: string;
  config?: CoverageConfig;
};

/**
 * Terminal summary via `llvm-cov report`.
 */
export function summarizeIos(options: IosSummaryOptions): string {
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const configuration = options.configuration ?? 'Debug';
  const appName = options.appName ?? config.app.iosProductName;
  const ctx = resolveIosCoverageContext(
    options.derivedData,
    configuration,
    appName,
    config.ios.frameworkNamePrefixes
  );

  const profdataPath =
    options.profdata ?? path.resolve(process.cwd(), 'coverage/ios/profdata');

  if (!fs.existsSync(profdataPath)) {
    const message = `profdata not found at ${profdataPath} (run ios export first)`;
    if (config.strict) {
      throw new StrictEmptyError(message);
    }
    console.warn(`[rn-coverage] ${message}`);
    return '';
  }

  if (ctx.coverageObjects.length === 0) {
    throw new Error(`No coverage objects found under ${ctx.productsDir}`);
  }

  const report = runOrThrow('xcrun', [
    'llvm-cov',
    'report',
    '-instr-profile',
    profdataPath,
    ...buildObjectArgs(ctx.coverageObjects),
  ]);

  console.log(report);
  return report;
}
