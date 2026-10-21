import XCTest
import UIKit

final class SplitUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    func command(_ route: String, _ name: String) {
        let button = app.buttons["split:\(route):\(name)"]
        XCTAssertTrue(button.waitForExistence(timeout: 15), app.debugDescription)
        button.tap()
        XCTAssertTrue(app.staticTexts["PASS \(name)"].firstMatch.waitForExistence(timeout: 20), app.debugDescription)
    }
    func back(_ route: String, previous: String = "Back") {
        let button = app.navigationBars[route].buttons.matching(
            NSPredicate(format: "identifier == 'BackButton' OR label == %@ OR label == 'Back'", previous)
        ).firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 10), app.debugDescription)
        button.tap()
    }
    func start() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launch()
        XCTAssertTrue(app.staticTexts["PASS ready"].firstMatch.waitForExistence(timeout: 30), app.debugDescription)
    }
    func expandWindow() {
        if #available(iOS 26, *), UIDevice.current.userInterfaceIdiom == .pad {
            app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.995, dy: 0.995))
                .press(forDuration: 0.3, thenDragTo: XCUIApplication(bundleIdentifier: "com.apple.springboard").coordinate(withNormalizedOffset: CGVector(dx: 0.99, dy: 0.99)))
        }
    }
    func testNavigation() {
        start()
        expandWindow()
        command("/", "capture")
        command("/", "push")
        command("/detail/1", "push")
        command("/detail/2", "hold")
        XCUIDevice.shared.orientation = .landscapeLeft
        command("/detail/2", "identities")
        capture("landscape-detail-history")
        XCUIDevice.shared.orientation = .portrait
        command("/detail/2", "identities")
        XCTAssertTrue(app.buttons["App action"].firstMatch.exists, "Application ActionItems must survive column controls")
        if UIDevice.current.userInterfaceIdiom == .pad {
            app.buttons["Hide Sidebar"].firstMatch.tap()
            command("/detail/2", "identities")
            capture("system-sidebar-hidden")
            app.buttons["Show Sidebar"].firstMatch.tap()
            command("/detail/2", "identities")
        }
        command("/detail/2", "guard")
        back("/detail/2", previous: "/detail/1")
        command("/detail/2", "guarded")
        command("/detail/2", "guard")
        back("/detail/2", previous: "/detail/1")
        command("/detail/1", "capture")
        command("/detail/1", "hold")
        command("/detail/1", "modal")
        let bar = app.navigationBars["/modal"]
        XCTAssertTrue(bar.waitForExistence(timeout: 10))
        bar.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.95)))
        command("/modal", "guarded")
        capture("guarded-modal")
        command("/modal", "close")
        command("/detail/1", "identities")
        command("/detail/1", "guard")
        back("/detail/1")
        command("/detail/1", "guarded")
        command("/detail/1", "guard")
        back("/detail/1")
        command("/", "capture")
        command("/", "push")
        command("/detail/3", "replace")
        command("/detail/replaced", "clear")
        command("/detail/cleared", "restore")
        XCUIDevice.shared.press(.home)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["PASS ready"].firstMatch.waitForExistence(timeout: 30), app.debugDescription)
        command("/detail/top", "restored")
        capture("restored-native-stack-and-draft")
    }
    // iPadOS 26's system window resize handle; run separately with a fresh install.
    func testWindowResize() throws {
        guard #available(iOS 26, *), UIDevice.current.userInterfaceIdiom == .pad else {
            throw XCTSkip("System window resizing is validated on iPadOS 26")
        }
        start()
        expandWindow()
        command("/", "capture")
        command("/", "push")
        command("/detail/1", "push")
        command("/detail/2", "hold")
        let window = app.windows.firstMatch
        // The first drag takes a full-screen window into windowed mode.
        for _ in 0..<2 {
            window.coordinate(withNormalizedOffset: CGVector(dx: 0.995, dy: 0.995))
                .press(forDuration: 0.3, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.75)))
            command("/detail/2", "identities")
        }
        capture("system-resize-compact")
        print("COMPACT WINDOW \(app.debugDescription)")
        // Expand again using the same OS-owned handle.
        window.coordinate(withNormalizedOffset: CGVector(dx: 0.995, dy: 0.995))
            .press(forDuration: 0.3, thenDragTo: XCUIApplication(bundleIdentifier: "com.apple.springboard").coordinate(withNormalizedOffset: CGVector(dx: 0.99, dy: 0.99)))
        command("/detail/2", "identities")
        capture("system-resize-expanded")
        command("/detail/2", "back")
        command("/detail/1", "back")
        window.coordinate(withNormalizedOffset: CGVector(dx: 0.995, dy: 0.995))
            .press(forDuration: 0.3, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.75)))
        command("/", "capture")
        capture("empty-detail-collapses-to-list")
        expandWindow()
        command("/", "capture")
    }
}
