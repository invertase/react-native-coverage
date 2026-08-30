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
| `sourcePathRewrite` | LCOV `SF:` path normalization rules |
| `strict` | Exit 2 on empty artifacts when true |

Defaults contain **no** product-specific names.
