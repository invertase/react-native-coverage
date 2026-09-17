# Command policy

Canonical repository commands:

```sh
yarn
yarn prepare
yarn test
yarn test:coverage
yarn typecheck
yarn lint
node bin/rn-coverage.js --help
yarn e2e:ios:dynamic
yarn e2e:ios:static
yarn e2e:android
```

Use the non-e2e commands locally in proportion to the change. The three e2e
commands create live Appium sessions and use simulators/emulators; they are
CI/operator-gated and must not be run without an available dedicated test
environment and explicit approval.

Do not wire coverage into product apps. Do not use RNFB slot2 or slot3. Do not
pre-launch an iOS harness before WDIO, because that can create pre-test hits.
