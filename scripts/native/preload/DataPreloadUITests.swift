import XCTest
final class DataPreloadUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    var card: XCUIElement { app.descendants(matching: .any).matching(identifier: "preloaddata:card").firstMatch }
    func configure(_ name: String) {
        let button = app.buttons["preloaddata:\(name)"]
        XCTAssertTrue(button.waitForExistence(timeout: 15), app.debugDescription)
        button.tap()
        XCTAssertTrue(app.staticTexts["READY \(name)"].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(card.waitForExistence(timeout: 5), app.debugDescription)
    }
    func passed(_ name: String) {
        let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
    }
    func testDataPreparation() {
        continueAfterFailure = false
        app.launch()
        configure("cold"); card.tap(); passed("cold")
        configure("prepared"); card.press(forDuration: 1.5); passed("prepared")
        configure("abandon")
        let start = card.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let outside = card.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 1.8))
        start.press(forDuration: 0.2, thenDragTo: outside); passed("abandon")
        configure("denied"); card.tap(); passed("denied")
        configure("blocked"); card.press(forDuration: 1.5); passed("blocked")
        configure("account"); card.press(forDuration: 1.5); passed("account-stale")
        card.press(forDuration: 1.5); passed("account")
        configure("dispose"); card.press(forDuration: 1.5); passed("dispose")
        XCTAssertFalse(card.exists)
    }
}
