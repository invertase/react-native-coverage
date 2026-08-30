# Android integration

Enable Android test coverage in your dedicated test app and wire Jacoco reporting.

- Set `testCoverageEnabled = true` for debug builds (Expo plugin injects a marker / debug flag).
- Call `flush()` from the TurboModule at the end of an e2e run before `rn-coverage android pull`
  (Emma `RT.dumpCoverageData` → `filesDir/coverage.ec`).
- Apply the package Gradle Jacoco helper when published (full helper lands with build-integration work).

Expo consumers can list the config plugin in `app.json` / `app.config.ts` for app-target mods. Pod LLVM flags are **not** applied by regex-editing the Podfile; use the Ruby helper on iOS.
