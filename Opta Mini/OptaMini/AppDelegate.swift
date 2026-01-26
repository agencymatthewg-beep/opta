import Cocoa
import SwiftUI
import Combine

// MARK: - Constants

private enum MenuConstants {
    static let websiteURL = "https://optamize.app"
    static let accessibilityLabel = "Opta Mini"

    enum StatusIndicator {
        static let running = "●"
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
            let isRunning = monitor.isRunning(app)
            let statusDot = isRunning ? MenuConstants.StatusIndicator.running : MenuConstants.StatusIndicator.stopped

            let item = NSMenuItem()
            item.title = "\(statusDot)  \(app.name)"
            item.representedObject = app
            item.image = NSImage(systemSymbolName: app.icon, accessibilityDescription: app.name)
            item.submenu = buildAppSubmenu(for: app, isRunning: isRunning)

            menu.addItem(item)
        }
    }

    @MainActor
    private func buildAppSubmenu(for app: OptaApp, isRunning: Bool) -> NSMenu {
        let submenu = NSMenu()

        if isRunning {
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
        } else {
            let launchItem = NSMenuItem(title: "Launch", action: #selector(launchApp(_:)), keyEquivalent: "")
            launchItem.target = self
            launchItem.representedObject = app
            launchItem.image = NSImage(systemSymbolName: MenuConstants.Icons.launch, accessibilityDescription: "Launch")
            submenu.addItem(launchItem)
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

    @objc private func copyWebsiteLink() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(MenuConstants.websiteURL, forType: .string)
    }

    @objc private func quitApp() {
        NSApplication.shared.terminate(nil)
    }
}
