import Cocoa
import SwiftUI
import Combine

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private var popover: NSPopover?
    private var processMonitor: ProcessMonitor?
    private var statusObserver: AnyCancellable?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create the process monitor
        processMonitor = ProcessMonitor()

        // Create the status item in the menu bar
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        // Configure the status item button
        if let button = statusItem?.button {
            button.action = #selector(togglePopover)
            button.target = self
        }

        // Update icon based on initial status
        updateMenuBarIcon()

        // Observe status changes to update icon
        statusObserver = processMonitor?.$appStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.updateMenuBarIcon()
            }

        // Create and configure the popover
        popover = NSPopover()
        popover?.contentSize = NSSize(width: 280, height: 300)
        popover?.behavior = .transient
        popover?.contentViewController = NSHostingController(rootView: ContentView(processMonitor: processMonitor!))
    }

    @MainActor
    private func updateMenuBarIcon() {
        guard let button = statusItem?.button, let monitor = processMonitor else { return }
        let status = monitor.ecosystemStatus

        button.image = NSImage(systemSymbolName: status.iconName, accessibilityDescription: "Opta Mini")
    }

    @objc private func togglePopover() {
        guard let popover = popover, let button = statusItem?.button else { return }

        if popover.isShown {
            popover.performClose(nil)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)

            // Ensure the popover window becomes key to receive keyboard events
            popover.contentViewController?.view.window?.makeKey()
        }
    }
}
