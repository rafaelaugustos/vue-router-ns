import XCTest
final class RecordingUITests: XCTestCase {
    func testRecording() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
        app.launch()
        for name in ["initial", "success", "blocked", "cancelled", "modal", "divergence", "recovery", "truncate", "clear", "stop"] {
            let button = app.buttons["recording:\(name)"]
            XCTAssertTrue(button.waitForExistence(timeout: 15), app.debugDescription)
            button.tap()
            let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
            XCTAssertTrue(result.waitForExistence(timeout: 15), app.debugDescription)
            XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
        }
    }
}
