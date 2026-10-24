import XCTest

final class AdaptiveDrawerUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    override func setUp() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launchArguments = ["adaptive-reset"]
        app.launch()
    }
    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
        app.terminate()
    }
    var destinations: XCUIElement { app.staticTexts["Destinations"].firstMatch }
    func page(_ path: String) {
        XCTAssertTrue(app.staticTexts["route \(path)"].firstMatch.waitForExistence(timeout: 8), app.debugDescription)
    }
    func testInputAndAccessibilityAcrossModes() {
        app.buttons["overlay"].tap()
        page("/")
        app.buttons["Push detail"].firstMatch.tap()
        page("/detail")
        let draft = app.textFields["Retained draft"].firstMatch
        draft.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        draft.typeText("Keep my navigation state")
        app.buttons["permanent"].tap()
        XCTAssertTrue(destinations.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Push detail"].firstMatch.isHittable)
        app.buttons["Close drawer"].tap()
        XCTAssertTrue(destinations.exists, "Persistent visibility is not overlay openness")
        app.buttons["Settings stack"].tap()
        page("/settings")
        app.buttons["Home stack"].tap()
        page("/detail")
        XCTAssertEqual(draft.value as? String, "Keep my navigation state")
        app.buttons["RTL"].tap()
        XCTAssertGreaterThan(destinations.frame.midX, draft.frame.midX)
        app.buttons["LTR"].tap()
        app.buttons["overlay"].tap()
        XCTAssertTrue(destinations.waitForNonExistence(timeout: 5))
        app.buttons["Menu"].firstMatch.tap()
        XCTAssertTrue(destinations.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Push detail"].exists)
        app.buttons["permanent"].tap()
        XCTAssertTrue(app.buttons["Push detail"].firstMatch.waitForExistence(timeout: 5))
        app.buttons["Open result modal"].tap()
        page("/modal")
        app.buttons["Return result"].tap()
        XCTAssertTrue(app.staticTexts["result accepted"].firstMatch.waitForExistence(timeout: 5))
        XCTAssertEqual(draft.value as? String, "Keep my navigation state")
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.lifetime = .keepAlways
        add(shot)
    }
    func testRotationUsesAvailableWidth() {
        app.buttons["auto"].tap()
        XCUIDevice.shared.orientation = .landscapeLeft
        let wide = app.staticTexts["Native navigation · permanent"].firstMatch
        // Both dedicated devices have >=840 DIPs in landscape before safe-area
        // deductions. Assert the iPad transition; the phone can remain compact.
        if app.frame.width > 1000 {
            XCTAssertTrue(wide.waitForExistence(timeout: 5))
            XCTAssertTrue(destinations.exists)
            XCTAssertTrue(app.buttons["Push detail"].firstMatch.isHittable)
            XCUIDevice.shared.orientation = .portrait
            XCTAssertTrue(app.staticTexts["Native navigation · overlay"].firstMatch.waitForExistence(timeout: 5))
            XCTAssertTrue(destinations.waitForNonExistence(timeout: 5))
        }
    }
    func testDrawerAndNativeBackGesturesAfterAdaptation() {
        page("/")
        app.buttons["permanent"].tap()
        app.buttons["overlay"].tap()
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.6))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 260, dy: 0)), withVelocity: .slow, thenHoldForDuration: 0.15)
        XCTAssertTrue(destinations.waitForExistence(timeout: 5), "Drawer pan was not re-enabled")
        app.buttons["Close drawer"].tap()
        XCTAssertTrue(destinations.waitForNonExistence(timeout: 5))
        app.buttons["Push detail"].firstMatch.tap()
        page("/detail")
        app.buttons["permanent"].tap()
        app.buttons["overlay"].tap()
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: app.frame.width * 0.85, dy: 0)), withVelocity: .slow, thenHoldForDuration: 0.15)
        page("/")
        XCTAssertFalse(destinations.exists, "The drawer stole the pushed page's native Back")
    }
}
