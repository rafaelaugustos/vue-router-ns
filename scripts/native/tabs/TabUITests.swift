import XCTest

final class TabUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")

    func page(_ path: String) {
        XCTAssertTrue(app.staticTexts[path].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
    }
    func button(_ name: String) { app.buttons[name].tap() }
    func tab(_ name: String) { app.tabBars.buttons[name].tap() }
    func testIndependentStacksAndReselection() {
        continueAfterFailure = false
        app.launch()
        page("/a")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "ready")).firstMatch.waitForExistence(timeout: 10))
        button("Push detail")
        page("/a/detail")
        tab("B")
        page("/b")
        button("Push detail")
        page("/b/detail")
        tab("A")
        page("/a/detail")
        tab("B")
        page("/b/detail")
        button("Select A")
        page("/a/detail")
        button("Select B")
        page("/b/detail")
        button("Select A")
        button("Deep link B")
        page("/b/detail")
        page("reselects:0")
        button("Toggle veto")
        tab("A")
        page("/b/detail")
        button("Toggle veto")
        button("Toggle guard")
        tab("B")
        page("/b/detail")
        button("Toggle guard")
        tab("B")
        page("/b")
        tab("A")
        page("/a/detail")
        tab("A")
        page("/a")
        tab("C")
        page("/c")
        button("Push detail")
        page("/c/detail")
        tab("C")
        page("/c/detail")
        tab("A")
        tab("C")
        page("/c/detail")
        page("reselects:4")
        button("Snapshot")
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "tabs-reselect-complete"
        shot.lifetime = .keepAlways
        add(shot)
    }
}
