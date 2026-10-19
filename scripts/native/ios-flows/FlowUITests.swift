import XCTest

final class FlowUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launch()
        XCTAssertTrue(app.buttons["pick"].waitForExistence(timeout: 20))
    }

    func testCancelAndGuard() {
        app.buttons["guard"].tap()
        XCTAssertTrue(app.staticTexts["guard:guard"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["pick"].tap()
        let cancel = app.buttons["Cancel"].firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 15), app.debugDescription)
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "system-document-picker"
        shot.lifetime = .keepAlways
        add(shot)
        cancel.tap()
        XCTAssertTrue(app.staticTexts["pick:user"].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts["IDLE"].exists)
    }
    func testPickDocument() {
        app.buttons["pick"].tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 15))
        app.tabBars.buttons["Browse"].tap()
        let cell = app.cells.matching(NSPredicate(format: "identifier BEGINSWITH %@", "router-flow-sample")).firstMatch
        // Files can restore the app folder before its asynchronous provider has
        // listed the document. Do not mistake that loading state for Locations.
        let deadline = Date().addingTimeInterval(30)
        var openedLocal = false
        var openedFolder = false
        while !cell.exists && Date() < deadline {
            let local = app.staticTexts["On My iPhone"].firstMatch
            let folder = app.cells.matching(NSPredicate(format: "identifier BEGINSWITH %@", "demo,")).firstMatch
            if !openedFolder && folder.exists && folder.isHittable {
                folder.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)).tap()
                openedFolder = true
            } else if !openedLocal && local.exists && local.isHittable {
                local.tap()
                openedLocal = true
            } else {
                RunLoop.current.run(until: Date().addingTimeInterval(0.25))
            }
        }
        XCTAssertTrue(cell.exists, app.debugDescription)
        cell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)).tap()
        let pickedShot = XCTAttachment(screenshot: app.screenshot())
        pickedShot.name = "document-selection"
        pickedShot.lifetime = .keepAlways
        add(pickedShot)
        let open = app.buttons["Open"].firstMatch
        if open.waitForExistence(timeout: 2) { open.tap() }
        XCTAssertTrue(app.staticTexts["pick:completed"].firstMatch.waitForExistence(timeout: 15), app.debugDescription)
    }
    func testConcurrentPresentation() {
        app.buttons["concurrent"].tap()
        let cancel = app.buttons["Cancel"].firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 15), app.debugDescription)
        cancel.tap()
        XCTAssertTrue(app.staticTexts["concurrent:refused"].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts["IDLE"].exists)
    }

    func testParentDisposal() {
        app.buttons["dispose"].tap()
        XCTAssertTrue(app.staticTexts["dispose:disposed"].firstMatch.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(app.staticTexts["Flow home"].exists)
        XCTAssertFalse(app.buttons["Cancel"].exists)
        app.buttons["open"].tap()
        XCTAssertTrue(app.buttons["pick"].waitForExistence(timeout: 10))
        app.buttons["pick"].tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 15))
        app.buttons["Cancel"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["pick:user"].firstMatch.waitForExistence(timeout: 10))
    }

    func testModalOwner() {
        app.buttons["modal"].tap()
        let modalPick = app.buttons.matching(identifier: "pick").allElementsBoundByIndex.last!
        XCTAssertTrue(modalPick.waitForExistence(timeout: 10))
        modalPick.tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 15), app.debugDescription)
        app.buttons["Cancel"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["pick:user"].firstMatch.waitForExistence(timeout: 10))
    }

    func testProcessRestartDropsPromise() {
        app.buttons["pick"].tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 15))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["recovery:orphan"].firstMatch.waitForExistence(timeout: 20), app.debugDescription)
        XCTAssertTrue(app.staticTexts["IDLE"].exists)
        app.buttons["pick"].tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 15))
        app.buttons["Cancel"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["pick:user"].firstMatch.waitForExistence(timeout: 10))
    }
}
