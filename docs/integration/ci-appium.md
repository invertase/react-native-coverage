# CI Appium notes (learned the hard way)

Practical pitfalls from getting GitHub Actions green for this package’s Appium cells. Consumer CI should copy the same patterns.

## Matrix

| Cell | Harness | What it proves |
|------|---------|----------------|
| `e2e:ios:dynamic` | `example-dynamic/` (bare RN, `USE_FRAMEWORKS=dynamic`) | Primary LLVM LCOV with a real dynamic `CoverageFixture.framework` |
| `e2e:ios:static` | `example/` (Expo prebuild, static merge) | Honest static cell still asserts fixture hits |
| `e2e:android` | `example/` (Expo + emulator) | Emma `.ec` → Jacoco → assert |

Scripts: `scripts/ci/`. Specs: `e2e/`.

## iOS / Xcode / simulator

- Prefer **`macos-26`** + **`maxim-lobanov/setup-xcode`** with `latest-stable` (Expo SDK 57 wants Xcode 26.4+).
- Default simulator name: **`iPhone 17`**. Xcode 26.6 images do not ship a plain `iPhone 16`; wrong names fail destination lookup.
- Boot with an exact-name match, open **Simulator.app**, then poll `bootstatus` (see `scripts/ci/boot-ios-simulator.sh`). Headless `simctl boot` alone + Appium restart hung at WDA timeouts on GHA.
- Give Appium room: `simulatorStartupTimeout` ≥ 300s and WDA/session
  timeouts above cold WDA's observed 3–5 minute range.
- List sims once before the run (`xcrun simctl list`) — same deflake idea as RNFB.
- Prefetch the iOS Metro bundle after `/status` is ready. Prebuild WDA once
  under `artifacts/e2e/wda-derived-data`, install it, and set
  `IOS_WDA_APP_PATH`; do not place DerivedData in `e2e/node_modules`.
- Use two or three serialized outer WDIO attempts and
  `connectionRetryCount: 0`. Between attempts, delete sessions, terminate and
  reinstall the app, stop Appium, clear Appium/WDA ports, and reuse prebuilt
  WDA. Never overlap `POST /session`.
- Keep `noReset: false`, `forceAppLaunch: true`, and do not pre-launch the app
  with `simctl launch`.

## Android / Metro / Appium

- Debug APK loads JS from Metro. Emulator `localhost` is **not** the host — run **`adb reverse tcp:8081 tcp:8081`** (or your Metro port) before launching the app, or the bundle never loads and Appium never sees UI.
- React Native `testID` on Android maps to **`resource-id`**, not accessibility id. Prefer a shared helper (`byTestId`) that uses `UiSelector().resourceId(...)` on Android and `~id` on iOS.
- Allow a long `appWaitDuration` for first Metro bundle.

## Android coverage pull → Jacoco

1. Staging path (`android.detoxStagingPath`, default `/data/local/tmp/coverage/coverage.ec`): **`mkdir -p` the parent** before `run-as … cat … > staging`. Unlike Detox’s `/data/local/tmp/detox/`, this package does not create that directory for you (`rn-coverage android pull` does).
2. Land `emulator_coverage.ec` under the **app `buildDir`** (e.g. `android/app/build/outputs/code_coverage/`). Jacoco `executionData` is a `fileTree` over `project.buildDir` (+ matched libraries). Pulling only into `artifacts/` leaves `:app:jacocoTestReport` **SKIPPED** with empty data.
3. Assert matchers: Jacoco XML package names use **slashes** (`com/coverage/fixture`). Config often uses Java **dots** (`coverage.fixture`). `rn-coverage assert` normalizes `/` ↔ `.` — keep matchers readable either way.

## Action pins

Pin third-party Actions by **full commit SHA** (and comment the release tag). Typo’d SHAs fail the job before any app code runs.

## Artifacts

Upload `artifacts/e2e/coverage/**` and `artifacts/e2e/logs/**` with `if: always()` so failed pulls/asserts remain diagnosable.

Each iOS cell has one narrowly filtered `simctl log stream`. Appium simulator
capture is disabled while `showXcodeLog` retains WDA host build output in the
Appium log. Full build/Appium/simulator logs stay in artifacts; live output is
limited to phase markers and failure excerpts. Screenshots, page source, app
state, process/port state, and flake classification are failure-only.

## Reproducible setup

CI installs the root `Gemfile.lock` with `BUNDLE_FROZEN=true` and runs
`bundle exec pod install`. Yarn, simulator boot, Bundler, and transient pod
operations use bounded retries. Expo-backed Metro runs set
`EXPO_UNSTABLE_HEADLESS=1`; completed logs must not contain a standalone React
Native DevTools installation failure.

Live Appium cells are CI/operator-gated. They are not Detox jobs, must not use
RNFB slot2/slot3, and should use a dedicated iPhone 17 simulator on Xcode 26.
