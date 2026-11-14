import XCTest
import UIKit
final class WindowCreateUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    func passed(_ name: String) {
        let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 35), app.debugDescription)
        XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
    }
    func prepare(_ mode: String) {
        let button = app.buttons["windowcreate:mode-\(mode)"].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 10), app.debugDescription)
        button.tap(); passed("prepare-\(mode)")
    }
    func drag(_ mode: String) {
        let card = app.descendants(matching: .any)["windowcreate:card"].firstMatch
        XCTAssertTrue(card.isHittable, app.debugDescription)
        let source = app.windows.containing(.any, identifier: "windowcreate:card").firstMatch
        // A system screen-edge target, not an app-owned drop target or a creation button.
        let end = source.coordinate(withNormalizedOffset: CGVector(dx: mode == "cancel" ? 0.5 : 0.995, dy: mode == "cancel" ? 0.30 : 0.5))
        card.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 1.2, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 2)
        if mode == "race" {
            passed("guard-waiting")
            let revoke = app.buttons["windowcreate:revoke"].firstMatch
            XCTAssertTrue(revoke.isHittable, app.debugDescription)
            revoke.tap()
        }
        passed(mode == "cancel" ? "cancel-cancel" : "drop-\(mode)")
        if mode == "valid" { visibleWindows() }
    }
    func visibleWindows() {
        let source = app.windows.containing(.any, identifier: "windowcreate:card").firstMatch
        let target = app.windows.containing(.staticText, identifier: "/documents/7").firstMatch
        XCTAssertTrue(source.exists && target.exists, app.debugDescription)
        XCTAssertFalse(source.frame.intersects(target.frame), "OS-created scene must be visible beside the retained source")
    }
    func testEdgeDragCreatesScene() {
        continueAfterFailure = false
        XCTAssertEqual(UIDevice.current.userInterfaceIdiom, .pad)
        app.launch(); passed("ready")
        drag("valid")
        prepare("replay")
        for mode in ["cancel", "guard", "account", "permission", "removed", "expired", "close", "race"] { prepare(mode); drag(mode) }
        prepare("button")
        let open = app.buttons["windowcreate:alternative"].firstMatch
        XCTAssertTrue(open.isHittable)
        XCTAssertEqual(open.label, "Open document in new window")
        open.tap(); passed("command-button"); visibleWindows()
        prepare("keyboard")
        app.typeKey("o", modifierFlags: .control); passed("command-keyboard"); visibleWindows()
        prepare("clear")
        Thread.sleep(forTimeInterval: 2)
    }
}
