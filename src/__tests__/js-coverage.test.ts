import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { reportJsCoverage } from '../js-coverage';

describe('reportJsCoverage', () => {
  it('produces lcov.info from a minimal Istanbul JSON fixture', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-js-cov-'));
    const input = path.join(tmp, 'coverage-final.json');
    // Minimal Istanbul coverage map for a fake file (no source map → SF stays as key).
    const fakeFile = path.join(tmp, 'App.tsx');
    fs.writeFileSync(fakeFile, 'export const x = 1;\n');
    fs.writeFileSync(
      input,
      JSON.stringify({
        [fakeFile]: {
          path: fakeFile,
          statementMap: {
            '0': {
              start: { line: 1, column: 0 },
              end: { line: 1, column: 18 },
            },
          },
          fnMap: {},
          branchMap: {},
          s: { '0': 1 },
          f: {},
          b: {},
        },
      })
    );

    const nycConfig = path.join(tmp, 'nyc.config.js');
    fs.writeFileSync(
      nycConfig,
      `module.exports = { include: ['**/*'], cwd: ${JSON.stringify(tmp)}, sourceMap: false, instrument: false, reporter: ['lcov'] };\n`
    );

    const out = path.join(tmp, 'out');
    const result = reportJsCoverage({
      input,
      outputDir: out,
      cwd: tmp,
      nycConfig,
      softFail: false,
    });
    expect(result.ok).toBe(true);
    expect(result.lcovPath).toBe(path.join(out, 'lcov.info'));
    expect(fs.readFileSync(result.lcovPath!, 'utf8')).toContain('SF:');
  });
});
