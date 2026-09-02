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
  --cwd example \
  --nyc-config example/nyc.config.js
```

NYC is configured with `sourceMap: true` and `exclude-after-remap: true` so LCOV `SF:` paths point at **TypeScript** sources (not only the Metro-transformed JS line map). Ship a `nyc.config.js` next to the harness (see `example/nyc.config.js`).

## Codecov

CI uploads unit LCOV, e2e native LCOV/Jacoco, and e2e JS LCOV with distinct `flags` (`unit-js`, `e2e-ios-dynamic`, …). Wire `CODECOV_TOKEN` (or Codecov GitHub app OIDC) on the repo for private uploads; public repos may work tokenless depending on Codecov settings.
