import XCTest
final class WindowUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    override func setUp() { continueAfterFailure = false }
    func command(_ name: String) {
        let buttons = app.buttons.matching(identifier: "windows:\(name)")
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
        command("resume")
        command("hmr")
        command("close")
    }
    func testPrepareOnly() {
        app.launch()
        command("prepare")
        XCUIDevice.shared.press(.home)
    }
    func testReconnectPrepare() {
        app.launch()
        command("prepare")
        let buttons = app.buttons.matching(identifier: "windows:reconnect")
        let button = buttons.allElementsBoundByIndex.first(where: { $0.isHittable }) ?? buttons.firstMatch
        button.tap()
        XCUIDevice.shared.press(.home)
    }
    func testReconnectResume() {
        app.activate()
        status("reconnect")
        command("hmr")
        command("close")
    }
    func testResumeOnly() {
        app.activate()
        command("restore-scenes")
        command("hmr")
        command("close")
    }
}
