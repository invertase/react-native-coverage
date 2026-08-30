# Agent notes

- Yarn workspaces monorepo: library at repo root, Expo harness in `example/`.
- Pattern C: dedicated test apps only — do not wire this into product apps.
- Native TurboModule flusher is implemented (iOS mode-c LINKEDIT + Android Emma). Example uses `coverage-fixture` for non-zero lib hits.
- Build integration: Expo plugin + `cocoapods/coverage_post_install.rb` + `android/rn-coverage*.gradle` (example applies all three).
- Validation: `yarn`, `yarn prepare`, `yarn test`, `yarn typecheck`, CLI `--help`.
- Do not use e2e hosts/emulators unless the task explicitly requires Appium CI work.
- Full OKF / work-queue governance may land later; keep ephemeral notes under `.agents/` (gitignored).
