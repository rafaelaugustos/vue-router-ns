import XCTest
final class MenuUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    func command(_ name: String) {
        let button = app.buttons["history:\(name)"].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 20), app.debugDescription)
        button.tap()
        let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 30), app.debugDescription)
        XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
    }
    func menu() {
        XCTAssertTrue(app.staticTexts["Retained history"].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(app.buttons["item · visit 2"].exists, app.debugDescription)
        XCTAssertTrue(app.buttons["item · visit 4"].exists, app.debugDescription)
    }
    func testBackHistoryMenu() {
        continueAfterFailure = false
        app.launch()
        command("seed")
        app.navigationBars.element(boundBy: 0).buttons.firstMatch.press(forDuration: 1.2)
        XCTAssertTrue(app.buttons["between"].waitForExistence(timeout: 5), app.debugDescription)
        app.buttons["between"].tap()
        command("native")
        command("seed")
        app.buttons["menu-back:inbox"].press(forDuration: 1.2)
        menu()
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.85)).tap()
        command("unchanged")
        app.staticTexts["inbox · /last"].tap()
        app.typeKey("h", modifierFlags: .control)
        menu()
        app.typeKey(XCUIKeyboardKey.escape, modifierFlags: [])
        command("unchanged")
        command("guard")
        app.buttons["menu-open:inbox"].tap()
        menu()
        app.buttons["item · visit 2"].tap()
        command("refused")
        app.buttons["menu-back:inbox"].press(forDuration: 1.2)
        menu()
        app.buttons["item · visit 2"].tap()
        command("selected")
        command("invalidate")
        command("dispose")
    }
    // Separate reproduction of the existing UIKit history/leave-guard gap.
    // Not included in the passing opt-in menu acceptance sequence.
    func testGuardedUIKitHistoryAudit() {
        continueAfterFailure = false
        app.launch()
        command("seed")
        command("guard")
        app.navigationBars.element(boundBy: 0).buttons.firstMatch.press(forDuration: 1.2)
        let guardedMenu = app.buttons["between"].exists
        print("Guarded UIKit history menu available: \(guardedMenu)")
        if guardedMenu { app.buttons["between"].tap() }
        command("unchanged")
    }

}
