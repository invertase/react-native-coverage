/**
 * CLI / library exit codes for presence / silent-fail guards.
 *
 * Aligns with the RNFB interim assert contract (exit 2 = strict empty).
 */
export const EXIT_OK = 0;
/** Unexpected error / bad invocation / tooling failure. */
export const EXIT_ERROR = 1;
/** Strict empty-hit / missing artifact (CI guard). */
export const EXIT_STRICT_EMPTY = 2;

/** Thrown when a strict presence guard fails (map to exit 2 in the CLI). */
export class StrictEmptyError extends Error {
  readonly exitCode = EXIT_STRICT_EMPTY;

  constructor(message: string) {
    super(message);
    this.name = 'StrictEmptyError';
  }
}
