import Foundation
import BackgroundTasks

/// Manages background sync operations for all integrations (Calendar, Reminders, Todoist, Health).
/// Uses BGTaskScheduler to schedule periodic sync tasks when the app is in the background.
@MainActor
final class BackgroundSyncManager {
    static let shared = BackgroundSyncManager()

    // Background task identifier (must be registered in Info.plist)
    private let backgroundTaskIdentifier = "com.opta.sync.refresh"

    // Minimum time between syncs (15 minutes)
    private let minimumSyncInterval: TimeInterval = 15 * 60

    // Services
    private var syncFrequency: SyncFrequency = .hourly

    private init() {
        registerBackgroundTasks()
        loadSyncFrequency()
    }

    // MARK: - Background Task Registration

    private func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: backgroundTaskIdentifier,
            using: nil
        ) { task in
            Task {
                await self.handleBackgroundSync(task: task as! BGAppRefreshTask)
            }
        }
    }

    // MARK: - Scheduling

    /// Schedule the next background sync based on user preferences
    func scheduleNextSync() {
        cancelAllPendingTasks()

        guard syncFrequency != .manual else {
            print("⏸️ Background sync disabled (manual mode)")
            return
        }

        let request = BGAppRefreshTaskRequest(identifier: backgroundTaskIdentifier)

        // Calculate earliest begin date based on sync frequency
        if let interval = syncFrequency.interval {
            request.earliestBeginDate = Date().addingTimeInterval(max(interval, minimumSyncInterval))
        } else {
            // Default to 1 hour
            request.earliestBeginDate = Date().addingTimeInterval(60 * 60)
        }

        do {
            try BGTaskScheduler.shared.submit(request)
            print("✅ Background sync scheduled for \(request.earliestBeginDate?.formatted() ?? "unknown")")
        } catch {
            print("❌ Failed to schedule background sync: \(error.localizedDescription)")
        }
    }

    /// Update sync schedule when user changes frequency settings
    func updateSchedule(frequency: SyncFrequency) {
        syncFrequency = frequency
        UserDefaults.standard.set(frequency.rawValue, forKey: "calendarSyncFrequency")
        scheduleNextSync()
    }

    /// Cancel all pending background tasks
    func cancelAllPendingTasks() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: backgroundTaskIdentifier)
        print("🗑️ Cancelled all pending background sync tasks")
    }

    // MARK: - Background Sync Execution

    private func handleBackgroundSync(task: BGAppRefreshTask) async {
        print("🔄 Background sync started at \(Date())")

        // Schedule the next sync before doing work
        scheduleNextSync()

        // Set expiration handler
        task.expirationHandler = {
            print("⏱️ Background sync expired, cancelling...")
            // Any cleanup needed
        }

        do {
            // Perform sync operations
            await performSync()

            // Mark task as completed successfully
            task.setTaskCompleted(success: true)
            print("✅ Background sync completed successfully")

            // Update last sync time
            UserDefaults.standard.set(Date(), forKey: "lastSuccessfulSync")

        } catch {
            // Mark task as failed
            task.setTaskCompleted(success: false)
            print("❌ Background sync failed: \(error.localizedDescription)")

            // Increment error count
            let errorCount = UserDefaults.standard.integer(forKey: "syncErrors")
            UserDefaults.standard.set(errorCount + 1, forKey: "syncErrors")
        }
    }

    private func performSync() async {
        // Check which integrations are enabled
        let calendarEnabled = UserDefaults.standard.bool(forKey: "calendarSyncEnabled")
        let remindersEnabled = UserDefaults.standard.bool(forKey: "remindersSyncEnabled")
        let todoistConnected = UserDefaults.standard.bool(forKey: "todoistConnected")
        let healthEnabled = UserDefaults.standard.bool(forKey: "healthEnabled")

        var syncResults: [String] = []

        // Calendar Sync
        if calendarEnabled {
            do {
                // This would call CalendarSyncService.sync()
                // For now, simulate sync
                try await Task.sleep(nanoseconds: 500_000_000)
                syncResults.append("Calendar: ✅")
                print("📅 Calendar synced")
            } catch {
                syncResults.append("Calendar: ❌")
                print("📅 Calendar sync failed: \(error.localizedDescription)")
            }
        }

        // Reminders Sync
        if remindersEnabled {
            do {
                // This would call RemindersSyncService.sync()
                try await Task.sleep(nanoseconds: 500_000_000)
                syncResults.append("Reminders: ✅")
                print("✅ Reminders synced")
            } catch {
                syncResults.append("Reminders: ❌")
                print("✅ Reminders sync failed: \(error.localizedDescription)")
            }
        }

        // Todoist Sync
        if todoistConnected {
            do {
                // This would call TodoistService.sync()
                try await Task.sleep(nanoseconds: 500_000_000)
                syncResults.append("Todoist: ✅")
                print("✓ Todoist synced")
            } catch {
                syncResults.append("Todoist: ❌")
                print("✓ Todoist sync failed: \(error.localizedDescription)")
            }
        }

        // Health Sync (read-only)
        if healthEnabled {
            do {
                // This would call HealthService.fetchLatestData()
                try await Task.sleep(nanoseconds: 500_000_000)
                syncResults.append("Health: ✅")
                print("❤️ Health data fetched")
            } catch {
                syncResults.append("Health: ❌")
                print("❤️ Health fetch failed: \(error.localizedDescription)")
            }
        }

        print("🔄 Background sync summary: \(syncResults.joined(separator: ", "))")

        // Send notification if user wants to be notified
        if UserDefaults.standard.bool(forKey: "calendarNotifyConflicts") {
            await sendSyncNotification(results: syncResults)
        }
    }

    // MARK: - Notifications

    private func sendSyncNotification(results: [String]) async {
        let successCount = results.filter { $0.contains("✅") }.count
        let failureCount = results.filter { $0.contains("❌") }.count

        guard failureCount > 0 else {
            // Don't send notification for successful syncs (too noisy)
            return
        }

        // This would use NotificationManager to send a notification
        // For now, just log
        print("📬 Would send notification: \(successCount) succeeded, \(failureCount) failed")
    }

    // MARK: - Offline Queue

    /// Process any pending offline changes that couldn't sync earlier
    func processPendingChanges() async {
        print("🔄 Processing offline queue...")

        // This would:
        // 1. Load pending changes from TaskCacheManager
        // 2. Attempt to sync each change
        // 3. Remove successfully synced items from queue
        // 4. Report failures

        // For now, simulate processing
        try? await Task.sleep(nanoseconds: 500_000_000)
        print("✅ Offline queue processed")
    }

    // MARK: - Private Helpers

    private func loadSyncFrequency() {
        if let frequencyRaw = UserDefaults.standard.string(forKey: "calendarSyncFrequency"),
           let frequency = SyncFrequency(rawValue: frequencyRaw) {
            syncFrequency = frequency
        }
    }
}

// MARK: - App Delegate Extension (for info)

/*
 To enable background sync, add to Info.plist:

 <key>BGTaskSchedulerPermittedIdentifiers</key>
 <array>
     <string>com.opta.sync.refresh</string>
 </array>

 <key>UIBackgroundModes</key>
 <array>
     <string>fetch</string>
     <string>processing</string>
 </array>

 Then in App.swift, schedule initial sync:

 @main
 struct OptaLMApp: App {
     init() {
         BackgroundSyncManager.shared.scheduleNextSync()
     }
 }
 */
