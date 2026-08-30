# iOS integration

Scaffold notes:

- New Architecture only; TurboModule autolinks via the podspec.
- Apply Pod-target LLVM flags with the shipped Ruby helper:

```ruby
require_relative '../node_modules/react-native-coverage/cocoapods/coverage_post_install'

post_install do |installer|
  ReactNativeCoverage.apply_post_install!(installer)
end
```

- Call `flush()` before `rn-coverage ios pull`, then `rn-coverage ios export` for LCOV.

The Expo config plugin handles stable app-target mods; it does not replace the Ruby helper for Pod LLVM flags (safe split).
