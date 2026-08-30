import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  monorepoRewriteRules,
  sampleLcovPaths,
} from '../../fixtures/monorepo-layout/rewrite-rules';
import { resolveCoverageConfig } from '../config';
import { applySourcePathRewrite, normalizeSourcePath } from '../path-rewrite';
import {
  collectCoverageObjects,
  rewriteLcovFile,
} from '../process-ios-native-coverage';

describe('path-rewrite', () => {
  it('strips to packages/ via after-marker', () => {
    expect(normalizeSourcePath(sampleLcovPaths[0]!, monorepoRewriteRules)).toBe(
      'packages/core/ios/Core.mm'
    );
  });

  it('rewrites scoped package paths via regex', () => {
    expect(normalizeSourcePath(sampleLcovPaths[1]!, monorepoRewriteRules)).toBe(
      'packages/analytics/android/src/Main.kt'
    );
  });

  it('normalizes Windows separators before rewrite', () => {
    expect(normalizeSourcePath(sampleLcovPaths[3]!, monorepoRewriteRules)).toBe(
      'packages/core/ios/Core.mm'
    );
  });

  it('returns input when no rule matches', () => {
    expect(normalizeSourcePath('/opt/other/file.c', monorepoRewriteRules)).toBe(
      '/opt/other/file.c'
    );
  });

  it('applySourcePathRewrite includeMarker=false drops the marker', () => {
    expect(
      applySourcePathRewrite('/repo/packages/foo.ts', {
        kind: 'after-marker',
        marker: '/packages/',
        includeMarker: false,
      })
    ).toBe('foo.ts');
  });
});

describe('rewriteLcovFile', () => {
  it('rewrites SF: lines using config rules', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-lcov-'));
    const input = path.join(
      __dirname,
      '../../fixtures/monorepo-layout/sample.lcov'
    );
    const output = path.join(tmp, 'out.lcov');

    const { sourceFileCount } = await rewriteLcovFile(
      input,
      output,
      monorepoRewriteRules
    );

    expect(sourceFileCount).toBe(3);
    const text = fs.readFileSync(output, 'utf8');
    expect(text).toContain('SF:packages/core/ios/Core.mm');
    expect(text).toContain('SF:packages/analytics/android/src/Main.kt');
    expect(text).toContain('SF:tests/e2e/helpers.cpp');
  });
});

describe('collectCoverageObjects', () => {
  it('includes app binary and prefix-matched frameworks', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-objs-'));
    const products = path.join(tmp, 'Products');
    const appDir = path.join(products, 'CoverageExample.app');
    const fwDir = path.join(appDir, 'Frameworks', 'LibCore.framework');
    fs.mkdirSync(fwDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'CoverageExample'), '');
    fs.writeFileSync(path.join(fwDir, 'LibCore'), '');
    fs.mkdirSync(path.join(appDir, 'Frameworks', 'Other.framework'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(appDir, 'Frameworks', 'Other.framework', 'Other'),
      ''
    );

    const objects = collectCoverageObjects(products, 'CoverageExample', [
      'Lib',
    ]);
    expect(objects).toEqual([
      path.join(appDir, 'CoverageExample'),
      path.join(fwDir, 'LibCore'),
    ]);
  });
});

describe('resolveCoverageConfig', () => {
  it('uses neutral defaults with no product names', () => {
    const config = resolveCoverageConfig();
    expect(config.nativeModuleName).toBe('Coverage');
    expect(config.strict).toBe(true);
    expect(JSON.stringify(config)).not.toMatch(/react-native-firebase|RNFB/i);
  });

  it('merges partial overrides', () => {
    const config = resolveCoverageConfig({
      app: { androidApplicationId: 'com.acme.tests' },
      ios: { frameworkNamePrefixes: ['Acme'] },
    });
    expect(config.app.androidApplicationId).toBe('com.acme.tests');
    expect(config.app.iosBundleId).toBe('com.example.coverage');
    expect(config.ios.frameworkNamePrefixes).toEqual(['Acme']);
  });
});
