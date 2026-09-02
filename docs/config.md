# Config

Copy [`react-native-coverage.config.js.example`](../react-native-coverage.config.js.example) to `react-native-coverage.config.js` in your dedicated test app.

Key fields:

| Key | Purpose |
|-----|---------|
| `nativeModuleName` | TurboModule name (default `Coverage`) |
| `app.androidApplicationId` | `run-as` package for adb pull |
| `app.iosBundleId` | simctl container lookup |
| `app.iosProductName` | App binary / `.app` name |
| `ios.frameworkNamePrefixes` | Extra llvm-cov `-object` frameworks |
| `android.coverageRelativePath` | On-device `.ec` path under app files |
| `android.libraryProjectMatchers` | Fallback Jacoco package substrings for assert |
| `android.jacocoReportXml` | Default Jacoco XML path after `android report` |
| `js.androidRelativePath` | On-device Istanbul JSON under `run-as` (default `files/coverage-final.json`) |
| `js.androidStagingPath` | adb staging path for JS JSON pull |
| `js.iosRelativePath` | Path under sim data container (default `Documents/coverage-final.json`) |
| `sourcePathRewrite` | LCOV `SF:` path normalization rules |
| `strict` | Exit **2** on empty artifacts when true (CI default) |
| `assert.lcovPathIncludes` | Substrings required in ≥1 LCOV `SF:` (default `packages/`) |
| `assert.jacocoPackageIncludes` | Jacoco package name substrings that must have LINE covered (`.` or `/`) |
| `assert.defaultLcovPath` | Default `--lcov` for `rn-coverage assert` |
| `assert.defaultJacocoXmlPath` | Default `--jacoco-xml` for `rn-coverage assert` |

Defaults contain **no** product-specific names.
