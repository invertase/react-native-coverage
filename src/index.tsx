import Coverage from './NativeCoverage';

export { default as Coverage } from './NativeCoverage';
export type { Spec as CoverageSpec } from './NativeCoverage';
export type {
  CoverageAssertConfig,
  CoverageConfig,
  SourcePathRewriteRule,
} from './config';
export {
  DEFAULT_COVERAGE_CONFIG,
  loadCoverageConfig,
  resolveCoverageConfig,
} from './config';
export { normalizeSourcePath, applySourcePathRewrite } from './path-rewrite';
export {
  EXIT_OK,
  EXIT_ERROR,
  EXIT_STRICT_EMPTY,
  StrictEmptyError,
} from './exit-codes';
export {
  analyzeLcov,
  analyzeJacocoXml,
  assertIosLcov,
  assertAndroidJacoco,
  assertCoverage,
} from './assert-coverage';
export type { AssertResult, AssertCoverageOptions } from './assert-coverage';
export {
  walkFiles,
  collectCoverageObjects,
  resolveIosCoverageContext,
  rewriteLcovFile,
  exportIosLcov,
  reportIosHtml,
  summarizeIos,
} from './process-ios-native-coverage';
export {
  resolveAndroidDeviceId,
  androidCoverageFileExists,
  pullAndroidCoverage,
  pullAndroidCoverageWithRetry,
  pullIosCoverage,
  runJacocoTestReport,
} from './pull-native-coverage';

/**
 * Flush in-process native coverage buffers to disk.
 * No-op stub until the native flusher is ported.
 */
export function flush(): void {
  Coverage.flush();
}
