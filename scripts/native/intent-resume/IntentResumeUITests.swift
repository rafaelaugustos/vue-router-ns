import XCTest
final class IntentResumeUITests: XCTestCase {
    func testIntentResume() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
        app.launch()
        XCTAssertTrue(app.buttons["resume:again"].waitForExistence(timeout: 15))
        app.open(URL(string: "routerentries://private/url")!)
        XCTAssertTrue(app.staticTexts["PASS request"].waitForExistence(timeout: 15), app.debugDescription)
        for name in ["login", "again", "cancel", "account", "expired", "superseded", "race", "removed"] {
            let button = app.buttons["resume:\(name)"].firstMatch
            XCTAssertTrue(button.waitForExistence(timeout: 15), app.debugDescription)
            button.tap()
            let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
            XCTAssertTrue(result.waitForExistence(timeout: 20), app.debugDescription)
            XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
        }
    }
}
