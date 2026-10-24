import XCTest

final class PageActionsUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    override func setUp() {
        continueAfterFailure = false
        app.launch()
    }
    override func tearDown() { app.terminate() }
    func text(_ value: String) {
        XCTAssertTrue(app.staticTexts[value].firstMatch.waitForExistence(timeout: 8), app.debugDescription)
    }
    func menu() {
        app.staticTexts["Hold for actions"].firstMatch.press(forDuration: 1.1)
        XCTAssertTrue(app.buttons["Delete"].firstMatch.waitForExistence(timeout: 5), app.debugDescription)
    }
    func action(_ name: String) -> XCUIElement {
        app.collectionViews.buttons[name].firstMatch
    }
    func choose(_ name: String) {
        let button = action(name)
        XCTAssertTrue(button.exists && button.isEnabled, app.debugDescription)
        button.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
    func dismiss() { app.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.92)).tap() }
    func frontmost(_ name: String) -> XCUIElement {
        let matches = app.buttons.matching(identifier: name)
        for _ in 0..<25 {
            if let button = matches.allElementsBoundByIndex.first(where: { $0.isHittable }) {
                return button
            }
            Thread.sleep(forTimeInterval: 0.2)
        }
        XCTFail(app.debugDescription)
        return matches.firstMatch
    }
    func testSharedNativeActions() {
        text("Saved 0 · errors 0")
        app.buttons["Save"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Saving…"].firstMatch.waitForExistence(timeout: 3))
        XCTAssertFalse(app.buttons["Saving…"].firstMatch.isEnabled, app.debugDescription)
        menu()
        // Native menu updates from the same busy state; the old callback also
        // rechecks admission if a platform retains its native action object.
        XCTAssertTrue(app.buttons["Save"].firstMatch.waitForExistence(timeout: 6))
        choose("Save")
        text("Saved 2 · errors 0")
        app.buttons["Disable save"].tap()
        XCTAssertFalse(app.buttons["Save"].firstMatch.isEnabled)
        menu()
        XCTAssertFalse(action("Save").isEnabled)
        dismiss()
        app.buttons["Enable save"].tap()
        app.buttons["Rename save"].tap()
        XCTAssertTrue(app.buttons["Salvar"].firstMatch.exists)
        menu()
        XCTAssertTrue(action("Salvar").exists)
        choose("Delete")
        text("Saved 2 · errors 1")
        text("Error: Demo delete failure")
        app.buttons["Hide save"].tap()
        XCTAssertFalse(app.buttons["Salvar"].exists)
        app.buttons["Show save"].tap()
        app.buttons["Salvar"].firstMatch.tap()
        text("Saved 3 · errors 1")
        app.buttons["Legacy"].tap()
        text("Marked none · legacy 1")
        menu()
        choose("Inspect")
        text("route /modal")
        XCTAssertTrue(app.buttons["Done"].firstMatch.waitForExistence(timeout: 5))
        frontmost("Block leaving").tap()
        app.buttons["Done"].firstMatch.tap()
        text("route /modal")
        frontmost("Unblock leaving").tap()
        app.buttons["Done"].firstMatch.tap()
        text("Result accepted")
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.lifetime = .keepAlways
        add(shot)
    }
    func testReusedMenuSource() {
        app.swipeUp()
        app.buttons["Reuse row soon"].tap()
        app.staticTexts["Row A"].firstMatch.press(forDuration: 1.1)
        XCTAssertTrue(app.buttons["Mark A"].firstMatch.waitForExistence(timeout: 2))
        XCTAssertTrue(app.buttons["Mark A"].firstMatch.waitForNonExistence(timeout: 5))
        app.staticTexts["Row B"].firstMatch.press(forDuration: 1.1)
        XCTAssertTrue(app.buttons["Mark B"].firstMatch.waitForExistence(timeout: 5))
        choose("Mark B")
        text("Marked B · legacy 0")
    }
}
