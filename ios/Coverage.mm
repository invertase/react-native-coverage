#import "Coverage.h"

@implementation Coverage

- (void)flush
{
  // TODO: port LLVM multi-image flush — native flusher queue item.
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeCoverageSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"Coverage";
}

@end
