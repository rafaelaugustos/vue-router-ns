import XCTest

final class BackEdgeUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
    }

    private func check(bundle: String, mode: String, inset: Bool, expectedPop: Bool) {
        let app = XCUIApplication(bundleIdentifier: bundle)
        app.launchArguments = [mode] + (inset ? [] : ["full-width"])
        app.launch()
        XCTAssertTrue(app.buttons["Push detail"].waitForExistence(timeout: 15))
        app.buttons["Push detail"].tap()
        XCTAssertEqual(app.staticTexts["route"].label, "Detail")
        let field = app.textFields["Retained draft"].frame
        XCTAssertEqual(field.minX - 16, inset ? 280 : 0, accuracy: 1)
        let start = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: field.minX - 14, dy: app.frame.height * 0.75))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: field.width * 0.8, dy: 0)), withVelocity: .slow, thenHoldForDuration: 0.3)
        let result = app.staticTexts["route"].label
        let label = "\(bundle) / \(mode) / \(inset ? "inset" : "full-width")"
        let attachment = XCTAttachment(string: "\(label): expectedPop=\(expectedPop), actualRoute=\(result)")
        attachment.name = label
        attachment.lifetime = .keepAlways
        add(attachment)
        XCTAssertEqual(result, expectedPop ? "Root" : "Detail", label)
        if !expectedPop {
            app.buttons["Root"].tap()
            XCTAssertEqual(app.staticTexts["route"].label, "Root", "Native header Back remains usable")
        }
        app.terminate()
    }

    func testUIKitControls() {
        for mode in ["none", "did-show", "animation", "interaction", "both"] {
            for inset in [false, true] {
                let customAnimator = mode == "animation" || mode == "both"
                var expectedPop = !inset && !customAnimator
                if #available(iOS 26.0, *) {
                    expectedPop = !customAnimator
                }
                check(bundle: "org.router168.uikit", mode: mode, inset: inset, expectedPop: expectedPop)
            }
        }
    }

    func testPublishedCoreFrame() {
        for inset in [false, true] {
            check(bundle: "org.nativescript.vuerouterns", mode: "core", inset: inset, expectedPop: !inset)
        }
    }
}
