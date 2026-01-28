import Cocoa
import SwiftUI
import Combine

// MARK: - NSImage Tinting Extension

extension NSImage {
    func tinted(with color: NSColor) -> NSImage {
        let image = self.copy() as! NSImage
        image.lockFocus()
        color.set()
        let imageRect = NSRect(origin: .zero, size: image.size)
        imageRect.fill(using: .sourceAtop)
        image.unlockFocus()
        return image
    }
}

// MARK: - Constants

private enum MenuConstants {
    static let websiteURL = "https://optamize.biz"
    static let lifeManagerURL = "https://lm.optamize.biz"
    static let accessibilityLabel = "Opta Mini"

    enum StatusIndicator {
        static let running = "●"
        static let launching = "◐"
        static let stopped = "○"
    }

    enum Icons {
        static let ecosystem = "circle.grid.2x2"
        static let ecosystemActive = "circle.grid.2x2.fill"
        static let website = "globe"
        static let copy = "doc.on.doc"
        static let preferences = "gear"
        static let quit = "power"
        static let launch = "play.fill"
        static let stop = "stop.fill"
        static let restart = "arrow.clockwise"
        static let launchAll = "play.circle"
        static let quitAll = "xmark.circle"
    }
}

/// Menu bar icon color options
enum MenuBarIconColor: String, CaseIterable {
    case purple = "purple"     // Default Opta purple
    case blue = "blue"
    case green = "green"
    case orange = "orange"
    case pink = "pink"
    case white = "white"       // System default (template)

    var displayName: String {
        switch self {
        case .purple: return "Purple (Default)"
        case .blue: return "Blue"
        case .green: return "Green"
        case .orange: return "Orange"
        case .pink: return "Pink"
        case .white: return "System Default"
        }
    }

    var color: NSColor {
        switch self {
        case .purple: return NSColor(red: 0.66, green: 0.33, blue: 0.97, alpha: 1.0)  // #A855F7
        case .blue: return NSColor.systemBlue
        case .green: return NSColor.systemGreen
        case .orange: return NSColor.systemOrange
        case .pink: return NSColor.systemPink
        case .white: return NSColor.white
        }
    }

    /// Whether to use template rendering (for system default)
    var isTemplate: Bool {
        return self == .white
    }

    static var current: MenuBarIconColor {
        let rawValue = UserDefaults.standard.string(forKey: "menuBarIconColor") ?? "purple"
        return MenuBarIconColor(rawValue: rawValue) ?? .purple
    }

    static func save(_ color: MenuBarIconColor) {
        UserDefaults.standard.set(color.rawValue, forKey: "menuBarIconColor")
    }
}

// MARK: - AppDelegate

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private var processMonitor: ProcessMonitor?
    private var statusObserver: AnyCancellable?
    private var globalHotkeyMonitor: Any?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Set default preferences on first launch
        registerDefaults()

        processMonitor = ProcessMonitor()
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem?.button {
            button.image = NSImage(
                systemSymbolName: MenuConstants.Icons.ecosystem,
                accessibilityDescription: MenuConstants.accessibilityLabel
            )
        }

        rebuildMenu()

        statusObserver = processMonitor?.$appStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.rebuildMenu()
                self?.updateMenuBarIcon()
            }

        updateMenuBarIcon()
        setupGlobalHotkey()
    }

    // MARK: - Global Hotkey

    private func registerDefaults() {
        UserDefaults.standard.register(defaults: [
            "notificationsEnabled": true,
            "menuBarIconColor": MenuBarIconColor.purple.rawValue
        ])
    }

    private func setupGlobalHotkey() {
        // Register ⌥⌘O (Option+Command+O) to open the menu
        globalHotkeyMonitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            // Check for ⌥⌘O
            let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            if flags == [.option, .command] && event.charactersIgnoringModifiers == "o" {
                DispatchQueue.main.async {
                    self?.showMenu()
                }
            }
        }
    }

    private func showMenu() {
        guard let button = statusItem?.button else { return }
        button.performClick(nil)
    }

    // MARK: - Menu Bar Icon

    @MainActor
    private func updateMenuBarIcon() {
        guard let button = statusItem?.button, let monitor = processMonitor else { return }
        let isActive = monitor.runningCount > 0
        let iconColor = MenuBarIconColor.current

        // Always use Opta O symbol
        let symbolName = isActive ? "o.circle.fill" : "o.circle"

        if let image = NSImage(systemSymbolName: symbolName, accessibilityDescription: MenuConstants.accessibilityLabel) {
            if iconColor.isTemplate {
                // Use system template rendering
                image.isTemplate = true
                button.image = image
            } else {
                // Apply custom color
                image.isTemplate = false
                let coloredImage = image.tinted(with: iconColor.color)
                button.image = coloredImage
            }
        }
    }

    // MARK: - Menu Building

    @MainActor
    private func rebuildMenu() {
        let menu = NSMenu()

        addHeaderSection(to: menu)
        menu.addItem(NSMenuItem.separator())
        addAppItems(to: menu)
        menu.addItem(NSMenuItem.separator())
        addStatusSection(to: menu)
        menu.addItem(NSMenuItem.separator())
        addWebsiteSection(to: menu)
        menu.addItem(NSMenuItem.separator())
        addFooterSection(to: menu)

        statusItem?.menu = menu
    }

    @MainActor
    private func addHeaderSection(to menu: NSMenu) {
        let headerItem = NSMenuItem()
        headerItem.title = "Opta Ecosystem"
        headerItem.isEnabled = false

        if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
            headerItem.title = "Opta Ecosystem v\(version)"
        }

        menu.addItem(headerItem)
    }

    @MainActor
    private func addAppItems(to menu: NSMenu) {
        guard let monitor = processMonitor else { return }

        for app in OptaApp.allApps {
            let status = monitor.status(app)

            let item = NSMenuItem()
            item.attributedTitle = createAppTitle(name: app.name, status: status)
            item.representedObject = app
            item.image = NSImage(systemSymbolName: app.icon, accessibilityDescription: app.name)
            item.submenu = buildAppSubmenu(for: app, status: status)

            menu.addItem(item)
        }
    }

    /// Creates an attributed title with a colored status indicator
    private func createAppTitle(name: String, status: AppStatus) -> NSAttributedString {
        let statusDot: String
        let statusColor: NSColor

        switch status {
        case .running:
            statusDot = MenuConstants.StatusIndicator.running
            statusColor = .systemGreen
        case .launching:
            statusDot = MenuConstants.StatusIndicator.launching
            statusColor = .systemOrange
        case .stopped:
            statusDot = MenuConstants.StatusIndicator.stopped
            statusColor = .systemGray
        }

        let attributedString = NSMutableAttributedString()

        // Colored status dot
        let dotAttributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: statusColor,
            .font: NSFont.systemFont(ofSize: 12)
        ]
        attributedString.append(NSAttributedString(string: statusDot, attributes: dotAttributes))

        // Spacing
        attributedString.append(NSAttributedString(string: "  "))

        // App name (default color)
        let nameAttributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 13)
        ]
        attributedString.append(NSAttributedString(string: name, attributes: nameAttributes))

        return attributedString
    }

    @MainActor
    private func buildAppSubmenu(for app: OptaApp, status: AppStatus) -> NSMenu {
        let submenu = NSMenu()

        switch status {
        case .running:
            // Show uptime at the top
            if let uptime = processMonitor?.formattedUptime(for: app) {
                let uptimeItem = NSMenuItem()
                uptimeItem.title = "Running for \(uptime)"
                uptimeItem.isEnabled = false
                uptimeItem.image = NSImage(systemSymbolName: "clock", accessibilityDescription: "Uptime")
                submenu.addItem(uptimeItem)
                submenu.addItem(NSMenuItem.separator())
            }

            let stopItem = NSMenuItem(title: "Stop", action: #selector(stopApp(_:)), keyEquivalent: "")
            stopItem.target = self
            stopItem.representedObject = app
            stopItem.image = NSImage(systemSymbolName: MenuConstants.Icons.stop, accessibilityDescription: "Stop")
            submenu.addItem(stopItem)

            let restartItem = NSMenuItem(title: "Restart", action: #selector(restartApp(_:)), keyEquivalent: "")
            restartItem.target = self
            restartItem.representedObject = app
            restartItem.image = NSImage(systemSymbolName: MenuConstants.Icons.restart, accessibilityDescription: "Restart")
            submenu.addItem(restartItem)

        case .launching:
            let launchingItem = NSMenuItem(title: "Launching...", action: nil, keyEquivalent: "")
            launchingItem.isEnabled = false
            launchingItem.image = NSImage(systemSymbolName: "hourglass", accessibilityDescription: "Launching")
            submenu.addItem(launchingItem)

            let cancelItem = NSMenuItem(title: "Cancel", action: #selector(stopApp(_:)), keyEquivalent: "")
            cancelItem.target = self
            cancelItem.representedObject = app
            cancelItem.image = NSImage(systemSymbolName: "xmark.circle", accessibilityDescription: "Cancel")
            submenu.addItem(cancelItem)

        case .stopped:
            let launchItem = NSMenuItem(title: "Launch", action: #selector(launchApp(_:)), keyEquivalent: "")
            launchItem.target = self
            launchItem.representedObject = app
            launchItem.image = NSImage(systemSymbolName: MenuConstants.Icons.launch, accessibilityDescription: "Launch")
            submenu.addItem(launchItem)
        }

        // Add "Open in Browser" for Opta LM (Life Manager has web dashboard)
        if app.id == "com.opta.life-manager" {
            submenu.addItem(NSMenuItem.separator())
            let openBrowserItem = NSMenuItem(title: "Open in Browser", action: #selector(openLifeManager), keyEquivalent: "")
            openBrowserItem.target = self
            openBrowserItem.image = NSImage(systemSymbolName: MenuConstants.Icons.website, accessibilityDescription: "Open in Browser")
            submenu.addItem(openBrowserItem)
        }

        return submenu
    }

    @MainActor
    private func addStatusSection(to menu: NSMenu) {
        guard let monitor = processMonitor else { return }

        let runningCount = monitor.runningCount
        let totalCount = OptaApp.allApps.count

        let countItem = NSMenuItem()
        countItem.title = "\(runningCount) of \(totalCount) running"
        countItem.isEnabled = false
        menu.addItem(countItem)

        // Launch All (when not all apps are running)
        if runningCount < totalCount {
            let launchAllItem = NSMenuItem(
                title: "Launch All Opta Apps",
                action: #selector(launchAllApps),
                keyEquivalent: "L"
            )
            launchAllItem.keyEquivalentModifierMask = [.command, .shift]
            launchAllItem.target = self
            launchAllItem.image = NSImage(systemSymbolName: MenuConstants.Icons.launchAll, accessibilityDescription: "Launch All")
            menu.addItem(launchAllItem)
        }

        // Quit All (when apps are running)
        if runningCount > 0 {
            let quitAllItem = NSMenuItem(
                title: "Quit All Opta Apps",
                action: #selector(quitAllApps),
                keyEquivalent: "Q"
            )
            quitAllItem.keyEquivalentModifierMask = [.command, .shift]
            quitAllItem.target = self
            quitAllItem.image = NSImage(systemSymbolName: MenuConstants.Icons.quitAll, accessibilityDescription: "Quit All")
            menu.addItem(quitAllItem)
        }
    }

    @MainActor
    private func addWebsiteSection(to menu: NSMenu) {
        let websiteItem = NSMenuItem(
            title: "Open Optamize Website",
            action: #selector(openWebsite),
            keyEquivalent: "o"
        )
        websiteItem.keyEquivalentModifierMask = [.command, .shift]
        websiteItem.target = self
        websiteItem.image = NSImage(systemSymbolName: MenuConstants.Icons.website, accessibilityDescription: "Website")
        menu.addItem(websiteItem)

        let copyLinkItem = NSMenuItem(
            title: "Copy Website Link",
            action: #selector(copyWebsiteLink),
            keyEquivalent: "c"
        )
        copyLinkItem.keyEquivalentModifierMask = [.command, .shift]
        copyLinkItem.target = self
        copyLinkItem.image = NSImage(systemSymbolName: MenuConstants.Icons.copy, accessibilityDescription: "Copy")
        menu.addItem(copyLinkItem)
    }

    @MainActor
    private func addFooterSection(to menu: NSMenu) {
        // Icon Color Submenu
        let iconColorItem = NSMenuItem(title: "Icon Color", action: nil, keyEquivalent: "")
        iconColorItem.image = NSImage(systemSymbolName: "paintbrush", accessibilityDescription: "Icon Color")
        iconColorItem.submenu = buildIconColorSubmenu()
        menu.addItem(iconColorItem)

        // Notifications Toggle
        let notificationsEnabled = UserDefaults.standard.bool(forKey: "notificationsEnabled")
        let notifyItem = NSMenuItem(
            title: "Notifications",
            action: #selector(toggleNotifications),
            keyEquivalent: ""
        )
        notifyItem.target = self
        notifyItem.state = notificationsEnabled ? .on : .off
        notifyItem.image = NSImage(systemSymbolName: "bell", accessibilityDescription: "Notifications")
        menu.addItem(notifyItem)

        menu.addItem(NSMenuItem.separator())

        let restartItem = NSMenuItem(
            title: "Restart Opta Mini",
            action: #selector(restartOptaMini),
            keyEquivalent: "r"
        )
        restartItem.keyEquivalentModifierMask = [.command, .shift]
        restartItem.target = self
        restartItem.image = NSImage(systemSymbolName: MenuConstants.Icons.restart, accessibilityDescription: "Restart")
        menu.addItem(restartItem)

        let quitItem = NSMenuItem(
            title: "Quit Opta Mini",
            action: #selector(quitApp),
            keyEquivalent: "q"
        )
        quitItem.target = self
        quitItem.image = NSImage(systemSymbolName: MenuConstants.Icons.quit, accessibilityDescription: "Quit")
        menu.addItem(quitItem)
    }

    // MARK: - App Actions

    @objc private func launchApp(_ sender: NSMenuItem) {
        guard let app = sender.representedObject as? OptaApp else { return }
        Task { @MainActor in
            processMonitor?.launch(app)
        }
    }

    @objc private func stopApp(_ sender: NSMenuItem) {
        guard let app = sender.representedObject as? OptaApp else { return }
        Task { @MainActor in
            processMonitor?.stop(app)
        }
    }

    @objc private func restartApp(_ sender: NSMenuItem) {
        guard let app = sender.representedObject as? OptaApp else { return }
        Task { @MainActor in
            processMonitor?.restart(app)
        }
    }

    @objc private func launchAllApps() {
        Task { @MainActor in
            processMonitor?.launchAll()
        }
    }

    @objc private func quitAllApps() {
        Task { @MainActor in
            processMonitor?.stopAll()
        }
    }

    // MARK: - Icon Color

    @MainActor
    private func buildIconColorSubmenu() -> NSMenu {
        let submenu = NSMenu()
        let currentColor = MenuBarIconColor.current

        for color in MenuBarIconColor.allCases {
            let item = NSMenuItem(
                title: color.displayName,
                action: #selector(changeIconColor(_:)),
                keyEquivalent: ""
            )
            item.target = self
            item.representedObject = color
            item.state = (color == currentColor) ? .on : .off

            // Create a colored circle indicator for each option
            if let circleImage = NSImage(systemSymbolName: "circle.fill", accessibilityDescription: color.displayName) {
                if color.isTemplate {
                    circleImage.isTemplate = true
                } else {
                    circleImage.isTemplate = false
                    let tintedImage = circleImage.tinted(with: color.color)
                    item.image = tintedImage
                }
                if color.isTemplate {
                    item.image = circleImage
                }
            }

            submenu.addItem(item)
        }

        return submenu
    }

    @MainActor
    @objc private func changeIconColor(_ sender: NSMenuItem) {
        guard let color = sender.representedObject as? MenuBarIconColor else { return }
        MenuBarIconColor.save(color)
        updateMenuBarIcon()
        rebuildMenu()
    }

    @MainActor
    @objc private func toggleNotifications() {
        let current = UserDefaults.standard.bool(forKey: "notificationsEnabled")
        UserDefaults.standard.set(!current, forKey: "notificationsEnabled")
        rebuildMenu()
    }

    // MARK: - Utility Actions

    @objc private func openPreferences() {
        // Activate the app first (required for menu bar apps)
        NSApp.activate(ignoringOtherApps: true)

        // Use the correct selector for SwiftUI Settings scene (macOS 13+)
        if #available(macOS 13.0, *) {
            NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
        } else {
            NSApp.sendAction(Selector(("showPreferencesWindow:")), to: nil, from: nil)
        }
    }

    @objc private func openWebsite() {
        guard let url = URL(string: MenuConstants.websiteURL) else { return }
        NSWorkspace.shared.open(url)
    }

    @objc private func openLifeManager() {
        guard let url = URL(string: MenuConstants.lifeManagerURL) else { return }
        NSWorkspace.shared.open(url)
    }

    @objc private func copyWebsiteLink() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(MenuConstants.websiteURL, forType: .string)
    }

    @objc private func restartOptaMini() {
        // Get the path to the current app
        let bundlePath = Bundle.main.bundlePath

        // Use a shell command that waits for the app to quit, then relaunches
        // This ensures clean quit before relaunch
        let script = """
        sleep 1
        open "\(bundlePath)"
        """

        let task = Process()
        task.launchPath = "/bin/bash"
        task.arguments = ["-c", script]

        do {
            try task.run()
            // Quit immediately - the bash script will relaunch after we're gone
            NSApplication.shared.terminate(nil)
        } catch {
            print("Failed to restart: \(error)")
        }
    }

    @objc private func quitApp() {
        NSApplication.shared.terminate(nil)
    }
}
