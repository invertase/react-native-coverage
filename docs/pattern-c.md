# Pattern C — dedicated test apps only

`react-native-coverage` is intended for **dedicated test / e2e harness apps** (for example a monorepo `tests/` app), not production product `package.json` trees.

Autolinking still scans dependencies; do not rely on `devDependency` alone to keep the TurboModule out of a product app. Keep the package in the test app workspace only.
