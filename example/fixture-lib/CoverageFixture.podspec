require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "CoverageFixture"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/invertase/react-native-coverage"
  s.license      = package["license"]
  s.authors      = "Invertase"

  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/invertase/react-native-coverage.git", :tag => "fixture-#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,cpp}"
  s.private_header_files = "ios/**/*.h"

  install_modules_dependencies(s)
end
