import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveCoverageConfig } from '../config';
import { EXIT_STRICT_EMPTY, StrictEmptyError } from '../exit-codes';
import {
  exportIosLcov,
  resolveIosCoverageContext,
  rewriteLcovFile,
} from '../process-ios-native-coverage';
import { monorepoRewriteRules } from '../../fixtures/monorepo-layout/rewrite-rules';

const derivedData = path.join(__dirname, '../../fixtures/export-layout/sim-dd');

describe('resolveIosCoverageContext', () => {
  it('finds app binary and zero profraw in fixture layout', () => {
    const ctx = resolveIosCoverageContext(
      derivedData,
      'Debug',
      'CoverageExample',
      []
    );
    expect(ctx.profrawFiles).toEqual([]);
    expect(ctx.coverageObjects).toHaveLength(1);
    expect(ctx.appBinary).toContain('CoverageExample.app/CoverageExample');
  });
});

describe('exportIosLcov', () => {
  it('throws StrictEmptyError when no profraw under strict', async () => {
    const config = resolveCoverageConfig({ strict: true });
    await expect(
      exportIosLcov({
        derivedData,
        configuration: 'Debug',
        appName: 'CoverageExample',
        output: path.join(derivedData, 'out/lcov.info'),
        config,
        assertAfterExport: false,
      })
    ).rejects.toBeInstanceOf(StrictEmptyError);
  });

  it('soft mode returns output path without throwing when no profraw', async () => {
    const config = resolveCoverageConfig({ strict: false });
    const output = path.join(derivedData, 'out-soft/lcov.info');
    await expect(
      exportIosLcov({
        derivedData,
        configuration: 'Debug',
        appName: 'CoverageExample',
        output,
        config,
        assertAfterExport: false,
      })
    ).resolves.toBe(output);
  });
});

describe('rewriteLcovFile (export path)', () => {
  it('rewrites fixture sample into packages/ paths', async () => {
    const input = path.join(
      __dirname,
      '../../fixtures/monorepo-layout/sample.lcov'
    );
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-export-rw-'));
    const output = path.join(tmp, 'rewritten.lcov');
    const { sourceFileCount } = await rewriteLcovFile(
      input,
      output,
      monorepoRewriteRules
    );
    expect(sourceFileCount).toBe(3);
    expect(EXIT_STRICT_EMPTY).toBe(2);
  });
});
