require 'xcodeproj'
require 'fileutils'
dir = ARGV.fetch(0)
FileUtils.mkdir_p(dir)
project = Xcodeproj::Project.new(File.join(dir, 'ConsumerChecks.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'ConsumerChecks', :ios, '18.0')
target.source_build_phase.add_file_reference(
  project.main_group.new_file(File.realpath(File.expand_path('ConsumerUITests.swift', __dir__))))
target.source_build_phase.add_file_reference(
  project.main_group.new_file(File.realpath(File.expand_path('../contracts/ContractTouch.m', __dir__))))
if ENV['VOICEOVER_TESTS'] == '1'
  target.source_build_phase.add_file_reference(
    project.main_group.new_file(File.realpath(File.expand_path('VoiceOverTests.m', __dir__))))
end
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'org.nativescript.rc3consumerchecks'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['CODE_SIGNING_ALLOWED'] = ENV['DEVELOPMENT_TEAM'] ? 'YES' : 'NO'
  config.build_settings['DEVELOPMENT_TEAM'] = ENV['DEVELOPMENT_TEAM'] if ENV['DEVELOPMENT_TEAM']
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['SWIFT_OBJC_BRIDGING_HEADER'] = File.realpath(File.expand_path('../contracts/ContractTouch.h', __dir__))
  config.build_settings['CLANG_ENABLE_OBJC_ARC'] = 'YES'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'ConsumerChecks')
