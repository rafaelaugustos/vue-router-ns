import UIKit

@main final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window!.rootViewController = Container()
        window!.makeKeyAndVisible()
        return true
    }
}

final class Container: UIViewController {
    let nav = UINavigationController(rootViewController: Screen())
    var retainedDelegate: UINavigationControllerDelegate?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBlue
        let args = ProcessInfo.processInfo.arguments
        if args.contains("did-show") { retainedDelegate = DidShowDelegate() }
        if args.contains("animation") { retainedDelegate = AnimationDelegate() }
        if args.contains("interaction") { retainedDelegate = InteractionDelegate() }
        if args.contains("both") { retainedDelegate = BothDelegate() }
        let label = UILabel(frame: CGRect(x: 16, y: 32, width: 1100, height: 40))
        let mode = ["none", "did-show", "animation", "interaction", "both"].first(where: { args.contains($0) }) ?? "none"
        label.text = "UIKit: \(mode) / \(args.contains("full-width") ? "full width" : "inset content")"
        label.textColor = .white
        label.font = .systemFont(ofSize: 24)
        view.addSubview(label)
        nav.delegate = retainedDelegate
        addChild(nav)
        view.addSubview(nav.view)
        nav.didMove(toParent: self)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let inset: CGFloat = ProcessInfo.processInfo.arguments.contains("full-width") ? 0 : 280
        nav.view.frame = CGRect(x: inset, y: 100, width: view.bounds.width - inset, height: view.bounds.height - 100)
    }
}

final class Screen: UIViewController {
    let field = UITextField()
    let button = UIButton(type: .system)
    let label = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = navigationController!.viewControllers.count > 1 ? "Detail" : "Root"
        label.text = title
        label.accessibilityIdentifier = "route"
        view.addSubview(label)
        field.placeholder = "Retained draft"
        field.borderStyle = .roundedRect
        view.addSubview(field)
        button.setTitle("Push detail", for: .normal)
        button.addTarget(self, action: #selector(push), for: .touchUpInside)
        view.addSubview(button)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        label.frame = CGRect(x: 16, y: 100, width: 300, height: 40)
        field.frame = CGRect(x: 16, y: 150, width: view.bounds.width - 32, height: 36)
        button.frame = CGRect(x: 16, y: 210, width: view.bounds.width - 32, height: 44)
    }

    @objc func push() { navigationController!.pushViewController(Screen(), animated: true) }
}

class DidShowDelegate: NSObject, UINavigationControllerDelegate {
    func navigationController(_ navigationController: UINavigationController, didShow viewController: UIViewController, animated: Bool) {}
}

class AnimationDelegate: DidShowDelegate {
    func navigationController(_ navigationController: UINavigationController, animationControllerFor operation: UINavigationController.Operation, from fromVC: UIViewController, to toVC: UIViewController) -> UIViewControllerAnimatedTransitioning? { nil }
}

final class InteractionDelegate: DidShowDelegate {
    func navigationController(_ navigationController: UINavigationController, interactionControllerFor animationController: UIViewControllerAnimatedTransitioning) -> UIViewControllerInteractiveTransitioning? { nil }
}

final class BothDelegate: AnimationDelegate {
    func navigationController(_ navigationController: UINavigationController, interactionControllerFor animationController: UIViewControllerAnimatedTransitioning) -> UIViewControllerInteractiveTransitioning? { nil }
}
