#import <XCTest/XCTest.h>

// Requires Xcode/iOS 27 VoiceOver service. This captures actual service speech,
// not labels inferred from an accessibility tree. No app instrumentation is used.
@interface VoiceOverTests : XCTestCase
@end
@implementation VoiceOverTests
- (void)testSpokenNavigation {
    if (@available(iOS 27.0, *)) {
        self.continueAfterFailure = NO;
        XCUIApplication *app = [[XCUIApplication alloc] initWithBundleIdentifier:@"org.nativescript.routerrc3validation"];
        XCUIVoiceOverService *voice = XCUIDevice.sharedDevice.voiceOverService;
        BOOL originallyEnabled = voice.enabled;
        NSMutableArray *evidence = [NSMutableArray new];
        NSError *error = nil;
        [app launch];
        @try {
            XCTAssertTrue([voice enableAndReturnError:&error], @"%@", error);
            XCTAssertTrue(voice.enabled);
            [self focus:@"Along the coast" voice:voice evidence:evidence stage:@"home"];
            [app doubleTap];
            XCTAssertTrue([app.buttons[@"Edit in a modal"] waitForExistenceWithTimeout:15]);
            [self scan:voice evidence:evidence stage:@"detail" forbidden:@[@"Into the forest", @"Find a note", @"Save note"] required:@"Edit in a modal"];
            [self focus:@"Edit in a modal" voice:voice evidence:evidence stage:@"open-modal"];
            [app doubleTap];
            XCTAssertTrue([app.textViews[@"Note draft"] waitForExistenceWithTimeout:15]);
            [self scan:voice evidence:evidence stage:@"modal" forbidden:@[@"Along the coast", @"Edit in a modal", @"Into the forest"] required:@"Note draft"];
            [self focus:@"Cancel" voice:voice evidence:evidence stage:@"cancel-modal"];
            [app doubleTap];
            XCTAssertTrue([app.buttons[@"Edit in a modal"] waitForExistenceWithTimeout:15]);
            [self scan:voice evidence:evidence stage:@"returned-detail" forbidden:@[@"Note draft", @"Save note", @"Into the forest"] required:@"Edit in a modal"];
            [self focus:@"Edit in a modal" voice:voice evidence:evidence stage:@"guard-open"];
            [app doubleTap];
            XCTAssertTrue([app.textViews[@"Note draft"] waitForExistenceWithTimeout:15]);
            [self focus:@"Note draft" voice:voice evidence:evidence stage:@"guard-edit"];
            [app doubleTap];
            [app.textViews[@"Note draft"] typeText:@"a"];
            [app.buttons[@"Hide keyboard"] tap];
            [app doubleTap];
            [self focus:@"Cancel" voice:voice evidence:evidence stage:@"guard-cancel"];
            [app doubleTap];
            XCTAssertTrue([app.buttons[@"Keep editing"] waitForExistenceWithTimeout:15]);
            [self scan:voice evidence:evidence stage:@"guard-dialog" forbidden:@[@"Along the coast", @"Edit in a modal", @"Save note"] required:@"Keep editing"];
            [self focus:@"Keep editing" voice:voice evidence:evidence stage:@"guard-refuse"];
            [app doubleTap];
            [self scan:voice evidence:evidence stage:@"guard-retained-modal" forbidden:@[@"Along the coast", @"Edit in a modal", @"Into the forest"] required:@"Note draft"];
            // Characterize the generic Back announced at the backward boundary.
            // Activating it must not navigate the covered detail underneath the modal.
            XCUIVoiceOverOutput *boundary = [voice currentSpeechAndReturnError:nil];
            if ([boundary.utterance localizedCaseInsensitiveContainsString:@"Back button"]) {
                [app doubleTap];
                XCTAssertTrue([app.textViews[@"Note draft"] waitForExistenceWithTimeout:15]);
                [evidence addObject:@{@"stage":@"guard-boundary-activation", @"utterance":boundary.utterance}];
                XCTAssertTrue([app.buttons[@"Keep editing"] waitForExistenceWithTimeout:15]);
                [self focus:@"Keep editing" voice:voice evidence:evidence stage:@"guard-boundary-refuse"];
                [app doubleTap];
            }
            [self focus:@"Cancel" voice:voice evidence:evidence stage:@"guard-discard-open"];
            [app doubleTap];
            [self focus:@"Discard Button" voice:voice evidence:evidence stage:@"guard-discard"];
            [app doubleTap];
            XCTAssertTrue([app.buttons[@"Edit in a modal"] waitForExistenceWithTimeout:15]);
            [self scan:voice evidence:evidence stage:@"guard-returned-detail" forbidden:@[@"Note draft", @"Save note", @"Keep editing"] required:@"Edit in a modal"];

        } @finally {
            if (!originallyEnabled) XCTAssertTrue([voice disableAndReturnError:&error], @"%@", error);
            XCTAssertEqual(voice.enabled, originallyEnabled);
            NSData *json = [NSJSONSerialization dataWithJSONObject:evidence options:NSJSONWritingPrettyPrinted error:nil];
            XCTAttachment *attachment = [XCTAttachment attachmentWithData:json uniformTypeIdentifier:@"public.json"];
            attachment.name = @"voiceover-spoken-navigation";
            attachment.lifetime = XCTAttachmentLifetimeKeepAlways;
            [self addAttachment:attachment];
        }
    } else {
        XCTFail(@"Spoken VoiceOver acceptance requires iOS 27 or later; older platforms are not certified by this runner.");
    }
}
- (NSString *)step:(XCUIVoiceOverService *)voice backward:(BOOL)backward evidence:(NSMutableArray *)evidence stage:(NSString *)stage API_AVAILABLE(ios(27.0)) {
    NSError *error = nil;
    XCUIVoiceOverOutput *output = backward ? [voice moveBackwardAndReturnError:&error] : [voice moveForwardAndReturnError:&error];
    XCTAssertNotNil(output, @"%@", error);
    NSString *speech = output.utterance ?: @"";
    [evidence addObject:@{@"stage":stage, @"utterance":speech}];
    NSLog(@"VOICEOVER %@: %@", stage, speech);
    if ([stage isEqualToString:@"guard-retained-modal"] && [speech localizedCaseInsensitiveContainsString:@"Back button"]) {
        NSLog(@"VOICEOVER BACK CONTEXT: %@", voice.debugDescription);
    }
    return speech;
}
- (void)focus:(NSString *)text voice:(XCUIVoiceOverService *)voice evidence:(NSMutableArray *)evidence stage:(NSString *)stage API_AVAILABLE(ios(27.0)) {
    XCUIVoiceOverOutput *current = [voice currentSpeechAndReturnError:nil];
    if ([current.utterance localizedCaseInsensitiveContainsString:text]) return;
    for (NSInteger direction=0; direction<2; direction++) {
        NSString *previous = nil;
        for (NSInteger i=0; i<20; i++) {
            NSString *speech = [self step:voice backward:(direction == 1) evidence:evidence stage:stage];
            if ([speech localizedCaseInsensitiveContainsString:text]) return;
            if ([speech isEqualToString:previous]) break;
            previous = speech;
        }
    }
    XCTFail(@"VoiceOver did not reach %@", text);
}
- (void)scan:(XCUIVoiceOverService *)voice evidence:(NSMutableArray *)evidence stage:(NSString *)stage forbidden:(NSArray<NSString *> *)forbidden required:(NSString *)required API_AVAILABLE(ios(27.0)) {
    BOOL found = NO;
    for (NSInteger direction=0; direction<2; direction++) {
        NSString *previous = nil;
        for (NSInteger i=0; i<24; i++) {
            NSString *speech = [self step:voice backward:(direction == 1) evidence:evidence stage:stage];
            found |= [speech localizedCaseInsensitiveContainsString:required];
            for (NSString *hidden in forbidden) XCTAssertFalse([speech localizedCaseInsensitiveContainsString:hidden], @"Covered content spoken during %@: %@", stage, speech);
            if ([speech isEqualToString:previous]) break;
            previous = speech;
        }
    }
    XCTAssertTrue(found, @"Expected visible content was not spoken in %@", stage);
}
@end
