import XCTest
import UIKit

final class DragDropUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    func passed(_ name: String) {
        let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 25), app.debugDescription)
        XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
    }
    func prepare(_ mode: String) {
        let control = app.buttons["drop:mode-\(mode)"].firstMatch
        XCTAssertTrue(control.waitForExistence(timeout: 10), app.debugDescription)
        control.tap()
        passed("prepare-\(mode)")
    }
    func drag(_ mode: String, cancelled: Bool = false) {
        let card = app.descendants(matching: .any)["drop:card"].firstMatch
        let target = app.descendants(matching: .any)[cancelled ? "drop:cancel-area" : "drop:target"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(card.isHittable && target.isHittable, app.debugDescription)
        card.press(forDuration: 1.0, thenDragTo: target, withVelocity: .slow, thenHoldForDuration: 1.0)
        passed("\(cancelled || mode == "multiple" ? "cancel" : "drop")-\(mode)")
    }
    func testRetainedTabDrop() {
        continueAfterFailure = false
        XCTAssertEqual(UIDevice.current.userInterfaceIdiom, .pad)
        app.launch()
        passed("ready")
        drag("valid")
        prepare("replay")
        prepare("repeat"); drag("repeat")
        prepare("cancel"); drag("cancel", cancelled: true)
        prepare("multiple"); drag("multiple")
        for mode in ["invalid", "expired", "removed", "slow", "guard"] {
            prepare(mode); drag(mode)
        }
        prepare("accessible")
        let open = app.buttons["drop:accessible"].firstMatch
        XCTAssertTrue(open.isHittable)
        XCTAssertEqual(open.label, "Open document in Inbox")
        open.tap(); passed("command-accessible")
        prepare("keyboard")
        app.typeKey("o", modifierFlags: .control)
        passed("command-keyboard")
        prepare("clear")
        Thread.sleep(forTimeInterval: 2)
    }
}
