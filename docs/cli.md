# CLI

Binary: `rn-coverage`

```
rn-coverage --help
rn-coverage [--strict|--no-strict] [-c <config>]

rn-coverage android pull [--device <serial>] [--output <dir>] [--retries <n>]
rn-coverage android report [--android-dir <path>] [--jacoco-xml <path>]

rn-coverage ios pull --device <udid> [--output <dir>]
rn-coverage ios export --derived-data <path> [--configuration Debug] [--app-name <name>] [--output <path>]
rn-coverage ios report --derived-data <path> [--profdata <path>] [--output-dir <path>]
rn-coverage ios summary --derived-data <path> [--profdata <path>]

rn-coverage assert [--platform ios|android|all] [--lcov <path>] [--jacoco-xml <path>]
```

## Exit codes

| Code | Meaning |
|------|---------|
| **0** | Success (or soft-mode empty artifact with warning) |
| **1** | Unexpected error / bad invocation / tooling failure |
| **2** | Strict empty-hit / missing artifact (CI presence guard) |

### Strict / assert contract

- Config default: `strict: true` (recommended for CI).
- Global flags: `--strict` / `--no-strict` override config for the process.
- Soft local (`--no-strict` or `strict: false`): missing/empty expected hits **warn and exit 0**.
- Strict CI: the same conditions **exit 2** so a sabotaged or silent pipeline fails the job.

Commands that enforce the guard:

| Command | Exit 2 when (strict) |
|---------|----------------------|
| `android pull` | No `.ec` after retries |
| `android report` | Gradle ok but Jacoco XML missing/empty/no matched LINE hits |
| `ios pull` | No `.profraw` in the simulator container |
| `ios export` | No `.profraw`, or LCOV has no expected path hits with `LH` > 0 (default: `packages/`) |
| `ios report` / `ios summary` | Missing `profdata` (run `ios export` first) |
| `assert` | Dedicated post-pipeline check for LCOV and/or Jacoco XML |

`rn-coverage assert` is the package-owned replacement for one-off shell presence scripts. Prefer wiring this CLI (exit 2) into consumer CI rather than maintaining a permanent bespoke assert.

Matchers and default artifact paths live under `assert.*` in config (see [config.md](./config.md)).
