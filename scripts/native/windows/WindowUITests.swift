import XCTest
final class WindowUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    override func setUp() { continueAfterFailure = false }
    func command(_ name: String, window: String? = nil) {
        let scope: XCUIElement = window.map {
            app.windows.containing(.navigationBar, identifier: "Window \($0)").firstMatch
        } ?? app
        XCTAssertTrue(scope.waitForExistence(timeout: 30), app.debugDescription)
        let buttons = scope.buttons.matching(identifier: "windows:\(name)")
        XCTAssertTrue(buttons.firstMatch.waitForExistence(timeout: 30), app.debugDescription)
        let button = buttons.allElementsBoundByIndex.first(where: { $0.isHittable }) ?? buttons.firstMatch
        button.tap()
        status(name)
    }
    func status(_ name: String) {
        let status = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(status.waitForExistence(timeout: 90), app.debugDescription)
        XCTAssertEqual(status.label, "PASS \(name)", app.debugDescription)
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name; shot.lifetime = .keepAlways; add(shot)
    }
    func testWindows() {
        app.launch()
        command("prepare")
        XCUIDevice.shared.press(.home)
        sleep(3)
        app.activate()
        command("resume", window: "b")
        command("hmr", window: "b")
        command("close", window: "b")
    }
    func testPrepareOnly() {
        app.launch()
        command("prepare")
        XCUIDevice.shared.press(.home)
    }
    func testReconnectPrepare() {
        app.launch()
        command("prepare")
        let buttons = app.windows.containing(.navigationBar, identifier: "Window b")
            .firstMatch.buttons.matching(identifier: "windows:reconnect")
        let button = buttons.allElementsBoundByIndex.first(where: { $0.isHittable }) ?? buttons.firstMatch
        button.tap()
        XCUIDevice.shared.press(.home)
    }
    func testReconnectResume() {
        app.activate()
        status("reconnect")
        command("hmr", window: "b")
        command("close", window: "b")
    }
    func testResumeOnly() {
        app.activate()
        command("restore-scenes")
        command("hmr", window: "b")
        command("close", window: "b")
    }
}
