# frozen_string_literal: true

# react-native-coverage CocoaPods helper.
#
# Safe-split design: Expo/config plugin handles Android + stable iOS app-target
# mods; Pod-target LLVM coverage flags are applied by requiring this file and
# calling `ReactNativeCoverage.apply_post_install!(installer, options)`.
#
# Usage (Podfile):
#   require_relative '../node_modules/react-native-coverage/cocoapods/coverage_post_install'
#   post_install do |installer|
#     ReactNativeCoverage.apply_post_install!(installer, framework_name_prefixes: ['CoverageFixture'])
#   end

module ReactNativeCoverage
  module_function

  def apply_ios_native_coverage!(build_settings, link_profile:)
    build_settings['CLANG_ENABLE_CODE_COVERAGE'] = 'YES'
    build_settings['OTHER_CFLAGS'] = '$(inherited) -fprofile-instr-generate -fcoverage-mapping'
    build_settings['OTHER_SWIFT_FLAGS'] = '$(inherited) -profile-generate -profile-coverage-mapping'
    return unless link_profile

    # -Wl,-u keeps __llvm_profile_set_filename from being dead-stripped so
    # per-image flush can retarget coverage-%m.profraw under dynamic frameworks.
    build_settings['OTHER_LDFLAGS'] = [
      '$(inherited)',
      '-fprofile-instr-generate',
      '-Wl,-u,___llvm_profile_set_filename',
      '-L$(DT_TOOLCHAIN_DIR)/usr/lib/swift/$(PLATFORM_NAME)',
      '-L$(SDKROOT)/usr/lib/swift',
    ].join(' ')
  end

  def apply_post_install!(installer, options = {})
    prefixes = Array(options.fetch(:framework_name_prefixes, ['CoverageFixture']))
    link_profile = options.fetch(:link_profile, true)
    instrument_app = options.fetch(:instrument_app, true)
    quiet = options.fetch(:quiet, false)

    if instrument_app
      installer.aggregate_targets.each do |aggregate_target|
        user_project = aggregate_target.user_project
        next if user_project.nil?

        user_project.native_targets.each do |target|
          target.build_configurations.each do |config|
            apply_ios_native_coverage!(config.build_settings, link_profile: true)
          end
        end
        user_project.save
      end
    end

    installer.pods_project.targets.each do |target|
      matched = prefixes.any? { |prefix| target.name.include?(prefix) }
      # Always link profile into the Coverage flusher Pod under dynamic linkage
      # so configure/set_filename and the final pod write resolve.
      is_coverage_pod = target.name == 'Coverage'
      next unless matched || is_coverage_pod

      target.build_configurations.each do |config|
        apply_ios_native_coverage!(
          config.build_settings,
          link_profile: link_profile || is_coverage_pod
        )
      end
    end

    warn "[react-native-coverage] applied LLVM coverage flags (prefixes=#{prefixes.inspect})" unless quiet
  end
end
