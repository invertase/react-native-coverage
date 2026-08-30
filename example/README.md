# react-native-coverage example (Expo)

Dedicated Expo test harness for the library (Pattern C). Workspace dependency:

```json
"react-native-coverage": "*"
```

## Enable coverage wiring

`app.json` lists the config plugin with fixture matchers:

```json
[
  "react-native-coverage",
  {
    "frameworkNamePrefixes": ["CoverageFixture"],
    "libraryProjectMatchers": ["coverage-fixture", "react-native-coverage"],
    "forceDynamicFrameworks": false,
    "enableAndroidCoverage": true
  }
]
```

`yarn prebuild` then applies **all three** production paths:

| Path | What gets applied |
|------|-------------------|
| Expo config plugin | `ios.useFrameworks=dynamic`, Android `testCoverageEnabled`, Gradle `apply from`, Podfile `require` + helper call |
| CocoaPods Ruby helper | LLVM flags + `CoverageConfig.h` regen; optional dynamic-framework restore (off under Expo) |
| Gradle Jacoco helpers | `android/rn-coverage.gradle` (library instrumentation) + `android/rn-coverage-jacoco.gradle` (report tasks) |

> Expo keeps React-Core static, so `forceDynamicFrameworks` must stay **false** here (CocoaPods rejects dynamic Coverage* pods that depend on static React). Multi-image LINKEDIT with distinct `.framework` images remains for bare RN / RNFB dynamic hosts.

## Scripts

```sh
yarn start
yarn ios          # expo run:ios (dev client / prebuild)
yarn android      # expo run:android
yarn prebuild     # generates ios/ android/ + applies coverage plugin
```

## Fixture library

`fixture-lib/` (`coverage-fixture`) is an instrumented TurboModule used to prove
non-zero native coverage under multi-image LLVM flush (iOS) and Jacoco (Android).

## Appium (e2e)

**Appium** is the intended e2e runner for flush → pull → export proof.

Scaffold status: stub only. Add WebDriverIO/Appium config and CI in a later queue item. Until then, manually:

1. `yarn prebuild` then `yarn ios` / `yarn android` (New Architecture)
2. App auto-runs fixture `hit()` + `flush()` on mount
3. `rn-coverage ios pull` / `rn-coverage android pull` from the host
4. `rn-coverage ios export` / `rn-coverage android report` + `rn-coverage assert`

Do not expect Appium CI on this branch yet.
