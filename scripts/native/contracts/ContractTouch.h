#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

@interface ContractTouch : NSObject
+ (void)cancelInRect:(CGRect)rect completion:(void (^)(NSError *))completion
    NS_SWIFT_NAME(cancel(in:completion:));
@end
