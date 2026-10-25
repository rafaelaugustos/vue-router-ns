import XCTest
final class ConsumerUITests: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "org.nativescript.routerrc3validation")
 func tap(_ title: String) { let b=app.buttons[title].firstMatch;XCTAssertTrue(b.waitForExistence(timeout:15),app.debugDescription);b.tap() }
 func label(_ title:String) { XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout:15),app.debugDescription) }
 func changeDraft() -> String {
  let editor=app.textViews["Note draft"].firstMatch
  XCTAssertTrue(editor.waitForExistence(timeout:10))
  editor.coordinate(withNormalizedOffset:CGVector(dx:0.2,dy:0.2)).tap()
  XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout:10))
  let key=app.keys["A"].exists ? app.keys["A"] : app.keys["a"]
  key.tap()
  tap("Hide keyboard")
  label("Unsaved changes")
  return editor.value as! String
 }
 func testFirstAppFlow() { flow(interactive: true) }
 func testSystemPreferences() { flow(interactive: false) }
 func flow(interactive: Bool) {
  continueAfterFailure=false
  app.launch()
  label("Published rc.3 · consumer acceptance")
  let search=app.textFields["Find a note"].firstMatch
  XCTAssertTrue(search.waitForExistence(timeout:10))
  search.tap();search.typeText("coast\n")
  XCTAssertFalse(app.buttons["Into the forest"].exists)
  tap("Along the coast")
  label("A quiet path beside the sea.")
  tap("Edit in a modal")
  let saved=changeDraft()
  tap("Cancel");tap("Keep editing")
  XCTAssertEqual(app.textViews["Note draft"].value as? String,saved)
  tap("Save note");label(saved)
  if interactive {
  let cancelled = expectation(description: "Reverse interactive Back")
  ContractTouch.cancel(in: app.frame) { error in XCTAssertNil(error); cancelled.fulfill() }
  wait(for: [cancelled], timeout: 10)
  label(saved)
  app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.65))
    .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.65)), withVelocity: .slow, thenHoldForDuration: 0)
  } else { app.navigationBars.buttons.element(boundBy:0).tap() }
  XCTAssertTrue(search.waitForExistence(timeout:10))
  XCTAssertEqual(search.value as? String,"coast")
  XCTAssertFalse(app.buttons["Into the forest"].exists)
  tap("Along the coast");tap("Edit in a modal")
  _=changeDraft();tap("Cancel");tap("Discard")
  label(saved)
  let shot=XCTAttachment(screenshot:app.screenshot());shot.name="saved-result-after-discard";shot.lifetime = .keepAlways;add(shot)
 }
}
