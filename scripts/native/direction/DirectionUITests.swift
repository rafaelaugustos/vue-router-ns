import XCTest
final class DirectionUITests: XCTestCase {
    func check(_ mode: String) {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "org.nativescript.directionrepro")
        app.launchArguments = ["direction-mode=" + mode]
        app.launch()
        let push = app.buttons["Push detail"].firstMatch
        XCTAssertTrue(push.waitForExistence(timeout: 15), app.debugDescription)
        push.tap()
        let field = app.textFields["Draft"].firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10), app.debugDescription)
        field.tap()
        field.typeText("draft")
        XCTAssertEqual(field.value as? String, "draft", "Typing must reach the field before testing Back")
        app.buttons["Dismiss keyboard"].tap()
        let cancelled = expectation(description: "Reverse native Back")
        ContractTouch.cancel(in: app.frame) { error in XCTAssertNil(error); cancelled.fulfill() }
        wait(for: [cancelled], timeout: 10)
        XCTAssertTrue(field.exists, "Reversed Back keeps detail visible")
        let restored = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "draft"), object: field)
        XCTAssertEqual(XCTWaiter.wait(for: [restored], timeout: 5), .completed,
                       "Reversed Back preserves the edited field after the transition settles")
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = mode; shot.lifetime = .keepAlways; add(shot)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.65))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.65)), withVelocity: .slow, thenHoldForDuration: 0)
        XCTAssertTrue(push.waitForExistence(timeout: 10), app.debugDescription)
    }
    func testExplicitBarControl() { check("explicit-bar-none") }
    func testExplicitBarLTR() { check("explicit-bar-ltr") }
    func testPrebuiltControl() { check("prebuilt-none") }
    func testPrebuiltLTR() { check("prebuilt-ltr") }
    func testPrebuiltRequestLayout() { check("prebuilt-request-layout") }
    func testPrebuiltLoadView() { check("prebuilt-load-view") }
    func testEarlyFrameLTR() { check("early-frame-ltr") }
    func testPrebuiltFrameLTR() { check("prebuilt-frame-ltr") }
    func testPrebuiltRootLTR() { check("prebuilt-root-ltr") }
    func testPrebuiltLateLTR() { check("prebuilt-late-ltr") }
    func testTabsControl() { check("tabs-none") }
    func testTabsLTR() { check("tabs-ltr") }
    func testLateLTR() { check("late-ltr") }
    func testControl() { check("none") }
    func testInheritedLTR() { check("inherited-ltr") }
    func testFrameLTR() { check("frame-ltr") }
    func testPageLTR() { check("page-ltr") }
    func testContainerLTR() { check("container-ltr") }
}
