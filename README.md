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

E2E runner: **Appium** (WebDriverIO). CI cells on every PR:

| Cell | Path | Notes |
|------|------|-------|
| iOS **dynamic** (primary) | `example-dynamic/` | Bare RN + dynamic frameworks; non-zero fixture LCOV gate |
| iOS **static** | `example/` | Expo staticlib merge; fixture hits still asserted |
| Android | `example/` | Jacoco + Appium |

```sh
yarn e2e:ios:dynamic
yarn e2e:ios:static
yarn e2e:android
```

## Development

```sh
yarn
yarn prepare    # bob + plugin build
yarn test       # unit tests
yarn typecheck
node bin/rn-coverage.js --help
```

## Releasing

Conventional Commits + semantic-release; **manual** GitHub Actions `workflow_dispatch` only (no push-to-main publish). Operator steps: [docs/releasing.md](./docs/releasing.md).

## License

Apache-2.0
