#!/usr/bin/env node
'use strict';

/**
 * Device-free guard for JS e2e coverage scope.
 *
 * `coverage-fixture` is a workspace symlink, so Metro hands babel the realpath
 * `example/fixture-lib/src/*.ts`. That path sits outside `example-dynamic/`,
 * and a default-configured babel-plugin-istanbul silently skips anything
 * outside the babel cwd — the bundle builds, the app runs, the e2e passes, and
 * the JS LCOV is quietly missing the shared library.
 *
 * Transform the real fixture source with each harness's babel config and
 * require instrumentation, so the scope cannot regress without a red unit job.
 */

const path = require('path');
const babel = require('@babel/core');

const ROOT = path.resolve(__dirname, '../..');
const FIXTURE = path.join(ROOT, 'example/fixture-lib/src/index.ts');
const HARNESSES = ['example', 'example-dynamic'];

function isInstrumented(code) {
  return /cov_[a-z0-9]+|coverageData/.test(code);
}

function transform(harnessDir, enabled) {
  process.env.RN_COVERAGE_JS = enabled ? '1' : '0';
  const result = babel.transformFileSync(FIXTURE, {
    cwd: harnessDir,
    root: harnessDir,
    configFile: path.join(harnessDir, 'babel.config.js'),
    babelrc: false,
    filename: FIXTURE,
  });
  return result.code;
}

let failed = false;
for (const harness of HARNESSES) {
  const dir = path.join(ROOT, harness);
  if (!isInstrumented(transform(dir, true))) {
    console.error(
      `[istanbul-scope] ${harness}: fixture-lib source is NOT instrumented with RN_COVERAGE_JS=1`
    );
    failed = true;
    continue;
  }
  if (isInstrumented(transform(dir, false))) {
    console.error(
      `[istanbul-scope] ${harness}: fixture-lib source is instrumented without RN_COVERAGE_JS=1`
    );
    failed = true;
    continue;
  }
  console.log(`[istanbul-scope] ${harness}: fixture-lib instrumentation ok`);
}

process.exit(failed ? 1 : 0);
