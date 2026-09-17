# Running e2e

The repository uses Appium/WDIO cells, not Detox:

- `yarn e2e:ios:dynamic`: bare harness with dynamic frameworks.
- `yarn e2e:ios:static`: Expo harness with static native coverage.
- `yarn e2e:android`: Expo harness with Emma/Jacoco coverage.

These commands are CI/operator-gated. Use a dedicated environment and never
occupy RNFB slot2 or slot3. On Xcode 26, prefer a non-RNFB simulator such as
`iPhone 17`.

Each iOS cell boots or reuses exactly one simulator, starts one Metro server,
one filtered simulator log stream, and one Appium server at a time. WDIO
attempts are serialized. The runner prefetches the Metro bundle, prebuilds WDA
outside `e2e/node_modules`, and performs complete recovery between attempts.
It does not launch the app with `simctl launch` before WDIO.

Artifacts live under `artifacts/e2e/`, including per-attempt Appium/WDIO logs,
full build logs, failure-only UI state, and generated coverage reports.
