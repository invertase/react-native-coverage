#!/usr/bin/env node
'use strict';

const fs = require('fs');

function missingExpectations(lcov) {
  const records = lcov.split('end_of_record').map((record) => {
    const source = record.match(/^SF:(.+)$/m)?.[1] ?? '';
    const hits = [...record.matchAll(/^DA:\d+,(\d+)/gm)].reduce(
      (sum, match) => sum + Number(match[1]),
      0
    );
    return { source, hits };
  });
  const expectations = [
    {
      name: 'harness',
      matches: (source) => /(?:^|[\\/])App\.tsx$/.test(source),
    },
    {
      name: 'fixture-lib',
      matches: (source) =>
        /(?:^|[\\/])fixture-lib[\\/]src[\\/].+\.(?:ts|tsx)$/.test(source) ||
        /(?:^|[\\/])coverage-fixture(?:[\\/]src)?[\\/].+\.(?:ts|tsx)$/.test(
          source
        ),
    },
  ];
  return expectations.filter(
    ({ matches }) =>
      !records.some(({ source, hits }) => matches(source) && hits > 0)
  );
}

if (process.argv[2] === '--self-test') {
  const fixtureWorkspace =
    'SF:App.tsx\nDA:1,1\nend_of_record\n' +
    'SF:/repo/example/fixture-lib/src/index.ts\nDA:1,2\nend_of_record\n';
  // Both cells now report workspace-relative paths.
  const fixtureWorkspaceRelative =
    'SF:example-dynamic/App.tsx\nDA:1,1\nend_of_record\n' +
    'SF:example/fixture-lib/src/index.ts\nDA:1,2\nend_of_record\n';
  const fixturePackageRemap =
    'SF:/repo/example-dynamic/src/App.tsx\nDA:1,1\nend_of_record\n' +
    'SF:/repo/node_modules/coverage-fixture/src/index.ts\nDA:1,2\nend_of_record\n';
  const fixturePackageRoot =
    'SF:C:\\repo\\App.tsx\nDA:1,1\nend_of_record\n' +
    'SF:C:\\repo\\coverage-fixture\\index.ts\nDA:1,2\nend_of_record\n';
  const emptyFixture =
    'SF:/repo/App.tsx\nDA:1,1\nend_of_record\n' +
    'SF:/repo/example/fixture-lib/src/index.ts\nDA:1,0\nend_of_record\n';
  if (
    missingExpectations(fixtureWorkspace).length !== 0 ||
    missingExpectations(fixtureWorkspaceRelative).length !== 0 ||
    missingExpectations(fixturePackageRemap).length !== 0 ||
    missingExpectations(fixturePackageRoot).length !== 0 ||
    missingExpectations(emptyFixture)
      .map(({ name }) => name)
      .join() !== 'fixture-lib'
  ) {
    throw new Error('assert-js-lcov self-test failed');
  }
  console.log('assert-js-lcov self-test: ok');
  process.exit(0);
}

const lcovPath = process.argv[2];
if (!lcovPath) {
  console.error('usage: assert-js-lcov.js <lcov.info>');
  process.exit(1);
}

const missing = missingExpectations(fs.readFileSync(lcovPath, 'utf8'));

if (missing.length > 0) {
  console.error(
    `[js-coverage] missing non-zero records: ${missing
      .map(({ name }) => name)
      .join(', ')} (${lcovPath})`
  );
  process.exit(2);
}

console.log(`[js-coverage] harness and fixture-lib hits verified: ${lcovPath}`);
