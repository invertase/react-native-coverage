#!/usr/bin/env node
import { Command } from 'commander';

import { assertCoverage } from '../assert-coverage';
import type { CoverageConfig } from '../config';
import { loadCoverageConfig } from '../config';
import {
  EXIT_ERROR,
  EXIT_OK,
  EXIT_STRICT_EMPTY,
  StrictEmptyError,
} from '../exit-codes';
import {
  exportIosLcov,
  reportIosHtml,
  summarizeIos,
} from '../process-ios-native-coverage';
import {
  pullAndroidCoverageWithRetry,
  pullIosCoverage,
  resolveAndroidDeviceId,
  runJacocoTestReport,
} from '../pull-native-coverage';

export { EXIT_OK, EXIT_ERROR, EXIT_STRICT_EMPTY };

type RootOpts = {
  config?: string;
  strict?: boolean;
};

function applyStrictOverride(
  config: CoverageConfig,
  rootOpts: RootOpts
): CoverageConfig {
  if (rootOpts.strict === true) {
    config.strict = true;
  } else if (rootOpts.strict === false) {
    config.strict = false;
  }
  return config;
}

function rootOptsFrom(cmd: Command): RootOpts {
  // android/ios subcommands: parent.parent is program
  // assert: parent is program
  const parent = cmd.parent;
  if (parent?.parent) {
    return (parent.parent.opts() ?? {}) as RootOpts;
  }
  return (parent?.opts() ?? {}) as RootOpts;
}

function mapErrorToExit(error: unknown): number {
  // Exit 2 only for explicit empty/missing coverage-hit guards.
  // Tooling/config failures (e.g. missing app binary) stay exit 1.
  if (error instanceof StrictEmptyError) {
    return EXIT_STRICT_EMPTY;
  }
  return EXIT_ERROR;
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('rn-coverage')
    .description(
      'Native coverage CLI for React Native (pull / export / report / summary / assert). Pattern C: dedicated test apps only.'
    )
    .option('-c, --config <path>', 'Path to react-native-coverage.config.js')
    .option('--strict', 'Fail with exit 2 when artifacts/hits are empty')
    .option('--no-strict', 'Warn instead of exit 2 on empty artifacts');

  program
    .command('android')
    .description('Android coverage commands')
    .addCommand(
      new Command('pull')
        .description('Pull .ec coverage from a connected device/emulator')
        .option('--device <id>', 'adb device serial')
        .option('--output <dir>', 'Local output directory')
        .option('--retries <n>', 'Retry count while waiting for .ec', '15')
        .action(async (opts, cmd) => {
          const rootOpts = rootOptsFrom(cmd);
          const config = applyStrictOverride(
            await loadCoverageConfig(process.cwd(), rootOpts.config),
            rootOpts
          );
          try {
            const deviceId = resolveAndroidDeviceId(opts.device);
            const pulled = await pullAndroidCoverageWithRetry(deviceId, {
              softFail: !config.strict,
              outputDir: opts.output,
              retries: Number(opts.retries) || 15,
              config,
            });
            if (!pulled && config.strict) {
              console.error(
                '[rn-coverage] Android coverage.ec missing (strict)'
              );
              process.exitCode = EXIT_STRICT_EMPTY;
            }
          } catch (error) {
            console.error(`[rn-coverage] ${(error as Error).message}`);
            process.exitCode = mapErrorToExit(error);
          }
        })
    )
    .addCommand(
      new Command('report')
        .description(
          'Run jacocoTestReport then assert Jacoco XML LINE hits (exit 2 if strict empty)'
        )
        .option('--android-dir <path>', 'Android project directory', 'android')
        .option('--jacoco-xml <path>', 'Jacoco XML path to assert after report')
        .action(async (opts, cmd) => {
          const rootOpts = rootOptsFrom(cmd);
          const config = applyStrictOverride(
            await loadCoverageConfig(process.cwd(), rootOpts.config),
            rootOpts
          );
          const result = runJacocoTestReport({
            androidDir: opts.androidDir,
            jacocoXml: opts.jacocoXml,
            config,
          });
          if (!result.ok) {
            process.exitCode = result.exitCode;
          }
        })
    );

  program
    .command('ios')
    .description('iOS coverage commands')
    .addCommand(
      new Command('pull')
        .description('Pull .profraw from a simulator app container')
        .requiredOption('--device <udid>', 'Simulator UDID')
        .option('--output <dir>', 'Local output directory')
        .action(async (opts, cmd) => {
          const rootOpts = rootOptsFrom(cmd);
          const config = applyStrictOverride(
            await loadCoverageConfig(process.cwd(), rootOpts.config),
            rootOpts
          );
          try {
            const pulled = pullIosCoverage(opts.device, {
              outputDir: opts.output,
              softFail: !config.strict,
              config,
            });
            if (pulled.length === 0 && config.strict) {
              process.exitCode = EXIT_STRICT_EMPTY;
            }
          } catch (error) {
            console.error(`[rn-coverage] ${(error as Error).message}`);
            process.exitCode = mapErrorToExit(error);
          }
        })
    )
    .addCommand(
      new Command('export')
        .description(
          'Merge profraw and export LCOV via llvm-cov (asserts path hits; exit 2 if strict empty)'
        )
        .requiredOption('--derived-data <path>', 'Xcode derived data path')
        .option('--configuration <name>', 'Xcode configuration', 'Debug')
        .option('--app-name <name>', 'App product name')
        .option('--output <path>', 'LCOV output path', 'coverage/ios/lcov.info')
        .action(async (opts, cmd) => {
          const rootOpts = rootOptsFrom(cmd);
          const config = applyStrictOverride(
            await loadCoverageConfig(process.cwd(), rootOpts.config),
            rootOpts
          );
          try {
            await exportIosLcov({
              derivedData: opts.derivedData,
              configuration: opts.configuration,
              appName: opts.appName ?? config.app.iosProductName,
              output: opts.output,
              config,
            });
          } catch (error) {
            console.error(`[rn-coverage] ${(error as Error).message}`);
            process.exitCode = mapErrorToExit(error);
          }
        })
    )
    .addCommand(
      new Command('report')
        .description('HTML report via llvm-cov show -format=html')
        .requiredOption('--derived-data <path>', 'Xcode derived data path')
        .option('--configuration <name>', 'Xcode configuration', 'Debug')
        .option('--app-name <name>', 'App product name')
        .option(
          '--profdata <path>',
          'Merged profdata path',
          'coverage/ios/profdata'
        )
        .option(
          '--output-dir <path>',
          'HTML output directory',
          'coverage/ios/html'
        )
        .action(async (opts, cmd) => {
          const rootOpts = rootOptsFrom(cmd);
          const config = applyStrictOverride(
            await loadCoverageConfig(process.cwd(), rootOpts.config),
            rootOpts
          );
          try {
            reportIosHtml({
              derivedData: opts.derivedData,
              configuration: opts.configuration,
              appName: opts.appName,
              profdata: opts.profdata,
              outputDir: opts.outputDir,
              config,
            });
          } catch (error) {
            console.error(`[rn-coverage] ${(error as Error).message}`);
            process.exitCode = mapErrorToExit(error);
          }
        })
    )
    .addCommand(
      new Command('summary')
        .description('Terminal summary via llvm-cov report')
        .requiredOption('--derived-data <path>', 'Xcode derived data path')
        .option('--configuration <name>', 'Xcode configuration', 'Debug')
        .option('--app-name <name>', 'App product name')
        .option(
          '--profdata <path>',
          'Merged profdata path',
          'coverage/ios/profdata'
        )
        .action(async (opts, cmd) => {
          const rootOpts = rootOptsFrom(cmd);
          const config = applyStrictOverride(
            await loadCoverageConfig(process.cwd(), rootOpts.config),
            rootOpts
          );
          try {
            summarizeIos({
              derivedData: opts.derivedData,
              configuration: opts.configuration,
              appName: opts.appName,
              profdata: opts.profdata,
              config,
            });
          } catch (error) {
            console.error(`[rn-coverage] ${(error as Error).message}`);
            process.exitCode = mapErrorToExit(error);
          }
        })
    );

  program
    .command('assert')
    .description(
      'Post-pipeline presence check (exit 2 on empty/missing expected hits)'
    )
    .option('--platform <name>', 'ios | android | all (default: all)', 'all')
    .option('--lcov <path>', 'LCOV file to assert non-empty expected hits')
    .option('--jacoco-xml <path>', 'Jacoco XML to assert non-empty LINE hits')
    .action(async (opts, cmd) => {
      const rootOpts = rootOptsFrom(cmd);
      const config = applyStrictOverride(
        await loadCoverageConfig(process.cwd(), rootOpts.config),
        rootOpts
      );

      if (!['ios', 'android', 'all'].includes(opts.platform)) {
        console.error(
          `[rn-coverage] assert: --platform must be ios|android|all (got ${opts.platform})`
        );
        process.exitCode = EXIT_ERROR;
        return;
      }

      const result = assertCoverage({
        platform: opts.platform,
        lcov: opts.lcov,
        jacocoXml: opts.jacocoXml,
        strict: config.strict,
        config,
      });

      if (result.code === EXIT_OK) {
        for (const line of result.message.split('\n')) {
          console.log(`[rn-coverage] assert: ${line}`);
        }
        console.log('[rn-coverage] assert: ok');
        return;
      }

      for (const line of result.message.split('\n')) {
        if (config.strict) {
          console.error(`[rn-coverage] assert: ${line}`);
        } else {
          console.warn(`[rn-coverage] assert: ${line}`);
        }
      }
      if (result.code === EXIT_STRICT_EMPTY) {
        console.error(
          '[rn-coverage] assert: FAIL empty or missing native coverage (exit 2)'
        );
      }
      process.exitCode = result.code;
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  console.error(`[rn-coverage] ${(error as Error).message}`);
  process.exitCode = EXIT_ERROR;
});
