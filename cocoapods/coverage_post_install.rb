# frozen_string_literal: true

# react-native-coverage CocoaPods helper (scaffold stub).
#
# Safe-split design: Expo/config plugin handles Android + stable iOS app-target
# mods; Pod-target LLVM coverage flags are applied by requiring this file and
# calling `ReactNativeCoverage.apply_post_install!(installer, options)`.
#
# Full flag wiring lands with build-integration work. This stub is intentionally
# a minimal placeholder so consumers can adopt the require+call shape early.
#
# Usage (Podfile):
#   require_relative '../node_modules/react-native-coverage/cocoapods/coverage_post_install'
#   post_install do |installer|
#     ReactNativeCoverage.apply_post_install!(installer)
#   end

module ReactNativeCoverage
  module_function

  def apply_post_install!(installer, options = {})
    # TODO: set CLANG_ENABLE_CODE_COVERAGE / LLVM profile generate+use flags
    # on matched pod targets. options may include :framework_name_prefixes.
    warn '[react-native-coverage] coverage_post_install stub — no LLVM flags applied yet' unless options[:quiet]
  end
end
