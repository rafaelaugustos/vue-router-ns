import XCTest

// Simulator-only companion to rotation.mjs. Direct file reads avoid XCTest's
// implicit app-idle wait before the orientation request. No app queries are made
// between observing the native navigation coordinator and changing orientation.
final class RotationUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    var directory: URL!
    var overlap = false
    override func setUpWithError() throws {
        continueAfterFailure = false
        let udid = ProcessInfo.processInfo.environment["SIMULATOR_UDID"]!
        let configURL = URL(fileURLWithPath: "/tmp/router-rotation-\(udid).json")
        let config = try JSONSerialization.jsonObject(with: Data(contentsOf: configURL)) as! [String: String]
        directory = URL(fileURLWithPath: config["directory"]!)
        overlap = config["mode"] == "overlap"
        app.activate()
    }
    // Rotation can restore a reduced compatibility window after an earlier
    // setup. Establish the baseline after the case's orientation/preparation,
    // before arming navigation; never repair or retry an active gesture.
    func prepareWindow(_ label: String) throws {
        // Accessibility can briefly report the preceding orientation (including
        // a negative origin). Wait for usable geometry before deciding to Zoom.
        let settledGeometry = NSPredicate { _, _ in
            let window = self.app.windows.firstMatch.frame
            let screen = self.app.frame
            if window == screen { return true }
            if #available(iOS 26.0, *) {
                return window.width > 0 && window.height > 0 && screen.contains(window)
                    && window.width < screen.width && window.height < screen.height
            }
            return false
        }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: settledGeometry, object: nil)],
                                     timeout: 5), .completed, "Window geometry did not settle before setup")
        let before = app.windows.firstMatch.frame
        let maximized = before != app.frame
        if maximized {
            let system = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            system.buttons["window-controls:org.nativescript.vuerouterns"].tap()
            system.buttons["Zoom-button"].tap()
            let fullWindow = NSPredicate { _, _ in self.app.windows.firstMatch.frame == self.app.frame }
            XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: fullWindow, object: nil)],
                                         timeout: 5), .completed, "Zoom did not restore the full window")
        }
        let after = app.windows.firstMatch.frame
        let screen = app.frame
        var checks = (try? read("window-setup.json"))?["checks"] as? [[String: Any]] ?? []
        checks.append(["case": label, "before": rectangle(before),
            "after": rectangle(after), "screen": rectangle(screen),
            "maximized": maximized, "preparedAt": (Date().timeIntervalSince1970 * 1000).rounded(.down)])
        try write("window-setup.json", ["checks": checks])
        XCTAssertEqual(after, screen, "This case requires a full-size application window")
    }
    func rectangle(_ value: CGRect) -> [String: CGFloat] {
        ["x": value.minX, "y": value.minY, "width": value.width, "height": value.height]
    }
    func read(_ name: String) throws -> [String: Any] {
        try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appendingPathComponent(name))) as! [String: Any]
    }
    func write(_ name: String, _ value: [String: Any]) throws {
        try JSONSerialization.data(withJSONObject: value).write(to: directory.appendingPathComponent(name), options: .atomic)
    }
    @discardableResult
    func command(_ action: String, _ value: Any? = nil, wait: Bool = true) throws -> [String: Any] {
        let id = UUID().uuidString
        var payload: [String: Any] = ["id": id, "action": action]
        if let value = value { payload["value"] = value }
        try write("command.json", payload)
        if !wait { return [:] }
        let deadline = Date().addingTimeInterval(15)
        while Date() < deadline {
            if let result = try? read("result.json"), result["id"] as? String == id {
                XCTAssertNil(result["error"], "\(result)")
                return result
            }
            Thread.sleep(forTimeInterval: 0.01)
        }
        XCTFail("Bridge command timed out: \(action)")
        return [:]
    }
    @discardableResult
    func arm(_ operation: String, landscape: Bool) throws -> [String: Any] {
        try? FileManager.default.removeItem(at: directory.appendingPathComponent("rotation.json"))
        try command("rotation", ["operation": operation, "landscape": landscape], wait: false)
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            if let value = try? read("rotation.json"), value["operation"] as? String == operation {
                let events = value["events"] as? [[String: Any]] ?? []
                if !operation.hasPrefix("gesture") || events.contains(where: { $0["kind"] as? String == "gesture-recognizer" }) {
                    return value
                }
            }
            Thread.sleep(forTimeInterval: 0.005)
        }
        XCTFail("Rotation observer was not armed")
        return [:]
    }
    func waitObserved(_ kind: String = "navigation-observed") throws {
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            if let report = try? read("rotation.json"), let events = report["events"] as? [[String: Any]],
               events.contains(where: { $0["kind"] as? String == kind }) { return }
            Thread.sleep(forTimeInterval: 0.005)
        }
        throw NSError(domain: "RotationFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Native signal missing: \(kind)"])
    }
    func requestRotation(_ label: String, landscape: Bool) throws {
        var driver = (try? read("\(label)-driver.json")) ?? [:]
        let events = try XCTUnwrap(try read("rotation.json")["events"] as? [[String: Any]])
        driver["interactionEndedBeforeRequest"] = events.contains { $0["kind"] as? String == "interaction-ended" }
        driver["navigationObservedBeforeRequest"] = events.contains { $0["kind"] as? String == "navigation-observed" }
        driver["requestPhase"] = label.contains("-overlap-") ? "admission" : "observed"
        driver["requestedAt"] = Date().timeIntervalSince1970 * 1000
        try write("\(label)-driver.json", driver)
        XCUIDevice.shared.orientation = landscape ? .landscapeLeft : .portrait
    }
    @discardableResult
    func finish(_ label: String, navigation: Bool = true) throws -> [String: Any] {
        let deadline = Date().addingTimeInterval(22)
        while Date() < deadline {
            if let value = try? read("rotation.json"), value["finished"] as? Bool == true { break }
            Thread.sleep(forTimeInterval: 0.02)
        }
        let report = try read("rotation.json")
        try write("\(label).json", report)
        XCTAssertEqual(report["finished"] as? Bool, true)
        XCTAssertNil(report["error"], "\(report)")
        let events = report["events"] as! [[String: Any]]
        XCTAssertTrue(events.contains { $0["kind"] as? String == "rotation-began" })
        if navigation {
            let begin = try XCTUnwrap(events.first { $0["kind"] as? String == "navigation-observed" })
            let end = try XCTUnwrap(events.first { $0["kind"] as? String == "navigation-ended" })
            let request = try read("\(label)-driver.json")["requestedAt"] as! Double
            // The overlap suite dispatches both requests near admission. Its
            // acceptance requires the native navigation coordinator to be current
            // when rotation actually begins; the original device suite still
            // requires the orientation request itself to follow observation.
            if !label.contains("-overlap-") {
                XCTAssertGreaterThanOrEqual(request, begin["wallTime"] as! Double)
            }
            XCTAssertLessThan(request, end["wallTime"] as! Double, "Orientation request happened after navigation ended")
            XCTAssertEqual(events.filter { $0["kind"] as? String == "navigation-ended" }.count, 1)
        }
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = label
        shot.lifetime = .keepAlways
        add(shot)
        return report
    }
    func test01ProgrammaticNavigation() throws {
        for landscape in [true, false] {
            XCUIDevice.shared.orientation = landscape ? .portrait : .landscapeLeft
            let source = overlap ? "overlap" : "device"
            for operation in ["push-\(source)", "back-\(source)"] {
                let target = operation.hasPrefix("push") ? landscape : !landscape
                let label = "\(operation)-\(target ? "landscape" : "portrait")"
                try prepareWindow(label)
                try arm(operation, landscape: target)
                if !overlap { try waitObserved() }
                try requestRotation(label, landscape: target)
                try finish(label)
            }
        }
    }
    func gesture(_ fraction: CGFloat, name: String) throws {
        for landscape in [true, false] {
            XCUIDevice.shared.orientation = landscape ? .portrait : .landscapeLeft
            try command("push", "home")
            let label = "\(name)-\(landscape ? "landscape" : "portrait")"
            try prepareWindow(label)
            let applicationFrame = app.frame
            let windowFrame = app.windows.firstMatch.frame
            XCTAssertEqual(windowFrame, applicationFrame, "Content Back requires the full-window test precondition")
            let armed = try arm("gesture-device", landscape: landscape)
            let events = try XCTUnwrap(armed["events"] as? [[String: Any]])
            let recognizer = try XCTUnwrap(events.first { $0["kind"] as? String == "gesture-recognizer" })
            XCTAssertEqual(recognizer["enabled"] as? Bool, true)
            let bounds = CGRect(
                x: try XCTUnwrap(recognizer["x"] as? Double),
                y: try XCTUnwrap(recognizer["y"] as? Double),
                width: try XCTUnwrap(recognizer["width"] as? Double),
                height: try XCTUnwrap(recognizer["height"] as? Double))
            XCTAssertGreaterThan(bounds.width, 0)
            XCTAssertGreaterThan(bounds.height, 0)
            // A text field's accessibility frame can still reflect the preceding
            // push/rotation animation. Start at the actual recognizer's edge,
            // reported by UIKit in screen coordinates, not at a child-view inset.
            let point = CGPoint(x: bounds.minX + 2, y: bounds.midY)
            XCTAssertTrue(applicationFrame.contains(point), "Native gesture edge must be inside the application")
            let offset = CGVector(dx: point.x - applicationFrame.minX, dy: point.y - applicationFrame.minY)
            let distance = bounds.width * fraction
            let start = app.coordinate(withNormalizedOffset: .zero).withOffset(offset)
            let end = start.withOffset(CGVector(dx: distance, dy: 0))
            // A long pointer-down drag can cancel or reverse the orientation
            // transition. In both commit directions, wait for UIKit's interaction
            // decision, then rotate while its navigation animation is unfinished.
            let signal = name == "commit" ? "interaction-ended" : "navigation-observed"
            try write("\(label)-driver.json", [
                "rotationSignal": signal,
                "windowFrame": rectangle(windowFrame),
                "recognizer": recognizer,
                "start": ["x": point.x, "y": point.y],
                "end": ["x": point.x + distance, "y": point.y],
            ])
            // Read native lifecycle signals without an app-idle query. finish()
            // still rejects requests made after the navigation animation ends.
            let rotated = expectation(description: label)
            DispatchQueue.global().async {
                do {
                    try self.waitObserved(signal)
                    DispatchQueue.main.async {
                        defer { rotated.fulfill() }
                        do { try self.requestRotation(label, landscape: landscape) }
                        catch { XCTFail("\(error)") }
                    }
                } catch {
                    DispatchQueue.main.async {
                        defer { rotated.fulfill() }
                        if landscape { XCTFail("\(error)"); return }
                        do {
                            try self.command("finishUnobservedGesture")
                        } catch { XCTFail("\(error)") }
                    }
                }
            }
            start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.3)
            wait(for: [rotated], timeout: 15)
            if let missing = try? read("rotation.json"), missing["notReproduced"] != nil {
                try write("\(label).json", missing)
                try command("back")
                continue
            }
            let report = try finish(label)
            let finishedEvents = report["events"] as! [[String: Any]]
            let began = try XCTUnwrap(finishedEvents.first { $0["kind"] as? String == "navigation-observed" })
            XCTAssertEqual(began["interactive"] as? Bool, true)
            let ended = try XCTUnwrap(finishedEvents.first { $0["kind"] as? String == "navigation-ended" })
            if ended["cancelled"] as? Bool == true { try command("back") }
        }
    }
    func test02IntendedCommit() throws { try gesture(0.8, name: "commit") }
    func test03IntendedCancel() throws { try gesture(0.12, name: "cancel") }
    func test04SettledAndModalControl() throws {
        XCUIDevice.shared.orientation = .portrait
        try prepareWindow("settled")
        try arm("settled", landscape: true)
        // Wait for the bridge to install its observer, with no navigation running.
        _ = try command("snapshot")
        try requestRotation("settled", landscape: true)
        try finish("settled", navigation: false)
        try command("modal")
        try prepareWindow("modal")
        try arm("settled", landscape: false)
        _ = try command("snapshot")
        try requestRotation("modal", landscape: false)
        let report = try finish("modal", navigation: false)
        let after = report["after"] as! [String: Any]
        XCTAssertEqual(after["result"] as? String, "pending")
        let result = try command("back")
        XCTAssertEqual(result["result"] as? String, "accepted")
    }
}
