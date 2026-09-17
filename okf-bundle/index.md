# Repository execution guide

This bundle defines the public, repository-specific rules for authoring and
validating changes to `react-native-coverage`.

- [Iteration vocabulary](testing/iteration-vocabulary.md)
- [Change authoring workflow](testing/change-authoring-workflow.md)
- [Agent command policy](testing/agent-command-policy.md)
- [Validation checklist](testing/validation-checklist.md)
- [Running e2e](testing/running-e2e.md)
- [Coverage design](testing/coverage-design.md)

The library is at the repository root. Dedicated test harnesses live in
`example/` (Expo/static), `example-dynamic/` (bare/dynamic), and `e2e/`
(Appium). Coverage integration belongs in dedicated test apps, not product
applications.
