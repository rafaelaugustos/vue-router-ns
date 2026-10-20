import XCTest

final class ContractUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")

    func button(_ name: String) -> XCUIElement {
        let matches = app.buttons.matching(NSPredicate(
            format: "identifier BEGINSWITH 'command:' AND identifier ENDSWITH %@", ":\(name)"))
        XCTAssertTrue(matches.firstMatch.waitForExistence(timeout: 15), app.debugDescription)
        // UIKit includes the presenting Page in the tree beneath a sheet.
        // Its coordinates are not the modal's coordinates. Each page has unique
        // identifiers so XCTest resolves the chosen element again unambiguously.
        return matches.allElementsBoundByIndex.last(where: { $0.isHittable })!
    }
    func command(_ name: String, timeout: TimeInterval = 30) {
        button(name).tap()
        XCTAssertTrue(app.staticTexts["PASS \(name)"].firstMatch.waitForExistence(timeout: timeout), app.debugDescription)
    }
    func capture(_ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
    func swipe(commit: Bool) {
        if !commit {
            let finished = expectation(description: "Native reversing touch path")
            ContractTouch.cancel(in: app.frame) { error in
                XCTAssertNil(error)
                finished.fulfill()
            }
            wait(for: [finished], timeout: 10)
            return
        }
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.6))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: commit ? 0.85 : 0.18, dy: 0.6))
        start.press(forDuration: 0.05, thenDragTo: end,
                    withVelocity: commit ? .default : .slow,
                    thenHoldForDuration: commit ? 0 : 1)
    }
    func testNativeContracts() {
        continueAfterFailure = false
        app.launch()
        XCTAssertTrue(app.staticTexts["PASS ready"].firstMatch.waitForExistence(timeout: 30))
        command("suite")
        capture("native-contract-suite")
        command("hmr")
        capture("covered-page-hmr")
        command("gesture-setup")
        swipe(commit: false)
        command("cancel-check")
        capture("cancelled-edge-gesture")
        swipe(commit: true)
        command("commit-check")
        command("guard-setup")
        swipe(commit: true)
        command("guard-check")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        command("guard-check")
        command("allow")
        swipe(commit: true)
        command("commit-check")
        command("modal-setup")
        // A sheet dismissal is attempted by UIKit; the guard must hold it.
        let sheetBar = app.navigationBars.allElementsBoundByIndex.last!
        sheetBar.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.9)))
        command("modal-check")
        command("allow")
        button("finish-modal").tap()
        command("modal-result-check")
        command("restore-setup")
        let oldPid = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'PID '")).firstMatch.label
        XCUIDevice.shared.press(.home)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["PASS ready"].firstMatch.waitForExistence(timeout: 30))
        XCTAssertNotEqual(oldPid, app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'PID '")).firstMatch.label)
        command("restore-check")
        capture("new-process-restored-history")
        command("measure", timeout: 180)
        capture("performance-and-retention")
    }
    func testCoveredHmrNegativeControl() {
        continueAfterFailure = false
        app.launch()
        XCTAssertTrue(app.staticTexts["PASS ready"].firstMatch.waitForExistence(timeout: 30))
        button("hmr").tap()
        // The regression itself can leave an unmounted, non-reactive native
        // Page visible. Its status label is therefore not the oracle. ios.mjs
        // requires the fault build's persisted, specific HMR failure report.
        _ = app.staticTexts["FAIL hmr"].firstMatch.waitForExistence(timeout: 25)
        capture("covered-hmr-regression-detected")
    }
}
