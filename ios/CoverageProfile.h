#import <Foundation/Foundation.h>

#ifdef __cplusplus
extern "C" {
#endif

/** Set LLVM_PROFILE_FILE / profile filename to Documents/coverage-%m.profraw. */
void CoverageConfigureProfilePath(void);

/**
 * Mode (c) multi-image flush:
 * - LINKEDIT dump for configured framework prefixes (e.g. CoverageFixture*)
 * - LINKEDIT dump for MH_EXECUTE main
 * - direct write for this Pod's own profile runtime last
 *
 * Returns 0 on success (at least one useful write), non-zero otherwise.
 */
int CoverageFlushProfile(void);

#ifdef __cplusplus
}
#endif
