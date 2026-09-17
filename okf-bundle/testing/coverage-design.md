# Coverage design

Coverage is split into explicit Codecov flags:

- `unit-js`: Jest LCOV from `coverage/unit/lcov.info`.
- `e2e-ios-dynamic`: native LLVM LCOV and Istanbul LCOV from the bare harness.
- `e2e-ios-static`: native LLVM LCOV and Istanbul LCOV from the Expo harness.
- `e2e-android`: Jacoco XML and Istanbul LCOV from the Expo harness.

E2e Metro bundles are instrumented only when `RN_COVERAGE_JS=1`. Calling
`flush()` writes Istanbul data and then native LLVM/Emma data. NYC remaps JS
coverage to harness and `coverage-fixture` TypeScript sources.

Reports must contain expected fixture/harness records with non-zero line hits.
CI uploads only explicit report files after report generation succeeds.
Fixture implementation paths under `fixtures/**` are excluded from repository
coverage policy; the dedicated `example/fixture-lib` workspace remains part of
e2e evidence.
