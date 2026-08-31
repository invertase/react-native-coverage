/**
 * semantic-release config (release bootstrap).
 *
 * - Manual publish only via workflow_dispatch (see .github/workflows/release.yml).
 * - No @semantic-release/git: under branch protection the git plugin needs a
 *   privileged token to push version bumps; prefer tags + GitHub Releases only.
 * - npm OIDC trusted publishing is configured after the human first publish.
 *   This config is ready for OIDC (no NPM_TOKEN required once trusted publisher is set).
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
    '@semantic-release/npm',
    '@semantic-release/github',
  ],
};
