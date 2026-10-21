<p align="center">
  <a href="https://docs.page/invertase/react-native-coverage">
    <img src="./docs/assets/brand/invertase-honeycomb-96x96.png" alt="Invertase" height="96" />
  </a>
  <br /><br />
  <strong>Native code coverage for React Native</strong><br /><br />
  <span>A React Native library for iOS and Android that records which lines of your native code your end-to-end tests ran. Use this package to collect coverage, write LCOV, JaCoCo, and TypeScript reports, and fail CI when a report is empty.</span>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/react-native-coverage"><img src="https://img.shields.io/npm/dm/react-native-coverage" alt="npm downloads" /></a>
  <a href="https://www.npmjs.com/package/react-native-coverage"><img src="https://img.shields.io/npm/v/react-native-coverage" alt="npm version" /></a>
  <a href="https://app.codecov.io/gh/invertase/react-native-coverage"><img src="https://codecov.io/gh/invertase/react-native-coverage/branch/main/graph/badge.svg" alt="Codecov" /></a>
  <a href="https://docs.page/invertase/react-native-coverage"><img src="https://img.shields.io/badge/docs-docs.page-E8983A" alt="Docs" /></a>
  <img src="https://img.shields.io/badge/architecture-New%20Arch%20only-2D303A" alt="New Architecture only" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0" /></a>
</p>

<p align="center">
  <a href="https://docs.page/invertase/react-native-coverage">Docs</a> &bull;
  <a href="./CONTRIBUTING.md">Contribute</a>
</p>

JavaScript coverage tools only see the JavaScript bundle. The Objective-C++, Swift, and Kotlin in your TurboModules run on the device during end-to-end tests, but no report records them. Unit tests mock those modules, so they do not record them either. A passing build can therefore ship a native change with no evidence that the change ran, including a change a coding agent wrote.

> **Important:** Add this package only to a [dedicated test app](https://docs.page/invertase/react-native-coverage/coverage#dedicated-test-app), never to the app you ship. Listing it as a `devDependency` does not keep it out, because autolinking still includes the native module. That test app must run React Native's New Architecture.

## Install

**Prompt your agent:**

```txt
Read https://docs.page/invertase/react-native-coverage/app-developers.md, and set up react-native-coverage in this project.
```

**Or set it up yourself** in three steps.

### 1. Add the package to the test app

```sh
yarn add react-native-coverage
# or: npm install react-native-coverage
```

### 2. Turn coverage on in the test app's build

Follow the path that matches the test app.

**If the test app uses Expo:** add the config plugin to its `app.json` file, then generate the native projects.

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

**If the test app does not use Expo:** apply the shipped `android/rn-coverage*.gradle` helpers and the `cocoapods/coverage_post_install.rb` helper. Use the [Android](https://docs.page/invertase/react-native-coverage/integration/android) and [iOS](https://docs.page/invertase/react-native-coverage/integration/ios) pages for where each file goes. Copy `react-native-coverage.config.js.example` if your paths differ from the defaults.

### 3. Flush, pull, report, and assert

After your tests, call `Coverage.flush()` once, then build the reports:

```sh
# Android
rn-coverage android pull && rn-coverage android report

# iOS
rn-coverage ios pull && rn-coverage ios export && rn-coverage ios report

rn-coverage assert
```

`rn-coverage assert` exits 2 when a report is missing or empty, which fails the job.

Use the [App developers](https://docs.page/invertase/react-native-coverage/app-developers) guide for both setups in full, and the [CLI](https://docs.page/invertase/react-native-coverage/reference/cli) page for every other command.

## How coverage works

Build the test app with coverage turned on, using the Expo config plugin or the Gradle and CocoaPods helpers. When the tests finish, call `Coverage.flush()` to write coverage out of the running app. Then use `rn-coverage` to build the reports and fail the job when a report is empty.

| Feature | What it does |
|---------|--------------|
| **Expo config plugin**, or the Gradle and CocoaPods helpers | Turns native coverage on when the test app is built |
| **TurboModule** | `flush()` writes the iOS LLVM counters and the Android Emma dump, plus Istanbul `global.__coverage__` when that data is present |
| **CLI** (`rn-coverage`) | `pull` and `report` build the LCOV and JaCoCo files. `assert` exits 2 when those files are missing or empty |
| **JavaScript and TypeScript coverage** | `babel-plugin-istanbul` and NYC map the instrumented bundle back to the TypeScript you edit |

## Coverage results

This repository runs the same setup on every pull request, with its example apps on an iOS Simulator and an Android emulator under Appium. Find the reports on [Codecov](https://app.codecov.io/gh/invertase/react-native-coverage).

<p align="center">
  <a href="https://app.codecov.io/gh/invertase/react-native-coverage">
    <img src="./docs/assets/codecov/dashboard.png" alt="Codecov dashboard for react-native-coverage, showing overall coverage, the three-month trend, the sunburst graph, and the native code tree" width="900" />
  </a>
</p>

Each flag is one run of the example apps:

| Flag | Example app | What ran | Coverage |
|------|-------------|----------|---------:|
| `e2e-ios-dynamic` | `example-dynamic/` | iOS native, dynamic frameworks | 90.6% |
| `e2e-ios-static` | `example/` | iOS native, static libraries | 63.1% |
| `e2e-android` | `example/` | Android native (Emma to JaCoCo) | 81.7% |
| `unit-js` | This repository | Jest unit tests, JavaScript and TypeScript | 52.6% |

The package also measures its own native code. Its iOS source file, [`ios/Coverage.mm`](https://app.codecov.io/gh/invertase/react-native-coverage/blob/main/ios/Coverage.mm), has 71.88% line coverage. The screenshot shows which of its lines ran. Use the [Contributing guide](./CONTRIBUTING.md) to run the example apps locally.

<p align="center">
  <img src="./docs/assets/codecov/ios-coverage-mm.png" alt="Codecov line-by-line view of ios/Coverage.mm at 71.88%, Objective-C++ TurboModule code shown covered and partially covered" width="900" />
</p>

## Used in production

- <img src="./docs/assets/consumers/react-native-firebase.png" alt="" width="16" height="16" /> [invertase/react-native-firebase](https://github.com/invertase/react-native-firebase)
- <img src="./docs/assets/consumers/react-native-google-mobile-ads.svg" alt="" width="16" height="16" /> [invertase/react-native-google-mobile-ads](https://github.com/invertase/react-native-google-mobile-ads)

## More information

- [Coverage](https://docs.page/invertase/react-native-coverage/coverage) — what it measures and how the pipeline works
- Install guides for [app developers](https://docs.page/invertase/react-native-coverage/app-developers), [library maintainers](https://docs.page/invertase/react-native-coverage/library-maintainers), and [coding agents](https://docs.page/invertase/react-native-coverage/agents)
- [CLI](https://docs.page/invertase/react-native-coverage/reference/cli) and [Configuration](https://docs.page/invertase/react-native-coverage/reference/config)
- [Empty or missing coverage](https://docs.page/invertase/react-native-coverage/troubleshooting/empty-coverage)

## Contributing

- Questions: [Discord](https://invertase.link/discord)
- Bugs & feature requests: [Open an issue](https://github.com/invertase/react-native-coverage/issues/new/choose)
- [Pull requests](https://github.com/invertase/react-native-coverage/pulls)
- [Contributing guide](./CONTRIBUTING.md)
- [Releasing](https://docs.page/invertase/react-native-coverage/releasing)
- [Code of Conduct](https://github.com/invertase/.github/blob/main/CODE_OF_CONDUCT.md)

## License

Apache-2.0 — see [LICENSE](./LICENSE).

---

<p align="center">
  <a href="https://invertase.io/?utm_source=readme&utm_medium=footer&utm_campaign=react-native-coverage">
    <img src="https://static.invertase.io/assets/invertase/invertase-rounded-avatar.png" alt="Invertase" width="48" height="48" />
  </a>
  <br />
  Built and maintained by <a href="https://invertase.io/?utm_source=readme&utm_medium=footer&utm_campaign=react-native-coverage">Invertase</a>.
</p>
