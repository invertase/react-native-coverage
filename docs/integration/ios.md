# iOS integration

- New Architecture only; TurboModule autolinks via the podspec.
- Flusher packaging (dynamic frameworks): **mode (c)** — Pod LINKEDIT for
  configured `frameworkNamePrefixes` **and** the main executable (see spike verdict).

## Expo (recommended)

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-coverage",
        {
          "frameworkNamePrefixes": ["MyLib"],
          "forceDynamicFrameworks": false
        }
      ]
    ]
  }
}
```

Keep `forceDynamicFrameworks` **false** under Expo (React-Core is force-static). Set **true** only on bare RN / RNFB hosts that build React as dynamic frameworks.

## CI cells (honest matrix)

| Cell | App | Linkage | Gate |
|------|-----|---------|------|
| **iOS dynamic (primary)** | `example-dynamic/` bare RN | `use_frameworks! :linkage => :dynamic` | Non-zero fixture LCOV **and** `CoverageFixture.framework` is a dylib |
| **iOS static** | `example/` Expo | staticlib merge into app / `.debug.dylib` | Non-zero fixture LCOV |
| **Android** | `example/` Expo | Jacoco-instrumented libraries | Non-zero fixture package LINE hits |

Appium (WebDriverIO) drives the harness; see `e2e/` and `scripts/ci/run-ios-e2e-cell.sh`.

1. Sets `ios.useFrameworks=dynamic` in Podfile properties (needed for multi-image LINKEDIT on dynamic-React hosts).
2. Requires the shipped Ruby helper and calls `apply_post_install!` once (safe split — no Podfile regex for LLVM flags).
3. Optionally restores dynamic frameworks for `Coverage` + matched fixture pods
   (`forceDynamicFrameworks: true`) — **only when React is also dynamic**
   (bare RN / RNFB). Leave `false` under Expo (React-Core is force-static);
   CocoaPods rejects dynamic Coverage* pods that transitively depend on static
   React-Core. Under Expo, Coverage* remain static libraries merged into the app.

```sh
npx expo prebuild
cd ios && pod install
```

## Bare React Native / manual Podfile

```ruby
require_relative '../node_modules/react-native-coverage/cocoapods/coverage_post_install'

# After `use_expo_modules!` (wraps Installer so restore runs after Expo's staticlib downgrade):
ReactNativeCoverage.install_installer_hooks!

post_install do |installer|
  ReactNativeCoverage.apply_post_install!(
    installer,
    framework_name_prefixes: ['MyLib'],
    force_dynamic_frameworks: true
  )
end
```

The helper:

- Applies LLVM `-fprofile-instr-generate` / `-fcoverage-mapping` (+ link flags) to the app target and matching pods.
- Regenerates `ios/CoverageConfig.h` from `framework_name_prefixes`.
- Restores `Pod::BuildType.dynamic_framework` for Coverage / fixture pods when Expo forced `static_library`.

## Runtime + CLI

Call `flush()` before `rn-coverage ios pull`, then `rn-coverage ios export` for LCOV.

The Expo config plugin wires the Podfile helper call; it does **not** replace the Ruby helper for Pod LLVM flags (safe split).
