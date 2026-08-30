import type { SourcePathRewriteRule } from '../../src/config';

/**
 * Example rewrite rules shaped like a monorepo library layout
 * (paths contain `/packages/` and scoped package names in node_modules).
 * Neutral — no product-specific prefixes required.
 */
export const monorepoRewriteRules: SourcePathRewriteRule[] = [
  {
    kind: 'after-marker',
    marker: '/packages/',
    includeMarker: true,
  },
  {
    kind: 'regex',
    pattern: '^.*/@example-scope/([^/]+)/(.+)$',
    replacement: 'packages/$1/$2',
  },
  {
    kind: 'after-marker',
    marker: '/tests/',
    includeMarker: true,
  },
];

export const sampleLcovPaths = [
  '/Users/dev/app/packages/core/ios/Core.mm',
  '/Users/dev/app/node_modules/@example-scope/analytics/android/src/Main.kt',
  '/Users/dev/app/tests/e2e/helpers.cpp',
  'C:\\Users\\dev\\app\\packages\\core\\ios\\Core.mm',
];
