import XCTest

final class FlowUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launch()
        XCTAssertTrue(app.buttons["pick"].waitForExistence(timeout: 20))
    }

    // A fresh hosted simulator can spend ~40s spawning DocumentManagerUICore
    // before Files exposes its controls. This is service readiness, not a
    // navigation timing budget; every outcome assertion below stays unchanged.
    func testCancelAndGuard() {
        app.buttons["guard"].tap()
        XCTAssertTrue(app.staticTexts["guard:guard"].firstMatch.waitForExistence(timeout: 10))
        app.buttons["pick"].tap()
        let cancel = app.buttons["Cancel"].firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 60), app.debugDescription)
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
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 60))
        let browse = app.tabBars.buttons["Browse"]
        if !browse.isSelected { browse.tap() }
        let completed = app.staticTexts["pick:completed"].firstMatch
        let deadline = Date().addingTimeInterval(40)
        var selections = 0
        // Re-query after every Files transition: tapping an already selected
        // Browse tab can pop its folder, and provider cells load asynchronously.
        while !completed.exists && Date() < deadline {
            let cell = app.cells.matching(NSPredicate(format: "identifier BEGINSWITH %@", "router-flow-external")).firstMatch
            let parent = app.navigationBars.buttons["On My iPhone"].firstMatch
            let locations = app.navigationBars.buttons["Browse"].firstMatch
            let local = app.cells["DOC.sidebar.item.On My iPhone"]
            let open = app.buttons["Open"].firstMatch
            if open.exists && open.isHittable {
                open.tap()
            } else if cell.exists && cell.isHittable {
                if selections == 3 { break }
                cell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)).tap()
                selections += 1
            } else if parent.exists && parent.isHittable {
                parent.tap()
            } else if local.exists && local.isHittable {
                local.tap()
            } else if locations.exists && locations.isHittable {
                locations.tap()
            }
            if completed.waitForExistence(timeout: 1) { break }
        }
        let pickedShot = XCTAttachment(screenshot: app.screenshot())
        pickedShot.name = "document-selection"
        pickedShot.lifetime = .keepAlways
        add(pickedShot)
        XCTAssertTrue(completed.waitForExistence(timeout: 10), app.debugDescription)
    }
    func testConcurrentPresentation() {
        app.buttons["concurrent"].tap()
        let cancel = app.buttons["Cancel"].firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout: 60), app.debugDescription)
        cancel.tap()
        XCTAssertTrue(app.staticTexts["concurrent:refused"].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts["IDLE"].exists)
    }

    func testParentDisposal() {
        app.buttons["dispose"].tap()
        XCTAssertTrue(app.staticTexts["dispose:disposed"].firstMatch.waitForExistence(timeout: 30), app.debugDescription)
        XCTAssertTrue(app.staticTexts["Flow home"].exists)
        let dismissed = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: app.buttons["Cancel"].firstMatch
        )
        XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 10), .completed)
        app.buttons["open"].tap()
        XCTAssertTrue(app.buttons["pick"].waitForExistence(timeout: 10))
        app.buttons["pick"].tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 60))
        app.buttons["Cancel"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["pick:user"].firstMatch.waitForExistence(timeout: 10))
    }

    func testModalOwner() {
        app.buttons["modal"].tap()
        let modalPick = app.buttons.matching(identifier: "pick").allElementsBoundByIndex.last!
        XCTAssertTrue(modalPick.waitForExistence(timeout: 10))
        modalPick.tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 60), app.debugDescription)
        app.buttons["Cancel"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["pick:user"].firstMatch.waitForExistence(timeout: 10))
    }

    func testProcessRestartDropsPromise() {
        app.buttons["pick"].tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 60))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["recovery:orphan"].firstMatch.waitForExistence(timeout: 20), app.debugDescription)
        XCTAssertTrue(app.staticTexts["IDLE"].exists)
        app.buttons["pick"].tap()
        XCTAssertTrue(app.buttons["Cancel"].firstMatch.waitForExistence(timeout: 60))
        app.buttons["Cancel"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["pick:user"].firstMatch.waitForExistence(timeout: 10))
    }
}
