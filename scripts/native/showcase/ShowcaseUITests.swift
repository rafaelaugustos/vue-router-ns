import XCTest
final class ShowcaseUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    func tap(_ text: String) {
        let b=app.buttons[text].firstMatch
        XCTAssertTrue(b.waitForExistence(timeout: 15), app.debugDescription)
        b.tap()
    }
    func label(_ text: String) { XCTAssertTrue(app.staticTexts[text].firstMatch.waitForExistence(timeout: 15),app.debugDescription) }
    func capture(_ name: String) { let shot=XCTAttachment(screenshot:app.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot) }
    func testIntegratedNavigationWithNativeKeyboard() {
        continueAfterFailure=false
        app.launch()
        label("Your next small discovery")
        tap("Menu");tap("About destination")
        label("Built on native navigation")
        tap("Return to library")
        label("Your next small discovery")
        tap("Search")
        let search=app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout:10),app.debugDescription)
        search.tap();search.typeText("coast")
        label("Search: coast")
        app.buttons["Open coast"].press(forDuration:1.2)
        tap("Star note")
        label("Starred")
        tap("Open coast")
        label("Hold this note: the same actions are in its native header and menu.")
        tap("Unstar");label("Not starred")
        tap("Review in a modal")
        label("A moment to reflect")
        tap("Mark as reviewed")
        label("Reviewed today");capture("native-modal-result")
        tap("Edit")
        label("Make it yours")
        let editor=app.textViews["Note draft"].firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout:10),app.debugDescription)
        editor.coordinate(withNormalizedOffset:CGVector(dx:0.2,dy:0.15)).tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout:10))
        let key = app.keys["A"].exists ? app.keys["A"] : app.keys["a"]
        key.tap()
        app.navigationBars.buttons.element(boundBy:0).tap()
        tap("Keep editing")
        label("Unsaved changes — leaving asks first.")
        tap("Menu");tap("Library destination")
        tap("Keep editing")
        XCTAssertTrue(app.buttons["Library destination"].exists,app.debugDescription)
        app.coordinate(withNormalizedOffset:CGVector(dx:0.92,dy:0.55)).tap()
        tap("Save")
        label("Reviewed today")
        capture("retained-detail-and-saved-draft")
        app.navigationBars.buttons.element(boundBy:0).tap()
        label("Search: coast")
        XCTAssertFalse(app.buttons["Open forest"].exists)
        capture("retained-search-and-page")
    }
}
