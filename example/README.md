# react-native-coverage example (Expo)

Dedicated Expo test harness for the library (Pattern C). Workspace dependency:

```json
"react-native-coverage": "*"
```

## Scripts

```sh
yarn start
yarn ios
yarn android
```

## Appium (e2e)

**Appium** is the intended e2e runner for flush → pull → export proof.

Scaffold status: stub only. Add WebDriverIO/Appium config and CI in a later queue item. Until then, manually:

1. `expo prebuild` / run the app with New Architecture
2. Exercise native code under test
3. Call `flush()` from JS
4. `rn-coverage android pull` / `rn-coverage ios pull` from the host

Do not expect Appium CI on this branch yet.
