/**
 * Node/library surface (CLI helpers, config, assert, pull/export).
 * Do not import from React Native / Metro — use package root `flush()` there.
 */
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
  getAdbBinary,
} from './pull-native-coverage';
export {
  pullAndroidJsCoverage,
  pullIosJsCoverage,
  reportJsCoverage,
} from './js-coverage';
