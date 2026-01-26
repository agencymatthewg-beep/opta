import Cocoa
import SwiftUI
import Combine

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private var processMonitor: ProcessMonitor?
    private var statusObserver: AnyCancellable?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create the process monitor
        processMonitor = ProcessMonitor()

        // Create the status item in the menu bar
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        // Configure the status item button
        if let button = statusItem?.button {
            button.image = NSImage(systemSymbolName: "circle.grid.2x2", accessibilityDescription: "Opta Mini")
        }

        // Build initial menu
        rebuildMenu()

        // Observe status changes to rebuild menu and update icon
        statusObserver = processMonitor?.$appStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.rebuildMenu()
                self?.updateMenuBarIcon()
            }

        // Update icon based on initial status
        updateMenuBarIcon()
    }

    @MainActor
    private func updateMenuBarIcon() {
        guard let button = statusItem?.button, let monitor = processMonitor else { return }
        let status = monitor.ecosystemStatus
        button.image = NSImage(systemSymbolName: status.iconName, accessibilityDescription: "Opta Mini")
    }

    @MainActor
    private func rebuildMenu() {
        let menu = NSMenu()

        // Header
        let headerItem = NSMenuItem()
        headerItem.title = "Opta Ecosystem"
        headerItem.isEnabled = false
        menu.addItem(headerItem)

        menu.addItem(NSMenuItem.separator())

        // App items
        guard let monitor = processMonitor else { return }

        for app in OptaApp.allApps {
            let isRunning = monitor.isRunning(app)
            let statusDot = isRunning ? "●" : "○"
            let item = NSMenuItem()
            item.title = "\(statusDot)  \(app.name)"
            item.representedObject = app

            // Submenu for app actions
            let submenu = NSMenu()

            if isRunning {
                let stopItem = NSMenuItem(title: "Stop", action: #selector(stopApp(_:)), keyEquivalent: "")
                stopItem.target = self
                stopItem.representedObject = app
                submenu.addItem(stopItem)

                let restartItem = NSMenuItem(title: "Restart", action: #selector(restartApp(_:)), keyEquivalent: "")
                restartItem.target = self
                restartItem.representedObject = app
                submenu.addItem(restartItem)
            } else {
                let launchItem = NSMenuItem(title: "Launch", action: #selector(launchApp(_:)), keyEquivalent: "")
                launchItem.target = self
                launchItem.representedObject = app
                submenu.addItem(launchItem)
            }

            item.submenu = submenu
            menu.addItem(item)
        }

        menu.addItem(NSMenuItem.separator())

        // Running count
        let runningCount = monitor.runningCount
        let countItem = NSMenuItem()
        countItem.title = "\(runningCount) of \(OptaApp.allApps.count) running"
        countItem.isEnabled = false
        menu.addItem(countItem)

        // Quit All (only if apps are running)
        if runningCount > 0 {
            let quitAllItem = NSMenuItem(title: "Quit All Opta Apps", action: #selector(quitAllApps), keyEquivalent: "Q")
            quitAllItem.keyEquivalentModifierMask = [.command, .shift]
            quitAllItem.target = self
            menu.addItem(quitAllItem)
        }

        menu.addItem(NSMenuItem.separator())

        // Website
        let websiteItem = NSMenuItem(title: "Open Optamize Website", action: #selector(openWebsite), keyEquivalent: "")
        websiteItem.target = self
        menu.addItem(websiteItem)

        let copyLinkItem = NSMenuItem(title: "Copy Website Link", action: #selector(copyWebsiteLink), keyEquivalent: "")
        copyLinkItem.target = self
        menu.addItem(copyLinkItem)

        menu.addItem(NSMenuItem.separator())

        // Preferences
        let prefsItem = NSMenuItem(title: "Preferences...", action: #selector(openPreferences), keyEquivalent: ",")
        prefsItem.target = self
        menu.addItem(prefsItem)

        // Quit Opta Mini
        let quitItem = NSMenuItem(title: "Quit Opta Mini", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem?.menu = menu
    }

    // MARK: - Actions

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

    @objc private func quitAllApps() {
        Task { @MainActor in
            processMonitor?.stopAll()
        }
    }

    @objc private func openPreferences() {
        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
    }

    @objc private func openWebsite() {
        if let url = URL(string: "https://optamize.app") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc private func copyWebsiteLink() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString("https://optamize.app", forType: .string)
    }

    @objc private func quitApp() {
        NSApplication.shared.terminate(nil)
    }
}
