#!/usr/bin/env node
/**
 * CLI entry. Requires `yarn prepare` (bob build) so lib/ exists.
 */
import('../lib/module/cli/index.js').catch((error) => {
  console.error(
    '[rn-coverage] Failed to load CLI. Run `yarn prepare` first.\n',
    error
  );
  process.exit(1);
});
