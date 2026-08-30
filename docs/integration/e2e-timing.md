# E2E timing (document only)

Glue for when to flush and pull belongs in the consumer test runner (Jet, Detox, Mocha, Appium, etc.). This package does not ship a particular e2e framework.

Typical sequence:

1. Run instrumented e2e against the dedicated test app.
2. Invoke `Coverage.flush()` (TurboModule) once at suite teardown.
3. Host-side: `rn-coverage android pull` / `rn-coverage ios pull`.
4. `rn-coverage android report` or `rn-coverage ios export` (+ optional `ios report` / `ios summary`).
5. Optional: `rn-coverage assert` (exit 2 on empty artifacts when `strict: true`).

The example app documents Appium as the intended e2e runner. CI wiring:

- `yarn e2e:ios:dynamic` — primary bare-RN dynamic frameworks cell
- `yarn e2e:ios:static` — Expo static cell
- `yarn e2e:android` — Expo Android Jacoco cell

Scripts live under `scripts/ci/`; WDIO specs under `e2e/`.
