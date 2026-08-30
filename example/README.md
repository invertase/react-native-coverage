# react-native-coverage example (Expo)

Dedicated Expo test harness for the library (Pattern C). Workspace dependency:

```json
"react-native-coverage": "*"
```

This is the **iOS static** CI cell. The **primary dynamic** cell is
`example-dynamic/` (bare RN + `USE_FRAMEWORKS=dynamic`) because Expo force-statics
React-Core and cannot host distinct `CoverageFixture.framework` images.

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

> Expo keeps React-Core static, so `forceDynamicFrameworks` must stay **false** here (CocoaPods rejects dynamic Coverage* pods that depend on static React). Multi-image LINKEDIT with distinct `.framework` images remains for bare RN / RNFB dynamic hosts (`example-dynamic/`).

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

**Appium** (WebDriverIO) is the e2e runner for flush → pull → export proof.

From repo root:

```sh
yarn e2e:ios:static     # this Expo app (static cell)
yarn e2e:ios:dynamic    # example-dynamic (primary)
yarn e2e:android        # this Expo app (Jacoco)
```

Specs live in `e2e/specs/`. CI runs these on every PR (see `.github/workflows/ci.yml`).
