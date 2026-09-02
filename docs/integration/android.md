# Android integration

Enable Android test coverage in your dedicated test app (Pattern C) and wire Jacoco reporting.

## Expo (recommended)

Add the config plugin — it applies both Gradle helpers and enables debug `testCoverageEnabled`:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-coverage",
        {
          "libraryProjectMatchers": ["coverage-fixture", "my-native-lib"],
          "enableAndroidCoverage": true
        }
      ]
    ]
  }
}
```

Then:

```sh
npx expo prebuild
```

Inspect `android/build.gradle` (root instrumentation) and `android/app/build.gradle` (Jacoco report + `testCoverageEnabled`).

## Bare React Native / manual Gradle

In the **root** `android/build.gradle`:

```gradle
ext.coverageLibraryProjectMatchers = ['my-native-lib']
def rnCoverageRoot = new File(
  ["node", "--print", "require.resolve('react-native-coverage/package.json')"]
    .execute(null, rootDir).text.trim()
).parentFile
apply from: new File(rnCoverageRoot, "android/rn-coverage.gradle")
```

In **app** `android/app/build.gradle`:

```gradle
android {
  buildTypes {
    debug {
      testCoverageEnabled true
    }
  }
}

def rnCoverageRoot = new File(
  ["node", "--print", "require.resolve('react-native-coverage/package.json')"]
    .execute(null, rootDir).text.trim()
).parentFile
apply from: new File(rnCoverageRoot, "android/rn-coverage-jacoco.gradle")
```

## Runtime + CLI

1. Call `flush()` from the TurboModule at the end of an e2e run (Emma `RT.dumpCoverageData` → `filesDir/coverage.ec`; also dumps Istanbul JSON when Metro is instrumented).
2. `rn-coverage android pull` — output under **`android/app/build/…`** so Jacoco sees the `.ec` (not only `artifacts/`). Staging parent dirs are created for you.
3. `rn-coverage android report` (`jacocoTestReport`).
4. `rn-coverage assert` (strict empty → exit 2).
5. Optional JS: `rn-coverage js pull` / `js report` — see [JS / TypeScript](js.md).

Jacoco package names in XML use slashes (`com/foo`); assert matchers may use dots (`com.foo`) — both work.

CI pitfalls (emulator Metro, `byTestId`, etc.): [CI Appium notes](ci-appium.md).

Shipped helpers:

| File | Role |
|------|------|
| `android/rn-coverage.gradle` | Enable Jacoco + `enableAndroidTestCoverage` on matched library projects |
| `android/rn-coverage-jacoco.gradle` | `jacocoTestReport` / unit / e2e-only report tasks |

Pod LLVM flags are **not** applied by regex-editing the Podfile; use the Ruby helper on iOS (see [iOS integration](ios.md)).
