require 'xcodeproj'
require 'fileutils'
dir = ARGV.fetch(0)
FileUtils.mkdir_p(dir)
info = File.join(dir, 'Info.plist')
Xcodeproj::Plist.write_to_path({
  'CFBundleExecutable' => '$(EXECUTABLE_NAME)',
  'CFBundleIdentifier' => '$(PRODUCT_BUNDLE_IDENTIFIER)',
  'CFBundleName' => '$(PRODUCT_NAME)',
  'CFBundlePackageType' => 'BNDL',
  'CFBundleShortVersionString' => '1.0',
  'CFBundleVersion' => '1',
  'ObservationApp' => ENV.fetch('OBSERVATION_APP', 'org.nativescript.vuerouterns')
}, info)
project = Xcodeproj::Project.new(File.join(dir, 'ObservationChecks.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'ObservationChecks', :ios, '18.0')
target.source_build_phase.add_file_reference(
  project.main_group.new_file(File.expand_path('ObservationUITests.swift', __dir__)))
target.source_build_phase.add_file_reference(
  project.main_group.new_file(File.expand_path('../contracts/ContractTouch.m', __dir__)))
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'org.nativescript.observationchecks'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['INFOPLIST_FILE'] = info
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['SWIFT_OBJC_BRIDGING_HEADER'] = File.expand_path('../contracts/ContractTouch.h', __dir__)
  config.build_settings['CLANG_ENABLE_OBJC_ARC'] = 'YES'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'ObservationChecks')
