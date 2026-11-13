import XCTest
import UIKit

final class IntentWindowsUITests: XCTestCase {
    func testIntentWindows() {
        continueAfterFailure = false
        XCTAssertEqual(UIDevice.current.userInterfaceIdiom, .pad)
        let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
        app.launch()
        for name in ["create-saved", "repeat", "reuse", "focus-a", "focus-b", "reset", "wrong-owner", "create-fresh", "close-b", "guard", "dispose"] {
            let buttons = app.buttons.matching(identifier: "intent-window:\(name)")
            XCTAssertTrue(buttons.firstMatch.waitForExistence(timeout: 20), app.debugDescription)
            let control = buttons.allElementsBoundByIndex.first(where: { $0.isHittable }) ?? buttons.firstMatch
            control.tap()
            let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
            XCTAssertTrue(result.waitForExistence(timeout: 35), app.debugDescription)
            XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
        }
        Thread.sleep(forTimeInterval: 2)
    }
}
