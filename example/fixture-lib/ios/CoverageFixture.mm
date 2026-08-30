#import "CoverageFixture.h"

@implementation CoverageFixture {
  int _hits;
}

- (instancetype)init
{
  if (self = [super init]) {
    _hits = 0;
  }
  return self;
}

- (NSNumber *)hit
{
  // Branchy work so llvm-cov shows non-trivial DA hits for this translation unit.
  _hits += 1;
  int acc = 0;
  for (int i = 0; i < 8; i++) {
    if ((i % 2) == 0) {
      acc += i * 3;
    } else {
      acc -= i;
    }
  }
  if (_hits > 0) {
    acc += _hits;
  }
  return @(acc);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeCoverageFixtureSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"CoverageFixture";
}

@end
