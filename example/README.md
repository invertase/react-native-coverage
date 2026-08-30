# react-native-coverage example (Expo)

Dedicated Expo test harness for the library (Pattern C). Workspace dependency:

```json
"react-native-coverage": "*"
```

## Scripts

```sh
yarn start
yarn ios          # expo run:ios (dev client / prebuild)
yarn android      # expo run:android
yarn prebuild     # generates ios/ android/ + applies coverage plugin
```

## Fixture library

`fixture-lib/` (`coverage-fixture`) is an instrumented TurboModule used to prove
non-zero native coverage under multi-image LLVM flush (iOS) and Jacoco (Android).

## Appium (e2e)

**Appium** is the intended e2e runner for flush → pull → export proof.

Scaffold status: stub only. Add WebDriverIO/Appium config and CI in a later queue item. Until then, manually:

1. `yarn prebuild` then `yarn ios` / `yarn android` (New Architecture)
2. App auto-runs fixture `hit()` + `flush()` on mount
3. `rn-coverage ios pull` / `rn-coverage android pull` from the host
4. `rn-coverage ios export` / `rn-coverage android report` + `rn-coverage assert`

Do not expect Appium CI on this branch yet.
