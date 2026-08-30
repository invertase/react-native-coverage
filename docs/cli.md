# CLI

Binary: `rn-coverage`

```
rn-coverage --help
rn-coverage android pull [--device <serial>] [--output <dir>]
rn-coverage android report [--android-dir <path>]
rn-coverage ios pull --device <udid> [--output <dir>]
rn-coverage ios export --derived-data <path> [--output <path>]
rn-coverage ios report   # stub — llvm-cov show HTML
rn-coverage ios summary  # stub — llvm-cov report
rn-coverage assert [--lcov <path>] [--jacoco-xml <path>]
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Unexpected error / usage |
| 2 | Strict empty-hit / missing artifact (CI guard) |

Default config uses `strict: true` (recommended for CI). Local runs may pass `--no-strict`. Exact assert UX vs per-command flags may refine later; the exit-2 design is intentional.
