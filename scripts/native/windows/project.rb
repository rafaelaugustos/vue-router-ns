require 'xcodeproj'
require 'fileutils'
dir=ARGV.fetch(0)
FileUtils.mkdir_p(dir)
p = Xcodeproj::Project.new(File.join(dir,'WindowChecks.xcodeproj'))
t = p.new_target(:ui_test_bundle, 'WindowChecks', :ios, '18.0')
t.source_build_phase.add_file_reference(p.main_group.new_file(File.expand_path('WindowUITests.swift', __dir__)))
t.build_configurations.each do |c|
 c.build_settings['PRODUCT_BUNDLE_IDENTIFIER']='org.nativescript.windowchecks'
 c.build_settings['GENERATE_INFOPLIST_FILE']='YES'
 c.build_settings['SWIFT_VERSION']='5.0'
 c.build_settings['CODE_SIGNING_ALLOWED']='NO'
 c.build_settings['TARGETED_DEVICE_FAMILY']='1,2'
end
p.save
s=Xcodeproj::XCScheme.new
s.add_build_target(t)
s.add_test_target(t)
s.save_as(p.path,'WindowChecks')
