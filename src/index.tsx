import Coverage from './NativeCoverage';

export { default as Coverage } from './NativeCoverage';
export type { Spec as CoverageSpec } from './NativeCoverage';

/**
 * Flush in-process native coverage buffers to disk.
 * iOS: LLVM multi-image (mode c). Android: Jacoco/Emma RT dump.
 *
 * React Native entry only — Node/CLI APIs live under `react-native-coverage/node`.
 */
export function flush(): void {
  Coverage.flush();
}
