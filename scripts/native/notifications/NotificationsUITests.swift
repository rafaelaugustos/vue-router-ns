import XCTest

final class NotificationsUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    func passed(_ name: String) {
        let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 25), app.debugDescription)
        XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
    }
    func button(_ name: String) {
        let control = app.buttons["notification:\(name)"].firstMatch
        XCTAssertTrue(control.waitForExistence(timeout: 15), app.debugDescription)
        control.tap()
    }
    func notification(_ kind: String, cold: Bool = false) {
        button(kind)
        let allow = springboard.buttons["Allow"].firstMatch
        if allow.waitForExistence(timeout: 2) { allow.tap() }
        XCTAssertTrue(app.staticTexts["SCHEDULED \(kind)"].waitForExistence(timeout: 15), app.debugDescription)
        if cold { app.terminate() } else { XCUIDevice.shared.press(.home) }
        let banner = springboard.staticTexts["Router \(kind)"].firstMatch
        XCTAssertTrue(banner.waitForExistence(timeout: 15), springboard.debugDescription)
        banner.tap()
        passed("received-\(kind)")
    }
    func testNativeNotification() {
        continueAfterFailure = false
        app.launch()
        notification("warm")
        button("login"); passed("login-warm")
        button("repeat"); passed("repeat")
        notification("invalid")
        notification("expired")
        notification("missing")
        button("compare"); passed("compare")
        notification("cold", cold: true)
        button("login"); passed("login-cold")
        // Leave the final rendered destination visible before XCTest releases the app.
        Thread.sleep(forTimeInterval: 2)
    }
}
