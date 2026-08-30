#import "Coverage.h"
#import "CoverageProfile.h"

@implementation Coverage

- (void)flush
{
  int status = CoverageFlushProfile();
  if (status != 0) {
    NSLog(@"[ios-native-coverage] TurboModule flush returned status=%d", status);
  }
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
