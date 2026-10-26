require 'xcodeproj'
require 'fileutils'
dir = ARGV.fetch(0)
FileUtils.mkdir_p(dir)
project = Xcodeproj::Project.new(File.join(dir, 'BackEdge.xcodeproj'))
app = project.new_target(:application, 'UIKitControl', :ios, '18.0')
tests = project.new_target(:ui_test_bundle, 'BackEdgeChecks', :ios, '18.0')
[[app, 'UIKitControl.swift'], [tests, 'BackEdgeUITests.swift']].each do |target, source|
  target.source_build_phase.add_file_reference(project.main_group.new_file(File.expand_path(source, __dir__)))
  target.build_configurations.each do |config|
    config.build_settings.merge!({
      'PRODUCT_BUNDLE_IDENTIFIER' => target == app ? 'org.router168.uikit' : 'org.router168.checks',
      'GENERATE_INFOPLIST_FILE' => 'YES',
      'SWIFT_VERSION' => '5.0',
      'CODE_SIGNING_ALLOWED' => 'NO',
      'TARGETED_DEVICE_FAMILY' => '2',
      'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad' => 'UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight',
      'INFOPLIST_KEY_UIRequiresFullScreen' => 'YES',
      'INFOPLIST_KEY_UILaunchScreen_Generation' => 'YES',
    })
  end
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(tests)
scheme.add_test_target(tests)
scheme.save_as(project.path, 'BackEdgeChecks')
