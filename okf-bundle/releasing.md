# Releasing

Publishing is manual. Nothing publishes on push to `main`.

`semantic-release` only releases the `main` branch (`release.config.js`). Dispatch the workflow on `main` after the change is merged. The merge push starts CI on that new SHA. The release job waits for a successful CI run of that same SHA (up to 120 minutes) and refuses a green run from any other commit.

One command starts it:

```sh
gh workflow run release.yml --repo invertase/react-native-coverage --ref main
```

The workflow then does the rest, with no further prompts:

1. Check out `main` with the `GH_TOKEN` repo secret so the later git push can pass branch protection.
2. `yarn prepare`.
3. `scripts/ci/wait-for-ci.sh` — poll CI for `GITHUB_SHA`.
4. `yarn semantic-release` — npm publish via OIDC trusted publishing (no `NPM_TOKEN`), GitHub Release, then a `[skip ci]` commit of `package.json` and `CHANGELOG.md` on `main`, tagged at that commit.

Confirm with `gh run list --repo invertase/react-native-coverage --workflow release.yml --limit 1`. A run that finishes without a new version means semantic-release found no releasable commits since the last tag (`fix` / `feat` count; `chore` and `docs` do not).

Operator detail, bootstrap, and rollback: `docs/reference/releasing.mdx`.
