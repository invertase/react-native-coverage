import Coverage from './NativeCoverage';

export { default as Coverage } from './NativeCoverage';
export type { Spec as CoverageSpec } from './NativeCoverage';

/**
 * Flush in-process native coverage buffers to disk.
 * iOS: LLVM multi-image (mode c). Android: Jacoco/Emma RT dump.
 *
 * React Native entry only — Node/CLI APIs live under `react-native-coverage/node`.
 */
/**
 * Flush Istanbul JS coverage (when Metro instrumented) then native buffers.
 * No-op for JS dump when `global.__coverage__` is absent.
 */
export function flush(): void {
  try {
    const coverage = (globalThis as { __coverage__?: unknown }).__coverage__;
    if (coverage != null && typeof Coverage.dumpJsCoverage === 'function') {
      Coverage.dumpJsCoverage(JSON.stringify(coverage));
    }
  } catch {
    // Older native binaries without dumpJsCoverage — native flush still runs.
  }
  Coverage.flush();
}

/** Write `global.__coverage__` only (no native Emma/LLVM flush). */
export function flushJs(): void {
  const coverage = (globalThis as { __coverage__?: unknown }).__coverage__;
  if (coverage == null) {
    return;
  }
  Coverage.dumpJsCoverage(JSON.stringify(coverage));
}
