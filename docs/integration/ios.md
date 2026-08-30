# iOS integration

- New Architecture only; TurboModule autolinks via the podspec.
- Flusher packaging (dynamic frameworks): **mode (c)** — Pod LINKEDIT for
  configured `frameworkNamePrefixes` **and** the main executable (see spike verdict).
- Apply Pod-target LLVM flags with the shipped Ruby helper:

```ruby
require_relative '../node_modules/react-native-coverage/cocoapods/coverage_post_install'

post_install do |installer|
  ReactNativeCoverage.apply_post_install!(installer, framework_name_prefixes: ['MyLib'])
end
```

- Call `flush()` before `rn-coverage ios pull`, then `rn-coverage ios export` for LCOV.

The Expo config plugin wires the Podfile helper call for the example; it does not
replace the Ruby helper for Pod LLVM flags (safe split).
