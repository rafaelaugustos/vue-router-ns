import XCTest
import UIKit
import CoreSpotlight

final class IntentEntriesUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    func passed(_ name: String, timeout: TimeInterval = 30) {
        let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: timeout), app.debugDescription)
        XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
    }
    func command(_ name: String, result: String? = nil, timeout: TimeInterval = 30) {
        let button = app.buttons["intent-entry:\(name)"].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 15), app.debugDescription)
        button.tap()
        passed(result ?? name, timeout: timeout)
    }
    func shortcut() {
        XCUIDevice.shared.press(.home)
        let icons = springboard.icons.matching(identifier: "Router Entries")
        var icon: XCUIElement?
        for _ in 0..<5 {
            icon = icons.allElementsBoundByIndex.first(where: { $0.isHittable })
            if icon != nil { break }
            springboard.swipeLeft()
        }
        XCTAssertNotNil(icon, springboard.debugDescription)
        icon!.press(forDuration: 1.2)
        let action = springboard.buttons["Intent message"].firstMatch
        XCTAssertTrue(action.waitForExistence(timeout: 10), springboard.debugDescription)
        action.tap()
    }
    func spotlight() {
        XCUIDevice.shared.press(.home)
        springboard.swipeDown()
        let search = XCUIApplication(bundleIdentifier: "com.apple.Spotlight")
        if search.buttons["Continue"].waitForExistence(timeout: 2) { search.buttons["Continue"].tap() }
        let field = search.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10), search.debugDescription)
        let result = search.cells.matching(NSPredicate(format: "identifier CONTAINS %@ AND label BEGINSWITH %@", "ResultCell", "Router Intent Atlas")).firstMatch
        let deadline = Date().addingTimeInterval(120)
        repeat {
            field.tap()
            if field.buttons["Clear text"].exists { field.buttons["Clear text"].tap() }
            field.typeText("Router Intent Atlas")
            if result.waitForExistence(timeout: 15) { break }
        } while Date() < deadline
        XCTAssertTrue(result.exists, search.debugDescription)
        result.tap()
    }
    func testNativeIntents() {
        continueAfterFailure = false
        XCTAssertEqual(UIDevice.current.userInterfaceIdiom, .pad)
        // A direct native probe distinguishes service availability from integration.
        XCTAssertTrue(CSSearchableIndex.isIndexingAvailable())
        let attributes = CSSearchableItemAttributeSet(itemContentType: "public.content")
        attributes.title = "Intent index readiness probe"
        let domain = "org.nativescript.intententrieschecks.probe"
        let probe = CSSearchableItem(uniqueIdentifier: "readiness", domainIdentifier: domain, attributeSet: attributes)
        let completed = expectation(description: "Core Spotlight native indexing responds")
        var nativeError: Error?
        CSSearchableIndex.default().indexSearchableItems([probe]) { error in
            nativeError = error; completed.fulfill()
        }
        XCTAssertEqual(XCTWaiter.wait(for: [completed], timeout: 120), .completed)
        XCTAssertNil(nativeError)
        CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [domain], completionHandler: nil)

        app.launch()
        command("publish"); command("rename")
        shortcut(); passed("received-shortcut-warm-1")
        command("login", result: "login-shortcut-warm-1")
        command("replay")
        shortcut(); passed("received-shortcut-warm-2")
        command("prepare-cold")
        app.terminate()
        shortcut(); passed("received-shortcut-cold-1")
        command("login", result: "login-shortcut-cold-1")
        command("index", timeout: 120)
        app.terminate()
        spotlight(); passed("received-spotlight-search-1")
        command("login", result: "login-spotlight-search-1")
        spotlight(); passed("received-spotlight-search-2")
        command("revoke-search")
        spotlight(); passed("received-spotlight-search-3")
        app.open(URL(string: "routerentries://articles/7")!)
        passed("received-url-search-4")
        command("compare"); command("remove-route")
        shortcut(); passed("received-shortcut-search-5")
        command("clear", timeout: 120)
        Thread.sleep(forTimeInterval: 2)
    }
}
