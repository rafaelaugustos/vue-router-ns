import XCTest

final class VisibilityUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    func page(_ path: String) {
        XCTAssertTrue(app.staticTexts[path].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
    }
    func testInteractiveBack() {
        continueAfterFailure = false
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        if springboard.buttons["Cancel"].exists { springboard.buttons["Cancel"].tap() }
        app.launch()
        if app.buttons["Cancel"].exists { app.buttons["Cancel"].tap() }
        page("/inbox")
        app.buttons["Open details"].tap()
        page("/inbox/detail")
        XCTAssertTrue(app.tabBars.buttons["Inbox"].waitForNonExistence(timeout: 5))
        let finished = expectation(description: "reverse native edge gesture")
        ContractTouch.cancel(in: app.frame) { error in
            XCTAssertNil(error)
            finished.fulfill()
        }
        wait(for: [finished], timeout: 10)
        page("/inbox/detail")
        XCTAssertFalse(app.tabBars.buttons["Inbox"].exists)
        app.buttons["Toggle guard"].tap()
        app.buttons["Go back"].tap()
        page("/inbox/detail")
        XCTAssertFalse(app.tabBars.buttons["Inbox"].exists)
        app.buttons["Toggle guard"].tap()
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.6))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.6))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .default, thenHoldForDuration: 0)
        page("/inbox")
        XCTAssertTrue(app.tabBars.buttons["Inbox"].waitForExistence(timeout: 5))
        app.terminate()
        app.open(URL(string: "vuerouterns://saved/detail")!)
        page("/saved/detail")
        XCTAssertTrue(app.tabBars.buttons["Inbox"].waitForNonExistence(timeout: 5))
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.lifetime = .keepAlways
        add(shot)
    }
}
