require 'xcodeproj'
require 'fileutils'
dir = ARGV.fetch(0)
FileUtils.mkdir_p(dir)
project = Xcodeproj::Project.new(File.join(dir, 'DestinationChecks.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'DestinationChecks', :ios, '18.0')
target.source_build_phase.add_file_reference(project.main_group.new_file(File.expand_path('BackUITests.swift', __dir__)))
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'org.nativescript.destinationchecks'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'DestinationChecks')
