import XCTest
import UIKit
import CoreSpotlight

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
    func command(_ name: String, window: String = "a", timeout: TimeInterval = 25) {
        let buttons = app.buttons.matching(identifier: "entry:\(window):\(name)")
        XCTAssertTrue(buttons.firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        let button = buttons.allElementsBoundByIndex.last(where: { $0.isHittable }) ?? buttons.allElementsBoundByIndex.last!
        button.tap()
        XCTAssertTrue(app.staticTexts["PASS \(name)"].firstMatch.waitForExistence(timeout: timeout), app.debugDescription)
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
    func testSystemSearch() throws {
        // Hosted simulators can advertise indexing while the service never
        // completes even a direct Swift call. Probe independently of the JS
        // bridge; a router failure after this succeeds must still fail the test.
        guard CSSearchableIndex.isIndexingAvailable() else {
            throw XCTSkip("Core Spotlight indexing is unavailable on this simulator")
        }
        let attributes = CSSearchableItemAttributeSet(itemContentType: "public.content")
        attributes.title = "Index readiness probe"
        let domain = "org.nativescript.entrypointchecks.probe"
        let probe = CSSearchableItem(uniqueIdentifier: "readiness", domainIdentifier: domain, attributeSet: attributes)
        let completion = expectation(description: "Core Spotlight responds directly to Swift")
        var probeError: Error?
        CSSearchableIndex.default().indexSearchableItems([probe]) { error in
            probeError = error
            completion.fulfill()
        }
        let readiness = XCTWaiter.wait(for: [completion], timeout: 120)
        if readiness == .timedOut {
            throw XCTSkip("Core Spotlight did not complete the independent Swift service probe in 120s; native search acceptance requires a responsive indexing service")
        }
        XCTAssertEqual(readiness, .completed)
        XCTAssertNil(probeError)
        CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [domain], completionHandler: nil)
        app.terminate()
        open("")
        route("/")
        command("signout")
        // Core Spotlight starts its indexing service asynchronously on a fresh
        // simulator. Its completion is not bounded by a page-transition timeout.
        command("search-index", timeout: 120)
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
        XCTAssertTrue(result.waitForExistence(timeout: 60), spotlight.debugDescription)
        capture("spotlight-system-result")
        result.tap()
        route("/login")
        command("login")
        route("/settings/account")
        capture("native-search-activity-through-login")
        command("search-clear", timeout: 120)
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
