import fs from 'node:fs';
import path from 'node:path';

import type { CoverageConfig } from './config';
import { DEFAULT_COVERAGE_CONFIG } from './config';
import { EXIT_OK, EXIT_STRICT_EMPTY } from './exit-codes';

export type AssertResult = {
  code: number;
  message: string;
};

function failEmpty(strict: boolean, message: string): AssertResult {
  if (strict) {
    return { code: EXIT_STRICT_EMPTY, message };
  }
  return { code: EXIT_OK, message: `(soft) ${message}` };
}

export type LcovAssertStats = {
  sourceFileCount: number;
  matchedPathHits: number;
  linesHit: number;
};

/**
 * Parse LCOV and count SF: paths matching configured includes.
 * When `lcovPathIncludes` is empty, any SF: path counts as a match.
 * `linesHit` sums `LH:` only for matched source files.
 */
export function analyzeLcov(
  lcovPath: string,
  lcovPathIncludes: string[] = []
): LcovAssertStats {
  const text = fs.readFileSync(lcovPath, 'utf8');
  let sourceFileCount = 0;
  let matchedPathHits = 0;
  let linesHit = 0;
  let currentMatched = false;

  for (const line of text.split('\n')) {
    if (line.startsWith('SF:')) {
      sourceFileCount += 1;
      const sf = line.slice(3).replace(/\\/g, '/');
      currentMatched =
        lcovPathIncludes.length === 0 ||
        lcovPathIncludes.some(
          (include) => sf.includes(include) || sf.startsWith(include)
        );
      if (currentMatched) {
        matchedPathHits += 1;
      }
    } else if (line.startsWith('LH:') && currentMatched) {
      linesHit += Number(line.slice(3)) || 0;
    } else if (line.startsWith('end_of_record')) {
      currentMatched = false;
    }
  }

  return { sourceFileCount, matchedPathHits, linesHit };
}

/**
 * Assert iOS (or any) LCOV has expected path hits with actual line coverage.
 * Exit 2 in strict mode when missing/empty/no matched SF: paths/no LH hits.
 */
export function assertIosLcov(
  lcovPath: string,
  strict: boolean,
  config: CoverageConfig = DEFAULT_COVERAGE_CONFIG,
  cwd: string = process.cwd()
): AssertResult {
  const relative = path.relative(cwd, lcovPath) || lcovPath;
  const includes = config.assert.lcovPathIncludes;

  if (!fs.existsSync(lcovPath)) {
    return failEmpty(strict, `iOS LCOV missing: ${relative}`);
  }

  const stat = fs.statSync(lcovPath);
  if (stat.size === 0) {
    return failEmpty(strict, `iOS LCOV empty (0 bytes): ${relative}`);
  }

  const { sourceFileCount, matchedPathHits, linesHit } = analyzeLcov(
    lcovPath,
    includes
  );

  if (matchedPathHits === 0 || linesHit === 0) {
    const includeDesc =
      includes.length > 0 ? includes.join(', ') : '(any SF: path)';
    return failEmpty(
      strict,
      `iOS LCOV has no expected path/line hits [${includeDesc}] (sourceFiles=${sourceFileCount}, matchedPathHits=${matchedPathHits}, linesHit=${linesHit}): ${relative}`
    );
  }

  return {
    code: EXIT_OK,
    message: `iOS ok: matchedPathHits=${matchedPathHits} sourceFiles=${sourceFileCount} linesHit=${linesHit} (${relative})`,
  };
}

export type JacocoAssertStats = {
  packageCount: number;
  lineCovered: number;
  lineMissed: number;
};

/**
 * Parse Jacoco XML package rollups. Matchers are case-insensitive substrings
 * of `<package name="...">`. Empty matchers → all packages.
 *
 * Jacoco uses `/` separators (`com/coverage/fixture`); configs often use Java
 * dots (`coverage.fixture`). Normalize both so either form matches.
 */
export function analyzeJacocoXml(
  xmlPath: string,
  packageIncludes: string[] = []
): JacocoAssertStats {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const packageBlocks = [
    ...xml.matchAll(/<package name="([^"]+)"[^>]*>([\s\S]*?)<\/package>/g),
  ];

  const normalizePkg = (value: string) =>
    value.toLowerCase().replace(/[./]/g, '/');
  const normalizedIncludes = packageIncludes.map(normalizePkg);

  let packageCount = 0;
  let lineCovered = 0;
  let lineMissed = 0;

  for (const match of packageBlocks) {
    const name = match[1]!;
    const body = match[2]!;
    const normalizedName = normalizePkg(name);
    if (
      normalizedIncludes.length > 0 &&
      !normalizedIncludes.some((m) => normalizedName.includes(m))
    ) {
      continue;
    }
    packageCount += 1;

    const trailing = body.match(
      /((?:<counter type="[^"]+" missed="\d+" covered="\d+"\/>\s*)+)$/
    );
    if (!trailing) {
      continue;
    }
    for (const c of trailing[1]!.matchAll(
      /<counter type="(LINE|INSTRUCTION)" missed="(\d+)" covered="(\d+)"\/>/g
    )) {
      if (c[1] === 'LINE') {
        lineMissed += Number(c[2]);
        lineCovered += Number(c[3]);
      }
    }
  }

  return { packageCount, lineCovered, lineMissed };
}

/**
 * Assert Android Jacoco XML has expected package LINE hits.
 * Exit 2 in strict mode when missing/empty/no covered lines in matched packages.
 */
export function assertAndroidJacoco(
  xmlPath: string,
  strict: boolean,
  config: CoverageConfig = DEFAULT_COVERAGE_CONFIG,
  cwd: string = process.cwd()
): AssertResult {
  const relative = path.relative(cwd, xmlPath) || xmlPath;
  const includes =
    config.assert.jacocoPackageIncludes.length > 0
      ? config.assert.jacocoPackageIncludes
      : config.android.libraryProjectMatchers;

  if (!fs.existsSync(xmlPath)) {
    return failEmpty(strict, `Android Jacoco XML missing: ${relative}`);
  }

  const stat = fs.statSync(xmlPath);
  if (stat.size === 0) {
    return failEmpty(strict, `Android Jacoco XML empty (0 bytes): ${relative}`);
  }

  const { packageCount, lineCovered, lineMissed } = analyzeJacocoXml(
    xmlPath,
    includes
  );

  if (packageCount === 0 || lineCovered === 0) {
    const includeDesc =
      includes.length > 0 ? includes.join(', ') : '(any package)';
    return failEmpty(
      strict,
      `Android Jacoco has empty package hits [${includeDesc}] (packages=${packageCount}, lineCovered=${lineCovered}, lineMissed=${lineMissed}): ${relative}`
    );
  }

  return {
    code: EXIT_OK,
    message: `Android ok: packages=${packageCount} lineCovered=${lineCovered} lineMissed=${lineMissed} (${relative})`,
  };
}

export type AssertCoverageOptions = {
  platform?: 'ios' | 'android' | 'all';
  lcov?: string;
  jacocoXml?: string;
  strict?: boolean;
  config?: CoverageConfig;
  cwd?: string;
};

/**
 * Post-pipeline presence check. Returns the highest-priority failure code
 * (prefer EXIT_STRICT_EMPTY over EXIT_OK).
 */
export function assertCoverage(
  options: AssertCoverageOptions = {}
): AssertResult {
  const config = options.config ?? DEFAULT_COVERAGE_CONFIG;
  const strict = options.strict ?? config.strict;
  const cwd = options.cwd ?? process.cwd();
  const platform = options.platform ?? 'all';

  const lcov = options.lcov ?? path.resolve(cwd, config.assert.defaultLcovPath);
  const jacocoXml =
    options.jacocoXml ?? path.resolve(cwd, config.assert.defaultJacocoXmlPath);

  const results: AssertResult[] = [];

  if (platform === 'ios' || platform === 'all') {
    results.push(assertIosLcov(lcov, strict, config, cwd));
  }
  if (platform === 'android' || platform === 'all') {
    results.push(assertAndroidJacoco(jacocoXml, strict, config, cwd));
  }

  let code = EXIT_OK;
  const messages: string[] = [];
  for (const result of results) {
    messages.push(result.message);
    if (result.code === EXIT_STRICT_EMPTY) {
      code = EXIT_STRICT_EMPTY;
    } else if (result.code !== EXIT_OK && code === EXIT_OK) {
      code = result.code;
    }
  }

  return {
    code,
    message: messages.join('\n'),
  };
}
