import XCTest

// Simulator-only companion to rotation.mjs. Direct file reads avoid XCTest's
// implicit app-idle wait before the orientation request. No app queries are made
// between observing the native navigation coordinator and changing orientation.
final class RotationUITests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.vuerouterns")
    var directory: URL!
    override func setUpWithError() throws {
        continueAfterFailure = false
        let udid = ProcessInfo.processInfo.environment["SIMULATOR_UDID"]!
        let configURL = URL(fileURLWithPath: "/tmp/router-rotation-\(udid).json")
        let config = try JSONSerialization.jsonObject(with: Data(contentsOf: configURL)) as! [String: String]
        directory = URL(fileURLWithPath: config["directory"]!)
        app.activate()
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
    func arm(_ operation: String, landscape: Bool) throws {
        try? FileManager.default.removeItem(at: directory.appendingPathComponent("rotation.json"))
        try command("rotation", ["operation": operation, "landscape": landscape], wait: false)
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            if let value = try? read("rotation.json"), value["operation"] as? String == operation { return }
            Thread.sleep(forTimeInterval: 0.005)
        }
        XCTFail("Rotation observer was not armed")
    }
    func waitObserved() throws {
        let deadline = Date().addingTimeInterval(5)
        while Date() < deadline {
            if let report = try? read("rotation.json"), let events = report["events"] as? [[String: Any]],
               events.contains(where: { $0["kind"] as? String == "navigation-observed" }) { return }
            Thread.sleep(forTimeInterval: 0.005)
        }
        throw NSError(domain: "RotationFixture", code: 1, userInfo: [NSLocalizedDescriptionKey: "No active native navigation observed"])
    }
    func requestRotation(_ label: String, landscape: Bool) throws {
        try write("\(label)-driver.json", ["requestedAt": Date().timeIntervalSince1970 * 1000])
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
            XCTAssertGreaterThanOrEqual(request, begin["wallTime"] as! Double)
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
            for operation in ["push-device", "back-device"] {
                let target = operation == "push-device" ? landscape : !landscape
                let label = "\(operation)-\(target ? "landscape" : "portrait")"
                try arm(operation, landscape: target)
                try waitObserved()
                try requestRotation(label, landscape: target)
                try finish(label)
            }
        }
    }
    func gesture(_ fraction: CGFloat, name: String) throws {
        for landscape in [true, false] {
            XCUIDevice.shared.orientation = landscape ? .portrait : .landscapeLeft
            try command("push", "home")
            let content = app.textFields["Retained draft"].firstMatch.frame
            let start = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: content.minX - 14, dy: content.midY + 120))
            let end = start.withOffset(CGVector(dx: content.width * fraction, dy: 0))
            let label = "\(name)-\(landscape ? "landscape" : "portrait")"
            try arm("gesture-device", landscape: landscape)
            // Two real device actions overlap: the pointer stays down while the
            // background driver waits for UIKit's interactive coordinator.
            let rotated = expectation(description: label)
            DispatchQueue.global().async {
                do {
                    try self.waitObserved()
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
            let events = report["events"] as! [[String: Any]]
            let began = try XCTUnwrap(events.first { $0["kind"] as? String == "navigation-observed" })
            XCTAssertEqual(began["interactive"] as? Bool, true)
            let ended = try XCTUnwrap(events.first { $0["kind"] as? String == "navigation-ended" })
            if ended["cancelled"] as? Bool == true { try command("back") }
        }
    }
    func test02IntendedCommit() throws { try gesture(0.8, name: "commit") }
    func test03IntendedCancel() throws { try gesture(0.12, name: "cancel") }
    func test04SettledAndModalControl() throws {
        XCUIDevice.shared.orientation = .portrait
        try arm("settled", landscape: true)
        // Wait for the bridge to install its observer, with no navigation running.
        _ = try command("snapshot")
        try requestRotation("settled", landscape: true)
        try finish("settled", navigation: false)
        try command("modal")
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
