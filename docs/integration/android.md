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

1. Call `flush()` from the TurboModule at the end of an e2e run (Emma `RT.dumpCoverageData` → `filesDir/coverage.ec`).
2. `rn-coverage android pull` then `rn-coverage android report` (`jacocoTestReport`).
3. `rn-coverage assert` (strict empty → exit 2).

Shipped helpers:

| File | Role |
|------|------|
| `android/rn-coverage.gradle` | Enable Jacoco + `enableAndroidTestCoverage` on matched library projects |
| `android/rn-coverage-jacoco.gradle` | `jacocoTestReport` / unit / e2e-only report tasks |

Pod LLVM flags are **not** applied by regex-editing the Podfile; use the Ruby helper on iOS (see [iOS integration](ios.md)).
