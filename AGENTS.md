# Agent notes

- Yarn workspaces monorepo: library at repo root, Expo harness in `example/`.
- Pattern C: dedicated test apps only — do not wire this into product apps.
- Native flusher is intentionally stubbed until the native port item; prefer CLI/config/fixture work first.
- Validation: `yarn`, `yarn prepare`, `yarn test`, `yarn typecheck`, CLI `--help`.
- Do not use e2e hosts/emulators unless the task explicitly requires Appium CI work.
- Full OKF / work-queue governance may land later; keep ephemeral notes under `.agents/` (gitignored).
