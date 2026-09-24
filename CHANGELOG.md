# Changelog

All notable changes to this project are documented here.

This file is maintained by [semantic-release](https://github.com/semantic-release/semantic-release):
each entry is generated from [Conventional Commits](https://www.conventionalcommits.org/) and
corresponds to a published npm version, a `v*` git tag, and a GitHub Release.

> The `0.1.0`–`0.2.1` sections below were reconstructed retroactively from git history and the
> existing GitHub Releases (this file was added after the fact). Entries from `0.2.2` onward are
> written automatically by `@semantic-release/changelog` at release time.

## [0.2.1](https://github.com/invertase/react-native-coverage/compare/v0.2.0...v0.2.1) (2026-09-18)

### Bug Fixes

* **ci:** root JS coverage instrumentation at the workspace ([52b6c18](https://github.com/invertase/react-native-coverage/commit/52b6c18a9489b0b7965639ecceea29f90e2a26e4))
* launch prebuilt WDA via xcodebuild instead of simctl ([d372d20](https://github.com/invertase/react-native-coverage/commit/d372d20eedf04ef8be3a797d60db1a3319f2d18d))
* pin Appium to the xcodebuild product and always reinstall ([8b71e56](https://github.com/invertase/react-native-coverage/commit/8b71e56ce2b7ded5cbc490fec7d136d24c6807d5))
* recover Expo pod lock drift and pin json 2.21.2 ([7533c89](https://github.com/invertase/react-native-coverage/commit/7533c89ba619166c4b798077e9f022a582a559b4))
* take the expected Expo 57.0.24 patch ([a64dd6c](https://github.com/invertase/react-native-coverage/commit/a64dd6c2a451d998b220f2085995fd8718ba85ed))
* treat already-installed Appium drivers as success ([d4fd00b](https://github.com/invertase/react-native-coverage/commit/d4fd00b5fe9b6b468698abe8fa0a461b2bbaa46b))

## [0.2.0](https://github.com/invertase/react-native-coverage/compare/v0.1.0...v0.2.0) (2026-09-02)

> **Note:** `0.2.0` was a trusted-publishing smoke test and carries no user-facing changes over
> `0.1.0`. The commit that triggered it was typed `feat:` and so burned a real minor; infrastructure
> and publishing tests should use `chore:`/`test:` to avoid consuming a version.

### Features

* trusted publish commit test ([4b8b717](https://github.com/invertase/react-native-coverage/commit/4b8b717df2d6ad7b49063479626b5fdd8f963a12))

## 0.1.0 (2026-09-02)

Initial public release.

### Features

* add JS/TS coverage with Istanbul, NYC remap, and Codecov ([4c39e09](https://github.com/invertase/react-native-coverage/commit/4c39e09c39bf997491de00cb04bb67802fb7329e))
* add manual semantic-release and commitlint scaffolding ([309e307](https://github.com/invertase/react-native-coverage/commit/309e30792edc4e1d103a2f065f6e1f3b811a28a3))
* add Appium e2e CI for dynamic and static iOS cells ([6304bb1](https://github.com/invertase/react-native-coverage/commit/6304bb158216408f7c23541433c6c731cad5fd53))
* wire Expo Gradle and CocoaPods coverage build helpers ([ad4250d](https://github.com/invertase/react-native-coverage/commit/ad4250de64ec0193da8dbfb82842c358e21f816a))
* port native TurboModule coverage flushers and fixture lib ([22d8918](https://github.com/invertase/react-native-coverage/commit/22d8918b18b3ecac0dfd32fb19186ba0c03c8a30))
* **cli:** add full coverage CLI with strict exit 2 ([3f6f2cf](https://github.com/invertase/react-native-coverage/commit/3f6f2cfb594200d1ccf3fb592ec2801b2d6e3bc5))
* scaffold react-native-coverage package and tooling ([2314f9a](https://github.com/invertase/react-native-coverage/commit/2314f9aa708c7f9ea8ea46748266506878650770))
