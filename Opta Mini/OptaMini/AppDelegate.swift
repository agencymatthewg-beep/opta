import Cocoa
import SwiftUI
import Combine

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

// MARK: - AppDelegate

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private var processMonitor: ProcessMonitor?
    private var statusObserver: AnyCancellable?

    func applicationDidFinishLaunching(_ notification: Notification) {
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
    }

    // MARK: - Menu Bar Icon

    @MainActor
    private func updateMenuBarIcon() {
        guard let button = statusItem?.button, let monitor = processMonitor else { return }
        let status = monitor.ecosystemStatus
        button.image = NSImage(
            systemSymbolName: status.iconName,
            accessibilityDescription: MenuConstants.accessibilityLabel
        )
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
        let prefsItem = NSMenuItem(
            title: "Preferences...",
            action: #selector(openPreferences),
            keyEquivalent: ","
        )
        prefsItem.target = self
        prefsItem.image = NSImage(systemSymbolName: MenuConstants.Icons.preferences, accessibilityDescription: "Preferences")
        menu.addItem(prefsItem)

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

    // MARK: - Utility Actions

    @objc private func openPreferences() {
        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
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
