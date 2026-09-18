# Validation checklist

- Dependencies install successfully with `yarn`.
- Package and plugin build with `yarn prepare`.
- Relevant tests pass; use `yarn test:coverage` for final unit evidence.
- `yarn typecheck` and `yarn lint` pass.
- `node bin/rn-coverage.js --help` exits successfully.
- `yarn workspace react-native-coverage-example exec expo install --check`
  reports no dependency drift after Expo changes.
- Shell scripts pass `bash -n`.
- After Gemfile changes, `BUNDLE_FROZEN=true bundle check` succeeds and `json`
  stays at `2.21.2` (`quirks_mode` still required by CocoaPods / Expo autolinking).
- Workflow YAML and coverage configuration are inspected for explicit paths,
  pinned Actions, and strict failure handling.
- Native/Appium changes are marked unproved until their operator-gated cells
  pass and upload complete logs and coverage artifacts.
