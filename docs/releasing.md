# Releasing

Operator guide for publishing `react-native-coverage`. Releases are **manual only** (`workflow_dispatch`). There is no auto-publish on push to `main`.

## Prerequisites

| Item | Notes |
|------|--------|
| GitHub repo | `invertase/react-native-coverage` (see [Create the GitHub repo](#create-the-github-repo) if missing) |
| Conventional Commits | PR titles enforced by `.github/workflows/pr-title.yml`; squash-merge preferred |
| Green `main` | Unit + Appium e2e CI from `.github/workflows/ci.yml` |
| First npm publish | **Human OTP bootstrap** — first human publish, not this release scaffolding |
| npm OIDC | Configure Trusted Publisher **after** bootstrap; release workflow already has `id-token: write` |

## Create the GitHub repo

Local clone has **no `origin` remote** until a human creates the GitHub repository. From the package root:

```sh
cd /path/to/react-native-coverage

# Create under invertase and set origin (public OSS / Apache-2.0):
gh repo create invertase/react-native-coverage \
  --public \
  --source=. \
  --remote=origin \
  --description "Native code coverage tooling for React Native test apps (Pattern C)"

# Push main (after reviewing uncommitted scaffolding / approved commits):
git push -u origin main
```

Optional: create empty on GitHub first, then:

```sh
git remote add origin git@github.com:invertase/react-native-coverage.git
git push -u origin main
```

Confirm: `gh repo view invertase/react-native-coverage`.

## Conventional Commits

- Prefer **squash merge**; the PR title becomes the release-relevant commit.
- PR titles must match [Conventional Commits](https://www.conventionalcommits.org/) (enforced in CI).
- Local check (optional):

```sh
echo "feat: add assert command" | yarn commitlint
```

Examples: `feat: …`, `fix: …`, `docs: …`, `chore: …`. Breaking changes: `feat!: …` or a `BREAKING CHANGE:` footer.

## Release tooling

| Piece | Path / command |
|-------|----------------|
| Config | `release.config.js` |
| Workflow | `.github/workflows/release.yml` (`workflow_dispatch` only) |
| Analyzer | Conventional Commits via `@semantic-release/commit-analyzer` |
| Publish | `@semantic-release/npm` + `@semantic-release/github` |
| **Not used** | `@semantic-release/git` — dropped so releases do not need a bot push past branch protection; version tags + GitHub Releases carry the release, not in-repo `package.json` bumps |

Dry-run (no publish; needs network + git history):

```sh
yarn release:dry-run
```

## Operator: CI release (after bootstrap)

Do **not** run a real publish until human bootstrap + OIDC Trusted Publisher setup are complete.

1. Ensure `main` is green.
2. GitHub → **Actions** → **Release** → **Run workflow** (branch `main`).
3. Confirm the run created a GitHub Release + npm version with provenance.
4. If nothing published: semantic-release found no releasable commits since the last tag (expected when only `chore`/`docs` landed).

## First human publish and OIDC setup (do not do via this workflow alone)

- First human `npm publish` (OTP), including bootstrap version / dist-tag so tags do not collide with later semantic-release versions
- npm package settings → **Trusted Publisher** for `invertase/react-native-coverage` workflow `.github/workflows/release.yml`
- Second publish via this Release workflow to prove OIDC + provenance

## Rollback notes

- npm: deprecate or unpublish only within npm policy; prefer a follow-up patch release.
- Git: delete a mistaken `v*` tag only if it was never consumed; coordinate with maintainers.
