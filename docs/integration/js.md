# JavaScript / TypeScript coverage

Complete the React Native coverage story alongside native LLVM/Jacoco:

| Layer | Tooling | Artifact |
|-------|---------|----------|
| Unit (package) | Jest `--coverage` | `coverage/unit/lcov.info` |
| E2e JS/TS | `babel-plugin-istanbul` + NYC source-map remap | `coverage/js/lcov.info` |
| Native iOS | llvm-cov | `lcov.info` |
| Native Android | Jacoco | `jacocoTestReport.xml` |

## Instrument Metro (e2e)

Set `RN_COVERAGE_JS=1` before starting Metro (CI scripts do this). Example babel configs load `babel-plugin-istanbul` only when that env is set.

`flush()` dumps `global.__coverage__` via TurboModule `dumpJsCoverage` **before** the native Emma/LLVM flush:

- Android → `filesDir/coverage-final.json` (`files/coverage-final.json` under `run-as`)
- iOS → `Documents/coverage-final.json`

## CLI

```sh
rn-coverage js pull --platform android --output coverage/js
rn-coverage js pull --platform ios --device <udid> --output coverage/js

rn-coverage js report \
  --input coverage/js/coverage-final.json \
  --output coverage/js \
  --cwd . \
  --nyc-config example/nyc.config.js
```

NYC is configured with `sourceMap: true` and `exclude-after-remap: true` so LCOV `SF:` paths point at **TypeScript** sources (not only the Metro-transformed JS line map). Ship a `nyc.config.js` next to the harness (see `example/nyc.config.js`).

Both harness configs include their entrypoint/App source and the shared
`example/fixture-lib/src` workspace. CI runs `assert-js-lcov.js` after NYC and
requires non-zero records for both the harness and fixture library; merely
creating an LCOV file is not sufficient.

### Instrumentation scope is workspace-rooted

`coverage-fixture` is a yarn workspace symlink, so Metro resolves it to the
realpath `example/fixture-lib/src/*.ts` — outside `example-dynamic/`. A
default-configured `babel-plugin-istanbul` roots `test-exclude` at the babel
cwd and silently skips everything outside it, so the bundle builds and the e2e
passes while the LCOV quietly omits the shared library.

Both harnesses therefore pass explicit `cwd`/`include` options to
`babel-plugin-istanbul` and set matching `cwd`/`include` in `nyc.config.js`,
all rooted at the monorepo. `SF:` paths are workspace-relative
(`example/fixture-lib/src/index.ts`, `example-dynamic/App.tsx`) in every cell.
`scripts/ci/assert-istanbul-scope.js` runs in the `unit` job and fails if
either harness stops instrumenting the fixture sources — a device-free guard,
since the e2e cells themselves cannot catch a scope regression.

## Codecov

CI uploads unit LCOV, e2e native LCOV/Jacoco, and e2e JS LCOV with distinct
flags (`unit-js`, `e2e-ios-dynamic`, `e2e-ios-static`, and `e2e-android`).
Reports are explicit; automatic report search is disabled. Configure the
repository-specific `CODECOV_TOKEN`. Upload failures are blocking except for
Dependabot, and uploads run only after successful report generation.
