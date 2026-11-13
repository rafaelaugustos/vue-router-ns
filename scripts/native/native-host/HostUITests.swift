import XCTest
final class HostUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.hostcontract176")
    func command(_ name: String) {
        let button = app.buttons["host:\(name)"].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 20), app.debugDescription)
        button.tap()
        let result = app.staticTexts.matching(NSPredicate(format: "label == %@ OR label == %@", "PASS \(name)", "FAIL \(name)")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 90), app.debugDescription)
        XCTAssertEqual(result.label, "PASS \(name)", app.debugDescription)
    }
    func swipe(commit: Bool) {
        if !commit {
            let done = expectation(description: "Cancel native Back")
            ContractTouch.cancel(in: app.frame) { error in
                XCTAssertNil(error)
                done.fulfill()
            }
            wait(for: [done], timeout: 10)
        } else {
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.6))
            let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.6))
            start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .default, thenHoldForDuration: 0)
        }
    }
    func testExternalHost() {
        continueAfterFailure = false
        app.launch()
        command("conformance")
        command("prepare")
        swipe(commit: false)
        command("cancelled")
        command("guard-on")
        swipe(commit: true)
        command("guarded")
        swipe(commit: true)
        command("committed")
        command("detach")
        command("reattach")
        command("dispose")
    }
}
