import XCTest

final class BackUITests: XCTestCase {
    func testNativeBackGesture() {
        let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
        app.activate()
        let title = app.staticTexts["native-title"]
        XCTAssertTrue(title.waitForExistence(timeout: 15))
        XCTAssertEqual(title.label, "Native editor system-back")
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.5))
        let finish = app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: finish)
        let restored = NSPredicate(format: "label == %@", "Native editor restore")
        expectation(for: restored, evaluatedWith: title)
        waitForExpectations(timeout: 15)
    }
}
