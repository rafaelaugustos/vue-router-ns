import XCTest
import UIKit

final class SidebarDropUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    func passed(_ name: String) {
        let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 25), app.debugDescription)
        XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
    }
    func prepare(_ mode: String) {
        let control = app.buttons["sidebar:mode-\(mode)"].firstMatch
        XCTAssertTrue(control.waitForExistence(timeout: 10), app.debugDescription)
        control.tap(); passed("prepare-\(mode)")
    }
    func drag(_ mode: String, destination: String = "inbox") {
        let card = app.descendants(matching: .any)["sidebar:card"].firstMatch
        let target = app.descendants(matching: .any)[mode == "cancel" ? "sidebar:cancel-area" : "sidebar:target-\(destination)"].firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(card.isHittable && target.isHittable, app.debugDescription)
        XCTAssertLessThan(target.frame.maxX, card.frame.minX, "The target must be in the native sidebar")
        card.press(forDuration: 1.0, thenDragTo: target, withVelocity: .slow, thenHoldForDuration: 1.0)
        passed("\(["cancel", "multiple", "removehover"].contains(mode) ? "cancel" : "drop")-\(mode)")
    }
    func testSidebarDestinations() {
        continueAfterFailure = false
        XCTAssertEqual(UIDevice.current.userInterfaceIdiom, .pad)
        app.launch(); passed("ready")
        drag("valid")
        prepare("archive"); drag("archive", destination: "archive")
        prepare("replay")
        prepare("repeat"); drag("repeat")
        for mode in ["cancel", "multiple", "removehover", "slow", "owner", "permission", "guard"] {
            prepare(mode); drag(mode)
        }
        prepare("accessible")
        let open = app.buttons["sidebar:open-archive"].firstMatch
        XCTAssertTrue(open.isHittable)
        XCTAssertEqual(open.label, "Open in Archive")
        open.tap(); passed("command-accessible")
        prepare("keyboard")
        app.typeKey("o", modifierFlags: .control); passed("command-keyboard")
        prepare("clear")
        Thread.sleep(forTimeInterval: 2)
    }
}
