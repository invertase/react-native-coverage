# react-native-coverage

**Testing is the backpressure you need in this brave agentic future.**  
Coverage is the evidence so agents do not hand-wave past the testing.  
You found the module for **integrated native coverage proof on iOS and Android**.

TurboModule flush → pull/export → LCOV/Jacoco reports → `assert` in CI.  
Dedicated **test / e2e harness apps only** (Pattern C). New Architecture only.

> Not for production product apps. Put this in your harness workspace, not the shipping `package.json`.

---

## Have your agent wire it up

Paste this into your coding agent (Cursor, Claude, Codex, etc.) **before** you touch Gradle or Podfiles by hand:

```text
Integrate react-native-coverage into this repo's dedicated React Native test /
e2e harness app only (Pattern C — never the production app package.json).

Constraints:
- New Architecture / TurboModule only
- Follow https://github.com/invertase/react-native-coverage and docs under docs/
- Prefer the Expo config plugin when the harness is Expo; otherwise use the bare
  Gradle + CocoaPods Ruby helpers from docs/integration/
- Wire libraryProjectMatchers / frameworkNamePrefixes for every native library
  we need hits from
- Add CI steps that pull coverage and fail with rn-coverage assert (or equivalent)
  when hits are empty (exit 2)
- Do not invent product-app install paths; keep the package out of the shipping app

After install: yarn/npm add react-native-coverage in the harness, apply plugin or
manual hooks, prebuild/pod install as needed, then show me the exact CI commands
to run and what green looks like.
```

Then install in the **harness** (not the product app):

```sh
yarn add react-native-coverage
# or: npm install react-native-coverage
```

Expo harness — add the plugin (see [Android](./docs/integration/android.md) / [iOS](./docs/integration/ios.md) for options):

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-coverage",
        {
          "libraryProjectMatchers": ["my-native-lib"],
          "frameworkNamePrefixes": ["MyLib"],
          "enableAndroidCoverage": true,
          "forceDynamicFrameworks": false
        }
      ]
    ]
  }
}
```

```sh
npx expo prebuild
```

Bare RN: apply `android/rn-coverage*.gradle` and `cocoapods/coverage_post_install.rb` as documented. Copy `react-native-coverage.config.js.example` if you need host-specific paths.

**Prove it in CI** (empty hits must fail):

```sh
rn-coverage android pull && rn-coverage android report
rn-coverage ios pull && rn-coverage ios export && rn-coverage ios report
rn-coverage assert   # exit 2 when coverage is empty — that is the point
```

Full CLI surface: [docs/cli.md](./docs/cli.md).

---

## What you get

| Piece | Role |
|-------|------|
| **TurboModule** | iOS LINKEDIT flush + Android Emma dump from the running app |
| **CLI (`rn-coverage`)** | `android pull\|report`, `ios pull\|export\|report\|summary`, `assert` |
| **Expo config plugin** | Gradle helpers + Podfile helper call (safe split) |
| **CocoaPods Ruby helper** | Pod LLVM flags + optional dynamic-framework restore |
| **Gradle Jacoco helpers** | `android/rn-coverage.gradle` + `android/rn-coverage-jacoco.gradle` |

Docs: [docs/](./docs/index.md) · Pattern C · Android · iOS · Config · [Releasing](./docs/releasing.md)

---

## Example / CI cells

This repo's `example/` (Expo) and `example-dynamic/` (bare, dynamic frameworks) are the harness. **Appium** (WebDriverIO) on every PR:

| Cell | Path | Notes |
|------|------|-------|
| iOS **dynamic** (primary) | `example-dynamic/` | Non-zero fixture LCOV gate |
| iOS **static** | `example/` | Expo staticlib merge; fixture hits still asserted |
| Android | `example/` | Jacoco + Appium |

```sh
yarn
yarn prepare
yarn test
yarn e2e:ios:dynamic
yarn e2e:ios:static
yarn e2e:android
node bin/rn-coverage.js --help
```

---

## Releasing

Conventional Commits + semantic-release; **manual** `workflow_dispatch` only (no push-to-main publish). Operator steps: [docs/releasing.md](./docs/releasing.md).

## License

Apache-2.0
