# Agent notes

- Yarn workspaces monorepo: library at repo root; Expo harness in `example/`; bare dynamic harness in `example-dynamic/`; Appium under `e2e/`.
- Pattern C: dedicated test apps only — do not wire this into product apps.
- Native TurboModule flusher is implemented (iOS mode-c LINKEDIT + Android Emma). `flush()` also dumps Istanbul `global.__coverage__` when present. Example uses `coverage-fixture` for non-zero lib hits.
- Build integration: Expo plugin + `cocoapods/coverage_post_install.rb` + `android/rn-coverage*.gradle` (example applies all three).
- JS/TS: `RN_COVERAGE_JS=1` → babel-plugin-istanbul; `rn-coverage js pull|report` (NYC sourceMap remap). Unit: `yarn test:coverage`.
- CI: `yarn e2e:ios:dynamic` (primary), `yarn e2e:ios:static`, `yarn e2e:android` — see `.github/workflows/ci.yml` and `docs/integration/ci-appium.md`.
- Release: Conventional Commits + semantic-release via `.github/workflows/release.yml` (`workflow_dispatch` only); PR titles via `.github/workflows/pr-title.yml`. Operator docs: `docs/releasing.md`. No `@semantic-release/git`.
- Validation: `yarn`, `yarn prepare`, `yarn test` / `yarn test:coverage`, `yarn typecheck`, CLI `--help`.
- Appium e2e for this package is in-scope when the task asks; do not use RNFB slot2/3. Prefer a non-RNFB simulator (e.g. iPhone 17 on Xcode 26).
- Full OKF / work-queue governance may land later; keep ephemeral notes under `.agents/` (gitignored).
