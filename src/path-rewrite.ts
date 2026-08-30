import type { SourcePathRewriteRule } from './config';

/**
 * Apply a single rewrite rule to a source path (forward slashes).
 * Returns the rewritten path, or the input if the rule did not match.
 */
export function applySourcePathRewrite(
  sourcePath: string,
  rule: SourcePathRewriteRule
): string {
  const normalized = sourcePath.replace(/\\/g, '/');

  if (rule.kind === 'after-marker') {
    const idx = normalized.indexOf(rule.marker);
    if (idx < 0) {
      return normalized;
    }
    const includeMarker = rule.includeMarker !== false;
    if (includeMarker) {
      const fromMarker = normalized.slice(idx);
      return fromMarker.startsWith('/') ? fromMarker.slice(1) : fromMarker;
    }
    return normalized.slice(idx + rule.marker.length);
  }

  if (rule.kind === 'regex') {
    const re = new RegExp(rule.pattern, rule.flags ?? '');
    if (!re.test(normalized)) {
      return normalized;
    }
    // Reset lastIndex after .test() for global regexes; always rewrite via replace.
    re.lastIndex = 0;
    return normalized.replace(re, rule.replacement);
  }

  return normalized;
}

/**
 * Normalize an LCOV `SF:` path using ordered rewrite rules.
 * Rules are applied left-to-right; each rule sees the previous result.
 */
export function normalizeSourcePath(
  sourcePath: string,
  rules: SourcePathRewriteRule[] = []
): string {
  let current = sourcePath.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const rule of rules) {
    current = applySourcePathRewrite(current, rule);
  }
  return current;
}
