import XCTest
final class ObservationUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: Bundle(for: ObservationUITests.self).object(forInfoDictionaryKey: "ObservationApp") as? String ?? "org.nativescript.vuerouterns")
    func command(_ name: String) {
        let button = app.buttons[name].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 15), app.debugDescription)
        button.tap()
        XCTAssertTrue(app.staticTexts["PASS \(name)"].firstMatch.waitForExistence(timeout: 15), app.debugDescription)
    }
    func swipe(_ commit: Bool) {
        if !commit {
            let done = expectation(description: "Reverse actual native edge gesture")
            ContractTouch.cancel(in: app.frame) { error in XCTAssertNil(error); done.fulfill() }
            wait(for: [done], timeout: 10)
        } else {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.65))
                .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.65)), withVelocity: .slow, thenHoldForDuration: 0)
        }
    }
    func capture(_ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = name; shot.lifetime = .keepAlways; add(shot)
    }
    func testNativeTransitions() {
        continueAfterFailure = false
        app.launch()
        command("Plain")
        swipe(false); command("Check cancel"); capture("plain-cancel")
        swipe(true); command("Check commit")
        command("Guarded plain")
        swipe(true); command("Check guard"); capture("guard-held")
        command("Allow"); swipe(true); command("Check commit")
        command("Plain")
        command("Detach soon")
        swipe(false); command("Check detach"); capture("unsubscribed-during-native-back")
        command("Back")
        command("Plain")
        command("Interrupt soon")
        swipe(false)
        command("Check interrupt"); capture("interrupted-gesture")
    }
    func testModalInnerBack() {
        continueAfterFailure = false
        app.launch()
        command("Modal"); command("Modal push")
        swipe(false); command("Check cancel")
        swipe(true); command("Check modal")
        capture("modal-inner-back")
    }
    func testCoveredTargetReplacement() {
        continueAfterFailure = false
        app.launch(); command("Target case"); command("Target soon")
        swipe(false); command("Check target")
        capture("covered-target-replaced")
    }
    func testHostUnloadAndReconnect() {
        continueAfterFailure = false
        app.launch(); command("Plain"); command("Unload soon")
        swipe(false); command("Restore host")
        command("Plain"); swipe(false); command("Check cancel"); command("Check reconnect")
        capture("host-reconnected")
    }
}
