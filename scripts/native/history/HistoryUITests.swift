import XCTest
final class HistoryUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    func command(_ name: String) {
        let button = app.buttons["history:\(name)"].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 20), app.debugDescription)
        button.tap()
        let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 60), app.debugDescription)
        XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
    }
    func testRetainedHistory() {
        continueAfterFailure = false
        app.launch()
        command("seed")
        command("blocked")
        command("jump")
        command("stale")
        command("prepare")
        let done = expectation(description: "Cancel native Back in inbox")
        let pane = CGRect(x: app.frame.minX, y: app.frame.minY, width: app.frame.width / 2, height: app.frame.height)
        ContractTouch.cancel(in: pane) { error in
            XCTAssertNil(error)
            done.fulfill()
        }
        wait(for: [done], timeout: 10)
        command("cancelled")
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.6))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.44, dy: 0.6))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .default, thenHoldForDuration: 0)
        command("native")
        command("dispose")
    }
}
