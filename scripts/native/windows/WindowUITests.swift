import XCTest
final class WindowUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    override func setUp() { continueAfterFailure = false }
    func command(_ name: String) {
        let buttons = app.buttons.matching(identifier: "windows:\(name)")
        XCTAssertTrue(buttons.firstMatch.waitForExistence(timeout: 30), app.debugDescription)
        let button = buttons.allElementsBoundByIndex.first(where: { $0.isHittable }) ?? buttons.firstMatch
        button.tap()
        XCTAssertTrue(app.staticTexts["PASS \(name)"].firstMatch.waitForExistence(timeout: 90), app.debugDescription)
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
}
