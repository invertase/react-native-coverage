# Android integration

Enable Android test coverage in your dedicated test app and wire Jacoco reporting.

Scaffold notes:

- Set `testCoverageEnabled = true` for debug builds.
- Apply the package Gradle Jacoco helper when published (full helper lands with build-integration work).
- Call `flush()` from the TurboModule at the end of an e2e run before `rn-coverage android pull`.

Expo consumers can list the config plugin in `app.json` / `app.config.ts` for app-target mods. Pod LLVM flags are **not** applied by regex-editing the Podfile; use the Ruby helper on iOS.
