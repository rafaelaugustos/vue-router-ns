import XCTest
import UIKit

final class EntrypointUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    override func setUp() { continueAfterFailure = false }
    override func tearDown() {
        if let run = testRun, run.failureCount > 0 { capture("failure-screen") }
    }
    func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    func route(_ path: String, window: String = "a") {
        XCTAssertTrue(app.staticTexts["entry:\(window):\(path)"].firstMatch.waitForExistence(timeout: 25), app.debugDescription)
    }
    func command(_ name: String, window: String = "a") {
        let buttons = app.buttons.matching(identifier: "entry:\(window):\(name)")
        XCTAssertTrue(buttons.firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        let button = buttons.allElementsBoundByIndex.last(where: { $0.isHittable }) ?? buttons.allElementsBoundByIndex.last!
        button.tap()
        XCTAssertTrue(app.staticTexts["PASS \(name)"].firstMatch.waitForExistence(timeout: 25), app.debugDescription)
    }
    func open(_ path: String) { app.open(URL(string: "routerentries://\(path)")!) }
    func shortcut(_ title: String) {
        XCUIDevice.shared.press(.home)
        let icons = springboard.icons.matching(identifier: "Router Entries")
        var icon: XCUIElement?
        for _ in 0..<4 {
            icon = icons.allElementsBoundByIndex.first(where: { $0.isHittable })
            if icon != nil { break }
            springboard.swipeLeft()
        }
        XCTAssertNotNil(icon, springboard.debugDescription)
        icon!.press(forDuration: 1.2)
        let action = springboard.buttons[title].firstMatch
        XCTAssertTrue(action.waitForExistence(timeout: 10), springboard.debugDescription)
        action.tap()
    }
    func testLinks() {
        app.terminate()
        open("settings/items/cold")
        route("/settings/items/cold")
        capture("cold-link-unvisited-native-tab")
        open("settings/account")
        route("/login")
        command("login")
        route("/settings/account")
        open("compose")
        route("/compose")
        capture("linked-native-modal")
        command("back")
        XCUIDevice.shared.press(.home)
        open("settings/items/background")
        route("/settings/items/background")
        command("back")
        open("settings/items/background")
        route("/settings/items/background")
        command("capture")
    }
    func testShortcuts() {
        open("")
        route("/")
        command("signout")
        command("publish")
        command("rename")
        shortcut("Stable route")
        route("/renamed")
        capture("warm-system-quick-action-renamed-route")
        app.terminate()
        shortcut("Stable route")
        route("/renamed")
        capture("cold-system-quick-action-renamed-route")
        app.terminate()
        shortcut("Private account")
        route("/login")
        command("login")
        route("/settings/account")
        command("remove-route")
        shortcut("Stable route")
        XCTAssertTrue(app.staticTexts["PASS link:unmatched"].firstMatch.waitForExistence(timeout: 20), app.debugDescription)
        route("/settings/account")
        command("signout")
        XCUIDevice.shared.press(.home)
        let icon = springboard.icons.matching(identifier: "Router Entries").allElementsBoundByIndex.first(where: { $0.isHittable })!
        icon.press(forDuration: 1.2)
        XCTAssertFalse(springboard.buttons["Stable route"].exists)
        XCTAssertFalse(springboard.buttons["Private account"].exists)
        XCUIDevice.shared.press(.home)
        app.activate()
        command("capture")
    }
    func testSystemSearch() {
        app.terminate()
        open("")
        route("/")
        command("signout")
        command("search-index")
        capture("core-spotlight-indexed-content")
        XCUIDevice.shared.press(.home)
        springboard.swipeDown()
        let spotlight = XCUIApplication(bundleIdentifier: "com.apple.Spotlight")
        if spotlight.buttons["Continue"].waitForExistence(timeout: 3) { spotlight.buttons["Continue"].tap() }
        let field = spotlight.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10), spotlight.debugDescription)
        field.tap()
        if field.buttons["Clear text"].exists { field.buttons["Clear text"].tap() }
        field.typeText("Router Entry Guide")
        let result = spotlight.cells.matching(NSPredicate(format: "identifier CONTAINS %@ AND label BEGINSWITH %@", "ResultCell", "Router Entry Guide")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 30), spotlight.debugDescription)
        capture("spotlight-system-result")
        result.tap()
        route("/login")
        command("login")
        route("/settings/account")
        capture("native-search-activity-through-login")
        command("search-clear")
    }
    func testWindows() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("Two UIWindowScenes require iPad") }
        open("settings/items/primary")
        route("/settings/items/primary")
        command("second")
        route("/settings/items/second", window: "b")
        capture("cold-incoming-secondary-scene")
        command("second-link", window: "b")
        route("/settings/items/warm", window: "b")
        capture("warm-incoming-secondary-scene")
    }
}
