#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <TargetConditionals.h>
#import <objc/message.h>

#if !TARGET_OS_SIMULATOR
#error This scene lifecycle driver must never be built for a device.
#endif

// Test-only fault injection for the pinned iPadOS 18.6 simulator. Ask SpringBoard
// to disconnect one background scene without discarding its UISceneSession.
// UIKit delivers the actual delegate callbacks; we never invoke them ourselves.
// The Node driver builds this bundle into a temporary copy of the fixture app.
// No Apple private API or test bundle is included in the router or normal demo.
@interface RouterSceneProbe : NSObject
+ (NSDictionary *)disconnect:(UIScene *)scene;
@end

@implementation RouterSceneProbe
+ (NSDictionary *)disconnect:(UIScene *)scene {
  NSAssert(scene.activationState == UISceneActivationStateBackground,
           @"Only a background scene may be disconnected while retaining its session");
  SEL surfaceSelector = NSSelectorFromString(@"_FBSScene");
  SEL initializer = NSSelectorFromString(@"initWithPersistedIdentifiers:preferredAnimationType:forDestroyingSession:callbackQueue:completion:");
  Class actionClass = NSClassFromString(@"UIDestroySceneAction");
  NSAssert([scene respondsToSelector:surfaceSelector] && [actionClass instancesRespondToSelector:initializer],
           @"Scene driver is unavailable on this simulator runtime");
  NSMutableDictionary *result = [NSMutableDictionary dictionaryWithObject:@"requested" forKey:@"status"];
  id surface = ((id(*)(id, SEL))objc_msgSend)(scene, surfaceSelector);
  id action = ((id(*)(id, SEL, id, NSUInteger, BOOL, id, id))objc_msgSend)(
      [actionClass alloc], initializer, nil, 1, NO, dispatch_get_main_queue(), ^{
        result[@"status"] = @"response received";
      });
  SEL send = NSSelectorFromString(@"sendActions:");
  NSAssert([surface respondsToSelector:send], @"Scene driver cannot address the scene");
  ((void(*)(id, SEL, id))objc_msgSend)(surface, send, [NSSet setWithObject:action]);
  return result;
}
@end
