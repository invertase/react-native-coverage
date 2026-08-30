import Coverage from './NativeCoverage';

export { default as Coverage } from './NativeCoverage';
export type { Spec as CoverageSpec } from './NativeCoverage';
export type { CoverageConfig, SourcePathRewriteRule } from './config';
export {
  DEFAULT_COVERAGE_CONFIG,
  loadCoverageConfig,
  resolveCoverageConfig,
} from './config';
export { normalizeSourcePath, applySourcePathRewrite } from './path-rewrite';

/**
 * Flush in-process native coverage buffers to disk.
 * No-op stub until the native flusher is ported.
 */
export function flush(): void {
  Coverage.flush();
}
