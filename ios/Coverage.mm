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

- (void)dumpJsCoverage:(NSString *)json
{
  NSArray<NSString *> *paths =
      NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  NSString *docs = paths.firstObject;
  if (docs == nil) {
    NSLog(@"[ios-native-coverage] dumpJsCoverage: Documents directory missing");
    return;
  }
  NSString *path = [docs stringByAppendingPathComponent:@"coverage-final.json"];
  NSError *error = nil;
  BOOL ok = [json writeToFile:path
                   atomically:YES
                     encoding:NSUTF8StringEncoding
                        error:&error];
  if (!ok) {
    NSLog(@"[ios-native-coverage] dumpJsCoverage failed: %@", error);
  } else {
    NSLog(@"[ios-native-coverage] wrote JS coverage to %@", path);
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
