/**
 * semantic-release config.
 *
 * - Manual publish only via workflow_dispatch (see .github/workflows/release.yml).
 * - npm OIDC trusted publishing is configured after the human first publish.
 *   This config is ready for OIDC (no NPM_TOKEN required once trusted publisher is set).
 * - @semantic-release/git commits the version bump + CHANGELOG back to `main` and
 *   tags THAT commit, so a checkout at any tag has a truthful `package.json` and
 *   `CHANGELOG.md`. Because `main` is branch-protected, the release workflow must run
 *   with a token allowed to bypass protection (a GitHub App/PAT, or an "allow
 *   specified actors to bypass required pull requests" rule for the release bot).
 *   The `[skip ci]` in the commit message keeps that push from re-triggering CI.
 */
module.exports = {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
      },
    ],
    // Prepend the generated notes to CHANGELOG.md before npm bumps the version.
    '@semantic-release/changelog',
    // Bumps package.json version in the published tarball.
    '@semantic-release/npm',
    // Creates the GitHub Release from the generated notes.
    '@semantic-release/github',
    // MUST be last: commits the files the previous steps modified, then tags it.
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'CHANGELOG.md'],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
