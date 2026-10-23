import XCTest

final class DrawerUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    override func setUp() {
        continueAfterFailure = false
        app.launchArguments = ["drawer-reset"]
        XCUIDevice.shared.orientation = .portrait
    }
    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
        app.terminate()
    }
    var destinations: XCUIElement { app.staticTexts["Drawer destinations"].firstMatch }
    func page(_ path: String) {
        XCTAssertTrue(app.staticTexts["route \(path)"].firstMatch.waitForExistence(timeout: 8), app.debugDescription)
    }
    func menu() {
        app.buttons["Menu"].firstMatch.tap()
        XCTAssertTrue(destinations.waitForExistence(timeout: 5), app.debugDescription)
    }
    func close() {
        app.buttons["Close drawer"].tap()
        XCTAssertTrue(destinations.waitForNonExistence(timeout: 5))
    }
    func edge(rtl: Bool = false, distance: CGFloat = 260) {
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: rtl ? 0.995 : 0.005, dy: 0.6))
        let end = start.withOffset(CGVector(dx: rtl ? -distance : distance, dy: 0))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.15)
    }
    func testKeyboard() {
        continueAfterFailure = false
        app.launch()
        page("/")
        app.buttons["Push detail"].tap()
        page("/detail")
        app.textFields["Draft"].tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        app.textFields["Draft"].typeText("keyboard contract")
        menu()
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        close()
        XCTAssertEqual(app.textFields["Draft"].value as? String, "keyboard contract")
    }
    func testNativeDrawer() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launch()
        if app.buttons["Cancel"].exists { app.buttons["Cancel"].tap() }
        page("/")
        // Reversing the drag leaves the root and closed pane unchanged.
        let reversed = expectation(description: "cancel drawer opening")
        ContractTouch.cancel(in: app.frame) { error in
            XCTAssertNil(error)
            reversed.fulfill()
        }
        wait(for: [reversed], timeout: 10)
        page("/")
        XCTAssertFalse(destinations.exists)
        edge()
        XCTAssertTrue(destinations.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertFalse(app.buttons["Push detail"].exists, "Covered content is still accessible")
        // Scrim closes, without a route change.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.7)).tap()
        page("/")
        XCTAssertTrue(destinations.waitForNonExistence(timeout: 5))
        menu()
        app.buttons["Go detail"].tap()
        page("/detail")
        XCTAssertTrue(destinations.waitForNonExistence(timeout: 5))
        let draft = app.textFields["Draft"]
        draft.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        draft.typeText("retained drawer draft")
        menu() // Opening also dismisses the keyboard.
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        app.buttons["Go settings"].tap()
        page("/settings")
        app.buttons["Home"].firstMatch.tap()
        page("/detail")
        XCTAssertEqual(app.textFields["Draft"].value as? String, "retained drawer draft")
        app.buttons["Block leaving"].tap()
        menu()
        app.buttons["Go home"].tap()
        XCTAssertTrue(destinations.exists, "Rejected navigation closed the drawer")
        close()
        page("/detail")
        edge()
        page("/detail")
        XCTAssertFalse(destinations.exists)
        app.buttons["Unblock leaving"].tap()
        app.buttons["Back to root"].tap()
        page("/")
        app.buttons["Push swipe page"].tap()
        page("/swipe")
        // A pushed page's edge belongs to UIKit, not the drawer.
        edge(distance: app.frame.width * 0.85)
        page("/")
        XCTAssertFalse(destinations.exists)
        menu()
        app.buttons["Keep drawer under modal"].tap()
        page("/modal")
        app.buttons["Return result"].tap()
        XCTAssertTrue(destinations.waitForExistence(timeout: 5))
        close()
        XCTAssertTrue(app.staticTexts["modal result accepted"].exists)
        app.buttons["Use RTL"].tap()
        edge(rtl: true)
        XCTAssertTrue(destinations.waitForExistence(timeout: 5))
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(destinations.waitForExistence(timeout: 5))
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.lifetime = .keepAlways
        add(shot)
        close()
        page("/")
        XCUIDevice.shared.orientation = .portrait
    }
}
