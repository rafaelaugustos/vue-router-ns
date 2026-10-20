import UIKit
import UniformTypeIdentifiers

final class PickerPage: UIViewController, UIDocumentPickerDelegate {
    let status = UILabel()
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let pick = UIButton(type: .system)
        pick.setTitle("pick", for: .normal)
        pick.accessibilityIdentifier = "pick"
        pick.addTarget(self, action: #selector(openPicker), for: .touchUpInside)
        pick.frame = CGRect(x: 40, y: 100, width: 180, height: 60)
        status.frame = CGRect(x: 40, y: 180, width: 300, height: 60)
        view.addSubview(pick)
        view.addSubview(status)
        let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("router-flow-sample.txt")
        if !FileManager.default.fileExists(atPath: url.path) {
            try! Data("Native flow acceptance document".utf8).write(to: url)
        }
        print("PROBE_DOCUMENT \(url.path)")
    }
    @objc func openPicker() {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item])
        picker.delegate = self
        present(picker, animated: true)
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        print("PROBE_COMPLETED \(urls)")
        status.text = "pick:completed"
    }
}
final class App: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = PickerPage()
        window?.makeKeyAndVisible()
        return true
    }
}
UIApplicationMain(CommandLine.argc, CommandLine.unsafeArgv, nil, NSStringFromClass(App.self))
