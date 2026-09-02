import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  analyzeJacocoXml,
  analyzeLcov,
  assertAndroidJacoco,
  assertCoverage,
  assertIosLcov,
} from '../assert-coverage';
import { resolveCoverageConfig } from '../config';
import { EXIT_OK, EXIT_STRICT_EMPTY } from '../exit-codes';

const fixtures = path.join(__dirname, '../../fixtures/assert');

describe('analyzeLcov', () => {
  it('counts packages/ SF paths by default include', () => {
    const stats = analyzeLcov(path.join(fixtures, 'good.lcov'), ['packages/']);
    expect(stats.sourceFileCount).toBe(2);
    expect(stats.matchedPathHits).toBe(2);
    expect(stats.linesHit).toBe(2);
  });

  it('reports zero matched hits when SF paths miss includes', () => {
    const stats = analyzeLcov(path.join(fixtures, 'no-packages.lcov'), [
      'packages/',
    ]);
    expect(stats.sourceFileCount).toBe(1);
    expect(stats.matchedPathHits).toBe(0);
  });
});

describe('assertIosLcov', () => {
  const config = resolveCoverageConfig();

  it('passes on fixture LCOV with packages/ hits', () => {
    const result = assertIosLcov(
      path.join(fixtures, 'good.lcov'),
      true,
      config,
      fixtures
    );
    expect(result.code).toBe(EXIT_OK);
    expect(result.message).toContain('matchedPathHits=2');
  });

  it('exits 2 in strict mode when packages/ hits missing', () => {
    const result = assertIosLcov(
      path.join(fixtures, 'no-packages.lcov'),
      true,
      config,
      fixtures
    );
    expect(result.code).toBe(EXIT_STRICT_EMPTY);
  });

  it('exits 2 in strict mode on empty file', () => {
    const result = assertIosLcov(
      path.join(fixtures, 'empty.lcov'),
      true,
      config,
      fixtures
    );
    expect(result.code).toBe(EXIT_STRICT_EMPTY);
    expect(result.message).toContain('empty');
  });

  it('exits 2 in strict mode when file missing', () => {
    const result = assertIosLcov(
      path.join(fixtures, 'missing.lcov'),
      true,
      config,
      fixtures
    );
    expect(result.code).toBe(EXIT_STRICT_EMPTY);
    expect(result.message).toContain('missing');
  });

  it('exits 2 in strict mode when packages/ paths exist but LH is 0', () => {
    const result = assertIosLcov(
      path.join(fixtures, 'zero-hits.lcov'),
      true,
      config,
      fixtures
    );
    expect(result.code).toBe(EXIT_STRICT_EMPTY);
    expect(result.message).toContain('linesHit=0');
  });

  it('soft mode returns 0 with warning message', () => {
    const result = assertIosLcov(
      path.join(fixtures, 'no-packages.lcov'),
      false,
      config,
      fixtures
    );
    expect(result.code).toBe(EXIT_OK);
    expect(result.message).toContain('(soft)');
  });
});

describe('assertAndroidJacoco', () => {
  it('passes when matched package has LINE covered', () => {
    const config = resolveCoverageConfig({
      assert: { jacocoPackageIncludes: ['example.lib'] },
    });
    const result = assertAndroidJacoco(
      path.join(fixtures, 'good-jacoco.xml'),
      true,
      config,
      fixtures
    );
    expect(result.code).toBe(EXIT_OK);
    expect(result.message).toContain('lineCovered=4');
  });

  it('exits 2 when matched package has zero LINE covered', () => {
    const config = resolveCoverageConfig({
      assert: { jacocoPackageIncludes: ['example.lib'] },
    });
    const result = assertAndroidJacoco(
      path.join(fixtures, 'empty-hits-jacoco.xml'),
      true,
      config,
      fixtures
    );
    expect(result.code).toBe(EXIT_STRICT_EMPTY);
  });

  it('falls back to libraryProjectMatchers', () => {
    const config = resolveCoverageConfig({
      android: { libraryProjectMatchers: ['example.lib'] },
    });
    const stats = analyzeJacocoXml(
      path.join(fixtures, 'good-jacoco.xml'),
      config.android.libraryProjectMatchers
    );
    expect(stats.packageCount).toBe(1);
    expect(stats.lineCovered).toBe(4);
  });

  it('matches dotted includes against slash Jacoco package names', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-jacoco-slash-'));
    const xmlPath = path.join(tmp, 'report.xml');
    fs.writeFileSync(
      xmlPath,
      `<?xml version="1.0"?>
<report name="app">
  <package name="com/coverage/fixture">
    <counter type="INSTRUCTION" missed="0" covered="10"/>
    <counter type="LINE" missed="2" covered="27"/>
  </package>
</report>
`
    );
    const stats = analyzeJacocoXml(xmlPath, ['coverage.fixture']);
    expect(stats.packageCount).toBe(1);
    expect(stats.lineCovered).toBe(27);
    expect(stats.lineMissed).toBe(2);
  });
});

describe('assertCoverage', () => {
  it('platform=ios only checks LCOV', () => {
    const config = resolveCoverageConfig();
    const result = assertCoverage({
      platform: 'ios',
      lcov: path.join(fixtures, 'good.lcov'),
      strict: true,
      config,
      cwd: fixtures,
    });
    expect(result.code).toBe(EXIT_OK);
  });

  it('platform=all fails when android artifact missing under strict', () => {
    const config = resolveCoverageConfig();
    const result = assertCoverage({
      platform: 'all',
      lcov: path.join(fixtures, 'good.lcov'),
      jacocoXml: path.join(fixtures, 'missing-jacoco.xml'),
      strict: true,
      config,
      cwd: fixtures,
    });
    expect(result.code).toBe(EXIT_STRICT_EMPTY);
  });
});
