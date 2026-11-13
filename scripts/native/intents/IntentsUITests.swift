import XCTest
final class IntentsUITests: XCTestCase {
    func testIntents() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
        app.launch()
        for name in ["preview", "route", "url", "repeat", "blocked", "cancelled", "owner", "expired", "removed", "modal"] {
            let button = app.buttons["intents:\(name)"]
            XCTAssertTrue(button.waitForExistence(timeout: 15), app.debugDescription)
            button.tap()
            let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
            XCTAssertTrue(result.waitForExistence(timeout: 15), app.debugDescription)
            XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
        }
        app.open(URL(string: "routerentries://items/os-link")!)
        XCTAssertTrue(app.staticTexts["PASS os-link"].waitForExistence(timeout: 20), app.debugDescription)
    }
}
