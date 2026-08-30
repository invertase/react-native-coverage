import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import type { CoverageConfig, SourcePathRewriteRule } from './config';
import { DEFAULT_COVERAGE_CONFIG } from './config';
import { normalizeSourcePath } from './path-rewrite';

export type IosExportOptions = {
  derivedData: string;
  configuration: string;
  appName: string;
  output: string;
  config?: CoverageConfig;
  /** When true, delete processed `.profraw` files after a successful export. */
  deleteProfraw?: boolean;
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

  const matchesPrefix = (name: string) =>
    frameworkNamePrefixes.some((prefix) => name.startsWith(prefix));

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

/**
 * Merge profraw → profdata → LCOV with path rewrite.
 * Ported from RNFB process-ios-native-coverage.js with config-driven prefixes/rewrite.
 */
export async function exportIosLcov(
  options: IosExportOptions
): Promise<string> {
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const productsDir = path.join(
    options.derivedData,
    'Build/Products',
    `${options.configuration}-iphonesimulator`
  );
  const appBinary = path.join(
    productsDir,
    `${options.appName}.app`,
    options.appName
  );
  const profileDataDir = path.join(options.derivedData, 'Build/ProfileData');
  const simulatorCoverageDir = path.join(
    options.derivedData,
    'output/coverage'
  );

  const profrawFiles = [
    ...walkFiles(simulatorCoverageDir, (filePath) =>
      filePath.endsWith('.profraw')
    ),
    ...walkFiles(profileDataDir, (filePath) => filePath.endsWith('.profraw')),
  ];

  if (profrawFiles.length === 0) {
    throw new Error(
      `No .profraw files under ${simulatorCoverageDir} or ${profileDataDir}.`
    );
  }

  if (!fs.existsSync(appBinary)) {
    throw new Error(`App binary not found at ${appBinary}`);
  }

  const coverageObjects = collectCoverageObjects(
    productsDir,
    options.appName,
    config.ios.frameworkNamePrefixes
  );
  if (coverageObjects.length === 0) {
    throw new Error(`No coverage objects found under ${productsDir}`);
  }

  fs.mkdirSync(path.dirname(options.output), { recursive: true });

  const profdataPath = path.join(path.dirname(options.output), 'profdata');
  runOrThrow('xcrun', [
    'llvm-profdata',
    'merge',
    '-sparse',
    ...profrawFiles,
    '-o',
    profdataPath,
  ]);

  const rawLcovPath = path.join(path.dirname(options.output), 'lcov.raw');
  try {
    const exportArgs = ['llvm-cov', 'export', '-instr-profile', profdataPath];
    coverageObjects.forEach((objectPath) => {
      exportArgs.push('-object', objectPath);
    });
    exportArgs.push('-format=lcov');
    runToFileOrThrow('xcrun', exportArgs, rawLcovPath);

    const { sourceFileCount } = await rewriteLcovFile(
      rawLcovPath,
      options.output,
      config.sourcePathRewrite
    );

    console.log(
      `[rn-coverage] Wrote ${options.output} (${sourceFileCount} source file(s))`
    );

    if (options.deleteProfraw !== false) {
      profrawFiles.forEach((profrawPath) => {
        fs.rmSync(profrawPath, { force: true });
      });
    }
  } finally {
    fs.rmSync(rawLcovPath, { force: true });
  }

  return options.output;
}
