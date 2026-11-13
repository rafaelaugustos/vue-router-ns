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
    // Stage 2 reproduced the UIKit history/leave-guard gap here.
    // Stage 3 must pass the same unchanged-history assertion.
    func testGuardedUIKitHistoryAudit() {
        continueAfterFailure = false
        app.launch()
        command("seed")
        command("guard")
        app.navigationBars.element(boundBy: 0).buttons.firstMatch.press(forDuration: 1.2)
        let target = app.buttons["between (3)"].exists ? app.buttons["between (3)"] : app.buttons["between"]
        XCTAssertTrue(target.waitForExistence(timeout: 5), app.debugDescription)
        target.tap()
        command("unchanged")
    }

    func guardedMenu(_ target: String) {
        let back = app.navigationBars.element(boundBy: 0).buttons["router-guarded-back"]
        XCTAssertTrue(back.waitForExistence(timeout: 5), app.debugDescription)
        back.press(forDuration: 1.2)
        XCTAssertTrue(app.buttons[target].waitForExistence(timeout: 5), app.debugDescription)
        app.buttons[target].tap()
    }
    func testGuardedBack() {
        continueAfterFailure = false
        app.launch()
        command("seed")
        command("guard")
        guardedMenu("item (2)")
        command("protected")
        command("protect")
        guardedMenu("item (2)")
        command("protected")
        command("header")
        app.navigationBars.element(boundBy: 0).buttons["Tools"].tap()
        command("header-ok")
        command("confirm")
        guardedMenu("item (2)")
        XCTAssertTrue(app.alerts["Leave protected page?"].waitForExistence(timeout: 5))
        app.alerts.buttons["Stay"].tap()
        command("protected")
        guardedMenu("item (2)")
        XCTAssertTrue(app.alerts["Leave protected page?"].waitForExistence(timeout: 5))
        app.alerts.buttons["Leave"].tap()
        command("selected")
        XCTAssertFalse(app.navigationBars.element(boundBy: 0).buttons["router-guarded-back"].exists)
        command("seed")
        command("arm")
        // Hold through activation: releasing over UIKit's first history row
        // would itself select that row before the timer fires.
        app.navigationBars.element(boundBy: 0).buttons.firstMatch.press(forDuration: 8)
        XCTAssertTrue(app.staticTexts["5 retained entries"].exists, app.debugDescription)
        XCTAssertTrue(app.staticTexts["Guard activated while native history was open"].waitForExistence(timeout: 8))
        XCTAssertFalse(app.buttons["between"].exists, app.debugDescription)
        command("unchanged")
        app.navigationBars.element(boundBy: 0).buttons["router-guarded-back"].tap()
        command("single")
        command("handoff")
        XCTAssertFalse(app.navigationBars.element(boundBy: 0).buttons["router-guarded-back"].exists)
        app.navigationBars.element(boundBy: 0).buttons.firstMatch.press(forDuration: 1.2)
        // UIKit may select the row under the held finger on release.
        if app.staticTexts["inbox · /item"].exists { app.buttons["between"].tap() }
        command("native")
        app.buttons["history:teardown"].tap()
        let back = app.navigationBars.element(boundBy: 0).buttons["router-guarded-back"]
        XCTAssertTrue(back.waitForExistence(timeout: 3))
        back.press(forDuration: 1.2)
        XCTAssertTrue(app.staticTexts["PASS teardown"].waitForExistence(timeout: 10), app.debugDescription)
    }

}
