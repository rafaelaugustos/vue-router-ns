import XCTest
import UIKit

final class WindowDropUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    func passed(_ name: String) {
        let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 30), app.debugDescription)
        XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
    }
    func prepare(_ mode: String) {
        let button = app.buttons["windowdrop:mode-\(mode)"].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 15), app.debugDescription)
        button.tap()
        passed(mode == "create" ? "create-target" : "prepare-\(mode)")
    }
    func drag(_ mode: String, cancel: Bool = false) {
        let card = app.descendants(matching: .any)["windowdrop:card"].firstMatch
        let target = app.descendants(matching: .any)[cancel ? "windowdrop:cancel-area" : "windowdrop:target"].firstMatch
        XCTAssertTrue(card.isHittable && target.isHittable, app.debugDescription)
        if !cancel {
            let sourceWindow = app.windows.containing(.any, identifier: "windowdrop:card").firstMatch
            let targetWindow = app.windows.containing(.any, identifier: "windowdrop:target").firstMatch
            XCTAssertTrue(sourceWindow.exists && targetWindow.exists, app.debugDescription)
            XCTAssertFalse(sourceWindow.frame.intersects(targetWindow.frame), "Actual scene windows must be visible side by side: \(sourceWindow.frame), \(targetWindow.frame)")
        }
        card.press(forDuration: 1, thenDragTo: target, withVelocity: .slow, thenHoldForDuration: 1)
        passed("\(cancel ? "cancel" : "drop")-\(mode)")
    }
    func testCrossWindowDrop() {
        continueAfterFailure = false
        XCTAssertEqual(UIDevice.current.userInterfaceIdiom, .pad)
        app.launch(); passed("ready")
        prepare("create")
        drag("valid")
        prepare("replay")
        for mode in ["repeat", "guard", "account", "removed"] { prepare(mode); drag(mode) }
        prepare("cancel"); drag("cancel", cancel: true)
        prepare("accessible")
        let open = app.buttons["windowdrop:accessible"].firstMatch
        XCTAssertTrue(open.isHittable)
        XCTAssertEqual(open.label, "Open in Inbox window")
        open.tap(); passed("command-accessible")
        prepare("close"); drag("close")
        prepare("clear")
        Thread.sleep(forTimeInterval: 2)
    }
}
