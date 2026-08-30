# react-native-coverage

Native code coverage tooling for **dedicated React Native test apps** (Pattern C).

- **TurboModule + codegen** (New Architecture only) — `flush()` stub today; full flusher later
- **CLI** (`rn-coverage`) — `android pull|report`, `ios pull|export|report|summary`, `assert`
- **Expo config plugin** (optional) — Android + stable iOS app-target mods
- **CocoaPods Ruby helper** — Pod LLVM flags via `require` + one call (safe split)
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
