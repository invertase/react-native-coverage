#!/usr/bin/env node
import { Command } from 'commander';

import { loadCoverageConfig } from '../config';
import {
  pullAndroidCoverageWithRetry,
  resolveAndroidDeviceId,
  runJacocoTestReport,
  pullIosCoverage,
} from '../pull-native-coverage';
import { exportIosLcov } from '../process-ios-native-coverage';

/**
 * Exit codes:
 * - 0 success
 * - 1 unexpected error
 * - 2 strict empty-hit / missing artifact (CI guard)
 *
 * Full assert UX vs per-command `--strict` is finalized in a later queue item.
 * Design default: strict in CI (`config.strict === true`).
 */
export const EXIT_STRICT_EMPTY = 2;

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('rn-coverage')
    .description(
      'Native coverage CLI for React Native (pull / export / report). Pattern C: dedicated test apps only.'
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
        .action(async (opts, cmd) => {
          const rootOpts = cmd.parent?.parent?.opts() ?? {};
          const config = await loadCoverageConfig(
            process.cwd(),
            rootOpts.config
          );
          if (rootOpts.strict === true) {
            config.strict = true;
          } else if (rootOpts.strict === false) {
            config.strict = false;
          }
          const deviceId = resolveAndroidDeviceId(opts.device);
          const pulled = await pullAndroidCoverageWithRetry(deviceId, {
            softFail: !config.strict,
            outputDir: opts.output,
            config,
          });
          if (!pulled && config.strict) {
            process.exitCode = EXIT_STRICT_EMPTY;
          }
        })
    )
    .addCommand(
      new Command('report')
        .description(
          'Run jacocoTestReport (requires consumer Gradle wiring — TODO full port)'
        )
        .option('--android-dir <path>', 'Android project directory', 'android')
        .action((opts) => {
          const ok = runJacocoTestReport(opts.androidDir);
          if (!ok) {
            process.exitCode = 1;
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
          const rootOpts = cmd.parent?.parent?.opts() ?? {};
          const config = await loadCoverageConfig(
            process.cwd(),
            rootOpts.config
          );
          try {
            pullIosCoverage(opts.device, {
              outputDir: opts.output,
              config,
            });
          } catch (error) {
            console.error(`[rn-coverage] ${(error as Error).message}`);
            process.exitCode = config.strict ? EXIT_STRICT_EMPTY : 1;
          }
        })
    )
    .addCommand(
      new Command('export')
        .description('Merge profraw and export LCOV via llvm-cov')
        .requiredOption('--derived-data <path>', 'Xcode derived data path')
        .option('--configuration <name>', 'Xcode configuration', 'Debug')
        .option('--app-name <name>', 'App product name')
        .option('--output <path>', 'LCOV output path', 'coverage/ios/lcov.info')
        .action(async (opts, cmd) => {
          const rootOpts = cmd.parent?.parent?.opts() ?? {};
          const config = await loadCoverageConfig(
            process.cwd(),
            rootOpts.config
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
            process.exitCode = config.strict ? EXIT_STRICT_EMPTY : 1;
          }
        })
    )
    .addCommand(
      new Command('report')
        .description(
          'HTML report via llvm-cov show (TODO: full wiring in next CLI item)'
        )
        .option('--profdata <path>', 'Merged profdata path')
        .option('--output-dir <path>', 'HTML output directory')
        .action(() => {
          console.log(
            '[rn-coverage] ios report: stub — use xcrun llvm-cov show -format=html (see docs/cli.md)'
          );
        })
    )
    .addCommand(
      new Command('summary')
        .description(
          'Terminal summary via llvm-cov report (TODO: full wiring in next CLI item)'
        )
        .option('--profdata <path>', 'Merged profdata path')
        .action(() => {
          console.log(
            '[rn-coverage] ios summary: stub — use xcrun llvm-cov report (see docs/cli.md)'
          );
        })
    );

  program
    .command('assert')
    .description(
      'Post-pipeline presence check (exit 2 on empty hits). Full UX TBD.'
    )
    .option('--lcov <path>', 'LCOV file to assert non-empty')
    .option('--jacoco-xml <path>', 'Jacoco XML to assert non-empty')
    .action(async (opts, cmd) => {
      const rootOpts = cmd.parent?.opts() ?? {};
      const config = await loadCoverageConfig(process.cwd(), rootOpts.config);
      const targets = [opts.lcov, opts.jacocoXml].filter(Boolean) as string[];
      if (targets.length === 0) {
        console.error(
          '[rn-coverage] assert: pass --lcov and/or --jacoco-xml (stub)'
        );
        process.exitCode = 1;
        return;
      }
      const fs = await import('node:fs');
      for (const target of targets) {
        if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
          console.error(`[rn-coverage] assert: empty or missing ${target}`);
          process.exitCode = config.strict ? EXIT_STRICT_EMPTY : 1;
          return;
        }
      }

      console.log('[rn-coverage] assert: ok');
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  console.error(`[rn-coverage] ${(error as Error).message}`);
  process.exitCode = 1;
});
