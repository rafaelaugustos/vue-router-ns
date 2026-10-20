#import "ContractTouch.h"
#import <UIKit/UIKit.h>

// XCTest runner only. A reversing touch path cannot be expressed by its public
// straight-drag API. These are the same event interfaces used by WebDriverAgent:
// https://github.com/appium/appium-xcuitest-driver/blob/master/docs/guides/input-events.md
// No private API is compiled into the NativeScript app or router.
@interface NSObject (ContractEventSignatures)
- (id)initForTouchAtPoint:(CGPoint)point offset:(double)offset;
- (void)moveToPoint:(CGPoint)point atOffset:(double)offset;
- (void)liftUpAtOffset:(double)offset;
- (id)initWithName:(NSString *)name interfaceOrientation:(UIInterfaceOrientation)orientation;
- (void)addPointerEventPath:(id)path;
+ (id)sharedSession;
- (void)synthesizeEvent:(id)event completion:(void (^)(BOOL, NSError *))completion;
@end

@implementation ContractTouch
+ (void)cancelInRect:(CGRect)rect completion:(void (^)(NSError *))completion {
    Class pathClass = NSClassFromString(@"XCPointerEventPath");
    Class recordClass = NSClassFromString(@"XCSynthesizedEventRecord");
    Class sessionClass = NSClassFromString(@"XCTRunnerDaemonSession");
    if (!pathClass || !recordClass || !sessionClass) {
        completion([NSError errorWithDomain:@"NativeContracts" code:1
            userInfo:@{NSLocalizedDescriptionKey: @"This XCTest version lacks reversing touch-path support"}]);
        return;
    }
    CGFloat y = CGRectGetMinY(rect) + rect.size.height * 0.6;
    CGPoint start = CGPointMake(CGRectGetMinX(rect) + 1, y);
    id path = [[pathClass alloc] initForTouchAtPoint:start offset:0];
    [path moveToPoint:CGPointMake(rect.size.width * 0.2, y) atOffset:0.3];
    [path moveToPoint:CGPointMake(rect.size.width * 0.35, y) atOffset:0.55];
    [path moveToPoint:CGPointMake(rect.size.width * 0.15, y) atOffset:0.85];
    [path moveToPoint:start atOffset:1.1];
    [path liftUpAtOffset:1.15];
    id event = [[recordClass alloc] initWithName:@"Cancel native interactive Back"
        interfaceOrientation:UIInterfaceOrientationPortrait];
    [event addPointerEventPath:path];
    [[sessionClass sharedSession] synthesizeEvent:event completion:^(BOOL success, NSError *error) {
        completion(error ?: (success ? nil : [NSError errorWithDomain:@"NativeContracts"
            code:2 userInfo:@{NSLocalizedDescriptionKey: @"XCTest rejected the reversing touch path"}]));
    }];
}
@end
