# react-native-coverage

Native code coverage tooling for **dedicated React Native test apps** (Pattern C).

- **TurboModule + codegen** (New Architecture only) — iOS LINKEDIT flush + Android Emma dump
- **CLI** (`rn-coverage`) — `android pull|report`, `ios pull|export|report|summary`, `assert`
- **Expo config plugin** (optional) — Android Gradle helpers + iOS dynamic frameworks + Podfile helper call
- **CocoaPods Ruby helper** — Pod LLVM flags + dynamic-framework restore (`require` + one call; safe split)
- **Gradle Jacoco helpers** — `android/rn-coverage.gradle` + `android/rn-coverage-jacoco.gradle`
- **docs.page** — see `docs/`

> Not for production product apps. Keep this package in your e2e/test harness workspace only.

## Install

```sh
yarn add react-native-coverage
# Expo (optional peer): add plugin to app config
```

## Example

The `example/` app is an Expo project linked via Yarn workspaces (`"react-native-coverage": "*"`).

E2E runner target: **Appium** (see `example/README.md`). Full Appium CI is a later item.

## Development

```sh
yarn
yarn prepare    # bob + plugin build
yarn test       # unit tests
yarn typecheck
node bin/rn-coverage.js --help
```

## License

Apache-2.0
