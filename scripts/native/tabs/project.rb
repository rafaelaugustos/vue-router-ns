# Generate an isolated XCTest runner for the already-installed NativeScript fixture.
require 'xcodeproj'
require 'fileutils'
dir = ARGV.fetch(0)
FileUtils.mkdir_p(dir)
project = Xcodeproj::Project.new(File.join(dir, 'TabChecks.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'TabChecks', :ios, '18.0')
ref = project.main_group.new_file(File.expand_path('TabUITests.swift', __dir__))
target.source_build_phase.add_file_reference(ref)
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'org.nativescript.tabchecks'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'TabChecks')
