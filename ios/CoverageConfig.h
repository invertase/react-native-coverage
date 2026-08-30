/**
 * Native coverage knobs for the TurboModule flusher.
 *
 * Defaults target the Expo example fixture library (`CoverageFixture`).
 * Dedicated test apps should regenerate or override this header to match
 * `react-native-coverage.config.js` → `ios.frameworkNamePrefixes`
 * (full config→header generation lands with build-integration work).
 */
#pragma once

#ifndef COVERAGE_ENABLED
#define COVERAGE_ENABLED 1
#endif

#ifndef COVERAGE_PROFILE_FILE_PATTERN
#define COVERAGE_PROFILE_FILE_PATTERN "coverage-%m.profraw"
#endif

#ifndef COVERAGE_FRAMEWORK_PREFIX_COUNT
#define COVERAGE_FRAMEWORK_PREFIX_COUNT 1
static const char *const COVERAGE_FRAMEWORK_PREFIXES[] = {"CoverageFixture"};
#endif
