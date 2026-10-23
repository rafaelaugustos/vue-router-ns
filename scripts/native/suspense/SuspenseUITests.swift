import XCTest

final class SuspenseUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")

    func pending(_ route: String) {
        continueAfterFailure = false
        app.activate()
        XCTAssertTrue(app.staticTexts[route].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts["Loading product"].exists, app.debugDescription)
    }

    func testCancelBack() {
        pending("/product/gesture")
        let completed = expectation(description: "Reverse edge swipe")
        ContractTouch.cancel(in: app.frame) { error in
            XCTAssertNil(error)
            completed.fulfill()
        }
        wait(for: [completed], timeout: 10)
        XCTAssertTrue(app.staticTexts["/product/gesture"].exists)
        XCTAssertTrue(app.staticTexts["Loading product"].exists)
    }

    func testCommitBack() {
        pending("/product/gesture")
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.6))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.6))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .default, thenHoldForDuration: 0)
        XCTAssertTrue(app.staticTexts["Product data"].waitForExistence(timeout: 10), app.debugDescription)
    }

    func testDismissModal() {
        pending("/product/modal")
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.1))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.85))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .default, thenHoldForDuration: 0)
        XCTAssertTrue(app.staticTexts["/product/tab-a"].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts["/product/modal"].waitForNonExistence(timeout: 5))
    }
}
