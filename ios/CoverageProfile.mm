#import "CoverageProfile.h"
#import "CoverageConfig.h"

#import <mach-o/dyld.h>
#import <mach-o/loader.h>
#import <mach-o/nlist.h>
#import <stdlib.h>
#import <string.h>

extern "C" {
int __llvm_profile_write_file(void);
void __llvm_profile_set_filename(const char *Name);
const char *__llvm_profile_get_filename(void);
}

typedef int (*CoverageProfileWriteFn)(void);
typedef void (*CoverageProfileSetFilenameFn)(const char *);

typedef struct {
  const struct mach_header *header;
  intptr_t slide;
  CoverageProfileWriteFn writeFile;
  const char *imageName;
} CoverageTrackedProfileImage;

enum { CoverageMaxTrackedProfileImages = 64 };

static CoverageTrackedProfileImage gCoverageTracked[CoverageMaxTrackedProfileImages];
static uint32_t gCoverageTrackedCount = 0;

/**
 * `%m` expands to a unique module signature so each instrumented Mach-O image
 * writes its own profraw instead of overwriting a single shared file.
 */
static NSString *CoverageProfilePattern(void)
{
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  return [[paths firstObject] stringByAppendingPathComponent:@COVERAGE_PROFILE_FILE_PATTERN];
}

/**
 * clang_rt.profile symbols are linked into each instrumented framework as local
 * (`t`) symbols — dlsym cannot see them. Resolve via the on-disk symbol table
 * mapped through __LINKEDIT.
 */
static const void *CoverageFindSymbolInHeader(
    const struct mach_header *header, intptr_t slide, const char *symbolName)
{
  if (header == NULL || symbolName == NULL) {
    return NULL;
  }
  if (header->magic != MH_MAGIC_64 && header->magic != MH_CIGAM_64) {
    return NULL;
  }

  const struct mach_header_64 *header64 = (const struct mach_header_64 *)header;
  const uint8_t *cursor = (const uint8_t *)(header64 + 1);
  const struct symtab_command *symtab = NULL;
  const struct segment_command_64 *linkedit = NULL;

  for (uint32_t i = 0; i < header64->ncmds; i++) {
    const struct load_command *command = (const struct load_command *)cursor;
    if (command->cmd == LC_SYMTAB) {
      symtab = (const struct symtab_command *)command;
    } else if (command->cmd == LC_SEGMENT_64) {
      const struct segment_command_64 *segment = (const struct segment_command_64 *)command;
      if (strcmp(segment->segname, SEG_LINKEDIT) == 0) {
        linkedit = segment;
      }
    }
    cursor += command->cmdsize;
  }

  if (symtab == NULL || linkedit == NULL || symtab->nsyms == 0) {
    return NULL;
  }

  const uintptr_t linkeditBase =
      (uintptr_t)slide + (uintptr_t)linkedit->vmaddr - (uintptr_t)linkedit->fileoff;
  const char *strings = (const char *)(linkeditBase + symtab->stroff);
  const struct nlist_64 *symbols =
      (const struct nlist_64 *)(linkeditBase + symtab->symoff);
  const size_t nameLength = strlen(symbolName);

  for (uint32_t i = 0; i < symtab->nsyms; i++) {
    uint32_t stringIndex = symbols[i].n_un.n_strx;
    if (stringIndex == 0) {
      continue;
    }
    const char *name = strings + stringIndex;
    if (strncmp(name, symbolName, nameLength) != 0 || name[nameLength] != '\0') {
      continue;
    }
    if ((symbols[i].n_type & N_TYPE) == N_UNDF || symbols[i].n_value == 0) {
      continue;
    }
    return (const void *)((uintptr_t)symbols[i].n_value + (uintptr_t)slide);
  }

  return NULL;
}

static const char *CoverageImageNameForHeader(const struct mach_header *header)
{
  uint32_t imageCount = _dyld_image_count();
  for (uint32_t index = 0; index < imageCount; index += 1) {
    if (_dyld_get_image_header(index) == header) {
      return _dyld_get_image_name(index);
    }
  }
  return NULL;
}

static bool CoverageIsConfiguredFrameworkImage(const char *imageName)
{
  if (imageName == NULL) {
    return false;
  }
#if !COVERAGE_ENABLED
  return false;
#endif
  if (COVERAGE_FRAMEWORK_PREFIX_COUNT <= 0) {
    return false;
  }
  const char *framework = strstr(imageName, ".framework");
  if (framework == NULL) {
    return false;
  }
  const char *basename = framework;
  while (basename > imageName && basename[-1] != '/') {
    basename -= 1;
  }
  for (int i = 0; i < COVERAGE_FRAMEWORK_PREFIX_COUNT; i++) {
    const char *prefix = COVERAGE_FRAMEWORK_PREFIXES[i];
    if (prefix == NULL) {
      continue;
    }
    size_t prefixLen = strlen(prefix);
    if (prefixLen > 0 && strncmp(basename, prefix, prefixLen) == 0) {
      return true;
    }
  }
  return false;
}

/**
 * React Native / Expo Debug builds often place app + static-pod object code in
 * `AppName.debug.dylib` (MH_DYLIB), not MH_EXECUTE. Flush that companion image
 * via LINKEDIT so fixture/static-lib counters are not missed when Expo forces
 * MACH_O_TYPE=staticlib on pods under use_frameworks.
 */
static bool CoverageIsAppCompanionDebugDylib(const char *imageName)
{
  if (imageName == NULL) {
    return false;
  }
  if (strstr(imageName, ".app/") == NULL) {
    return false;
  }
  return strstr(imageName, ".debug.dylib") != NULL;
}

static bool CoverageShouldTrackImage(const char *imageName)
{
  return CoverageIsConfiguredFrameworkImage(imageName) ||
         CoverageIsAppCompanionDebugDylib(imageName);
}

static bool CoverageIsMainExecutable(const struct mach_header *header)
{
  return header != NULL && header->filetype == MH_EXECUTE;
}

static void CoverageSetFilenameOnImage(
    const struct mach_header *header, intptr_t slide, const char *pattern)
{
  CoverageProfileSetFilenameFn setFilename =
      (CoverageProfileSetFilenameFn)CoverageFindSymbolInHeader(
          header, slide, "___llvm_profile_set_filename");
  if (setFilename != NULL && pattern != NULL) {
    setFilename(pattern);
    return;
  }
  char **filenameVar = (char **)CoverageFindSymbolInHeader(
      header, slide, "___llvm_profile_filename");
  if (filenameVar != NULL && pattern != NULL) {
    *filenameVar = (char *)pattern;
  }
}

static void CoverageTrackProfileImage(const struct mach_header *header, intptr_t slide)
{
  const char *imageName = CoverageImageNameForHeader(header);
  if (!CoverageShouldTrackImage(imageName)) {
    return;
  }

  CoverageProfileWriteFn writeFile = (CoverageProfileWriteFn)CoverageFindSymbolInHeader(
      header, slide, "___llvm_profile_write_file");
  // Skip if missing or if it resolves to *this* Pod's runtime (not a distinct image).
  if (writeFile == NULL || writeFile == __llvm_profile_write_file) {
    NSLog(@"[ios-native-coverage] skip image (no distinct profile runtime): %s", imageName);
    return;
  }

  for (uint32_t i = 0; i < gCoverageTrackedCount; i++) {
    if (gCoverageTracked[i].writeFile == writeFile) {
      return;
    }
  }

  if (gCoverageTrackedCount >= CoverageMaxTrackedProfileImages) {
    NSLog(@"[ios-native-coverage] tracked profile image cap reached (%d)",
          CoverageMaxTrackedProfileImages);
    return;
  }

  gCoverageTracked[gCoverageTrackedCount].header = header;
  gCoverageTracked[gCoverageTrackedCount].slide = slide;
  gCoverageTracked[gCoverageTrackedCount].writeFile = writeFile;
  gCoverageTracked[gCoverageTrackedCount].imageName = imageName;
  gCoverageTrackedCount += 1;
  NSLog(@"[ios-native-coverage] tracked profile image[%u]: %s",
        gCoverageTrackedCount - 1,
        imageName);
}

static void CoverageOnAddImage(const struct mach_header *header, intptr_t slide)
{
  CoverageTrackProfileImage(header, slide);
}

__attribute__((constructor)) static void CoverageProfileInit(void)
{
  _dyld_register_func_for_add_image(CoverageOnAddImage);
}

static void CoverageRefreshTrackedFromDyld(void)
{
  uint32_t imageCount = _dyld_image_count();
  for (uint32_t index = 0; index < imageCount; index += 1) {
    CoverageTrackProfileImage(
        _dyld_get_image_header(index), _dyld_get_image_vmaddr_slide(index));
  }
}

static int CoverageFlushTracked(const char *pattern)
{
  int worstStatus = 0;
  int wrote = 0;

  for (uint32_t i = 0; i < gCoverageTrackedCount; i++) {
    CoverageSetFilenameOnImage(
        gCoverageTracked[i].header, gCoverageTracked[i].slide, pattern);
    int status = gCoverageTracked[i].writeFile();
    NSLog(
        @"[ios-native-coverage] flush tracked[%u] status=%d image=%s",
        i,
        status,
        gCoverageTracked[i].imageName ?: "(null)");
    if (status != 0) {
      worstStatus = status;
    } else {
      wrote += 1;
    }
  }

  return wrote > 0 ? 0 : worstStatus;
}

static int CoverageFlushMainViaLinkedit(const char *pattern)
{
  uint32_t imageCount = _dyld_image_count();
  for (uint32_t index = 0; index < imageCount; index += 1) {
    const struct mach_header *header = _dyld_get_image_header(index);
    intptr_t slide = _dyld_get_image_vmaddr_slide(index);
    if (!CoverageIsMainExecutable(header)) {
      continue;
    }

    const char *imageName = CoverageImageNameForHeader(header);
    CoverageProfileWriteFn writeFile = (CoverageProfileWriteFn)CoverageFindSymbolInHeader(
        header, slide, "___llvm_profile_write_file");
    NSLog(
        @"[ios-native-coverage] main-exe image=%s writeFile=%p podWriteFile=%p same=%d",
        imageName ?: "(null)",
        (void *)writeFile,
        (void *)__llvm_profile_write_file,
        writeFile == __llvm_profile_write_file ? 1 : 0);

    if (writeFile == NULL) {
      NSLog(@"[ios-native-coverage] main executable has no ___llvm_profile_write_file via LINKEDIT");
      return -1;
    }

    CoverageSetFilenameOnImage(header, slide, pattern);
    int status = writeFile();
    NSLog(@"[ios-native-coverage] flush main-via-LINKEDIT status=%d", status);
    return status;
  }

  NSLog(@"[ios-native-coverage] no MH_EXECUTE image found");
  return -1;
}

extern "C" void CoverageConfigureProfilePath(void)
{
  const char *pattern = CoverageProfilePattern().UTF8String;
  // Dynamic frameworks often lack set_filename (dead-stripped). getenv is consulted
  // by every runtime copy on write.
  setenv("LLVM_PROFILE_FILE", pattern, 1);
  __llvm_profile_set_filename(pattern);
  NSLog(
      @"[ios-native-coverage] configure pattern=%@ podRuntimePath=%s",
      CoverageProfilePattern(),
      __llvm_profile_get_filename() ?: "(null)");
}

/**
 * Mode (c): Pod LINKEDIT for configured frameworks + main executable, then pod write.
 * Prefer this under use_frameworks! :linkage => :dynamic (05S1 verdict).
 */
extern "C" int CoverageFlushProfile(void)
{
#if !COVERAGE_ENABLED
  NSLog(@"[ios-native-coverage] flush skipped (COVERAGE_ENABLED=0)");
  return -1;
#endif

  CoverageConfigureProfilePath();
  CoverageRefreshTrackedFromDyld();
  const char *pattern = getenv("LLVM_PROFILE_FILE");

  int trackedStatus = CoverageFlushTracked(pattern);
  int mainStatus = CoverageFlushMainViaLinkedit(pattern);
  int podStatus = __llvm_profile_write_file();

  NSLog(
      @"[ios-native-coverage] flush complete tracked=%u trackedStatus=%d mainStatus=%d podStatus=%d pattern=%s",
      gCoverageTrackedCount,
      trackedStatus,
      mainStatus,
      podStatus,
      pattern ?: "(null)");

  int okTracked = (trackedStatus == 0 && gCoverageTrackedCount > 0) ? 1 : 0;
  int okMain = (mainStatus == 0) ? 1 : 0;
  // Under Expo static-pod merge, fixture counters live in the same image as this
  // Pod's profile runtime — pod write is the success path.
  int okPod = (podStatus == 0) ? 1 : 0;
  if (okTracked || okMain || okPod) {
    return 0;
  }
  if (mainStatus != 0) {
    return mainStatus;
  }
  return trackedStatus != 0 ? trackedStatus : podStatus;
}
