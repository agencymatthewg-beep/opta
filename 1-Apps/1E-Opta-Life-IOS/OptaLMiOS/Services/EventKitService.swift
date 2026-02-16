import Foundation
import EventKit

// MARK: - EventKit Service

/// Low-level EventKit wrapper for Calendar and Reminders access.
/// Handles iOS version compatibility (iOS 17 vs iOS 16) and provides a clean async/await API.
@MainActor
final class EventKitService: ObservableObject {

    // MARK: - Properties

    static let shared = EventKitService()

    let eventStore = EKEventStore()

    @Published var calendarAuthorizationStatus: EKAuthorizationStatus = .notDetermined
    @Published var remindersAuthorizationStatus: EKAuthorizationStatus = .notDetermined

    // MARK: - Initialization

    private init() {
        updateAuthorizationStatuses()
    }

    // MARK: - Authorization Status

    /// Updates the current authorization statuses for calendars and reminders
    private func updateAuthorizationStatuses() {
        if #available(iOS 17.0, *) {
            calendarAuthorizationStatus = EKEventStore.authorizationStatus(for: .event)
            remindersAuthorizationStatus = EKEventStore.authorizationStatus(for: .reminder)
        } else {
            calendarAuthorizationStatus = EKEventStore.authorizationStatus(for: .event)
            remindersAuthorizationStatus = EKEventStore.authorizationStatus(for: .reminder)
        }
    }

    /// Checks if calendar access is authorized
    var isCalendarAuthorized: Bool {
        calendarAuthorizationStatus == .authorized || calendarAuthorizationStatus == .fullAccess
    }

    /// Checks if reminders access is authorized
    var isRemindersAuthorized: Bool {
        remindersAuthorizationStatus == .authorized || remindersAuthorizationStatus == .fullAccess
    }

    // MARK: - Calendar Access

    /// Requests full access to calendar events.
    /// Handles iOS 17's new authorization API vs iOS 16's callback-based API.
    func requestCalendarAccess() async -> Bool {
        if #available(iOS 17.0, *) {
            // iOS 17+ uses new async requestFullAccessToEvents
            do {
                let granted = try await eventStore.requestFullAccessToEvents()
                await MainActor.run {
                    self.calendarAuthorizationStatus = granted ? .fullAccess : .denied
                }
                return granted
            } catch {
                print("[EventKitService] Calendar access request failed: \(error)")
                await MainActor.run {
                    self.calendarAuthorizationStatus = .denied
                }
                return false
            }
        } else {
            // iOS 16 uses callback-based requestAccess
            return await withCheckedContinuation { continuation in
                eventStore.requestAccess(to: .event) { [weak self] granted, error in
                    Task { @MainActor in
                        self?.calendarAuthorizationStatus = granted ? .authorized : .denied
                    }
                    if let error = error {
                        print("[EventKitService] Calendar access request failed: \(error)")
                    }
                    continuation.resume(returning: granted)
                }
            }
        }
    }

    /// Requests full access to reminders.
    /// Handles iOS 17's new authorization API vs iOS 16's callback-based API.
    func requestRemindersAccess() async -> Bool {
        if #available(iOS 17.0, *) {
            // iOS 17+ uses new async requestFullAccessToReminders
            do {
                let granted = try await eventStore.requestFullAccessToReminders()
                await MainActor.run {
                    self.remindersAuthorizationStatus = granted ? .fullAccess : .denied
                }
                return granted
            } catch {
                print("[EventKitService] Reminders access request failed: \(error)")
                await MainActor.run {
                    self.remindersAuthorizationStatus = .denied
                }
                return false
            }
        } else {
            // iOS 16 uses callback-based requestAccess
            return await withCheckedContinuation { continuation in
                eventStore.requestAccess(to: .reminder) { [weak self] granted, error in
                    Task { @MainActor in
                        self?.remindersAuthorizationStatus = granted ? .authorized : .denied
                    }
                    if let error = error {
                        print("[EventKitService] Reminders access request failed: \(error)")
                    }
                    continuation.resume(returning: granted)
                }
            }
        }
    }

    // MARK: - Calendar Events - Fetch

    /// Fetches calendar events within a date range from all available calendars.
    /// - Parameters:
    ///   - startDate: The start date of the range
    ///   - endDate: The end date of the range
    ///   - calendars: Optional array of specific calendars to fetch from. If nil, fetches from all calendars.
    /// - Returns: Array of EKEvent objects
    func fetchEvents(from startDate: Date, to endDate: Date, calendars: [EKCalendar]? = nil) -> [EKEvent] {
        guard isCalendarAuthorized else {
            print("[EventKitService] Calendar access not authorized")
            return []
        }

        let calendarsToSearch = calendars ?? eventStore.calendars(for: .event)
        let predicate = eventStore.predicateForEvents(withStart: startDate, end: endDate, calendars: calendarsToSearch)
        let events = eventStore.events(matching: predicate)

        print("[EventKitService] Fetched \(events.count) events from \(calendarsToSearch.count) calendars")
        return events
    }

    /// Fetches a single event by its identifier.
    /// - Parameter identifier: The unique identifier of the event
    /// - Returns: The EKEvent if found, nil otherwise
    func fetchEvent(identifier: String) -> EKEvent? {
        guard isCalendarAuthorized else {
            print("[EventKitService] Calendar access not authorized")
            return nil
        }

        return eventStore.event(withIdentifier: identifier)
    }

    // MARK: - Calendar Events - Create

    /// Creates a new calendar event.
    /// - Parameters:
    ///   - title: The event title
    ///   - startDate: The start date/time
    ///   - endDate: The end date/time
    ///   - isAllDay: Whether the event is all-day
    ///   - location: Optional location
    ///   - notes: Optional notes/description
    ///   - calendar: Optional specific calendar. If nil, uses the default calendar.
    /// - Returns: The identifier of the created event
    /// - Throws: EventKitError if creation fails
    func createEvent(
        title: String,
        startDate: Date,
        endDate: Date,
        isAllDay: Bool = false,
        location: String? = nil,
        notes: String? = nil,
        calendar: EKCalendar? = nil
    ) throws -> String {
        guard isCalendarAuthorized else {
            throw EventKitError.notAuthorized
        }

        let event = EKEvent(eventStore: eventStore)
        event.title = title
        event.startDate = startDate
        event.endDate = endDate
        event.isAllDay = isAllDay
        event.location = location
        event.notes = notes
        event.calendar = calendar ?? eventStore.defaultCalendarForNewEvents

        try eventStore.save(event, span: .thisEvent)

        print("[EventKitService] Created event: \(title) with ID: \(event.eventIdentifier ?? "unknown")")
        HapticManager.shared.notification(.success)

        return event.eventIdentifier ?? ""
    }

    // MARK: - Calendar Events - Update

    /// Updates an existing calendar event.
    /// - Parameters:
    ///   - identifier: The unique identifier of the event to update
    ///   - title: Optional new title
    ///   - startDate: Optional new start date
    ///   - endDate: Optional new end date
    ///   - isAllDay: Optional new all-day status
    ///   - location: Optional new location
    ///   - notes: Optional new notes
    /// - Throws: EventKitError if update fails
    func updateEvent(
        identifier: String,
        title: String? = nil,
        startDate: Date? = nil,
        endDate: Date? = nil,
        isAllDay: Bool? = nil,
        location: String? = nil,
        notes: String? = nil
    ) throws {
        guard isCalendarAuthorized else {
            throw EventKitError.notAuthorized
        }

        guard let event = eventStore.event(withIdentifier: identifier) else {
            throw EventKitError.eventNotFound
        }

        if let title = title {
            event.title = title
        }
        if let startDate = startDate {
            event.startDate = startDate
        }
        if let endDate = endDate {
            event.endDate = endDate
        }
        if let isAllDay = isAllDay {
            event.isAllDay = isAllDay
        }
        if let location = location {
            event.location = location
        }
        if let notes = notes {
            event.notes = notes
        }

        try eventStore.save(event, span: .thisEvent)

        print("[EventKitService] Updated event: \(identifier)")
        HapticManager.shared.notification(.success)
    }

    // MARK: - Calendar Events - Delete

    /// Deletes a calendar event.
    /// - Parameter identifier: The unique identifier of the event to delete
    /// - Throws: EventKitError if deletion fails
    func deleteEvent(identifier: String) throws {
        guard isCalendarAuthorized else {
            throw EventKitError.notAuthorized
        }

        guard let event = eventStore.event(withIdentifier: identifier) else {
            throw EventKitError.eventNotFound
        }

        try eventStore.remove(event, span: .thisEvent)

        print("[EventKitService] Deleted event: \(identifier)")
        HapticManager.shared.notification(.success)
    }

    // MARK: - Reminders - Fetch

    /// Fetches reminders from specified calendars.
    /// - Parameter calendars: Optional array of specific calendars. If nil, fetches from all reminder calendars.
    /// - Returns: Array of EKReminder objects
    func fetchReminders(calendars: [EKCalendar]? = nil) async -> [EKReminder] {
        guard isRemindersAuthorized else {
            print("[EventKitService] Reminders access not authorized")
            return []
        }

        let calendarsToSearch = calendars ?? eventStore.calendars(for: .reminder)

        return await withCheckedContinuation { continuation in
            let predicate = eventStore.predicateForReminders(in: calendarsToSearch)

            eventStore.fetchReminders(matching: predicate) { reminders in
                let result = reminders ?? []
                print("[EventKitService] Fetched \(result.count) reminders from \(calendarsToSearch.count) calendars")
                continuation.resume(returning: result)
            }
        }
    }

    /// Fetches incomplete (active) reminders only.
    /// - Parameter calendars: Optional array of specific calendars
    /// - Returns: Array of incomplete EKReminder objects
    func fetchIncompleteReminders(calendars: [EKCalendar]? = nil) async -> [EKReminder] {
        guard isRemindersAuthorized else {
            print("[EventKitService] Reminders access not authorized")
            return []
        }

        let calendarsToSearch = calendars ?? eventStore.calendars(for: .reminder)

        return await withCheckedContinuation { continuation in
            let predicate = eventStore.predicateForIncompleteReminders(
                withDueDateStarting: nil,
                ending: nil,
                calendars: calendarsToSearch
            )

            eventStore.fetchReminders(matching: predicate) { reminders in
                let result = reminders ?? []
                print("[EventKitService] Fetched \(result.count) incomplete reminders")
                continuation.resume(returning: result)
            }
        }
    }

    /// Fetches a single reminder by its identifier.
    /// - Parameter identifier: The unique identifier of the reminder
    /// - Returns: The EKReminder if found, nil otherwise
    func fetchReminder(identifier: String) -> EKReminder? {
        guard isRemindersAuthorized else {
            print("[EventKitService] Reminders access not authorized")
            return nil
        }

        return eventStore.calendarItem(withIdentifier: identifier) as? EKReminder
    }

    // MARK: - Reminders - Create

    /// Creates a new reminder.
    /// - Parameters:
    ///   - title: The reminder title
    ///   - notes: Optional notes
    ///   - dueDate: Optional due date
    ///   - priority: Priority level (0-9, where 0 is none, 1-4 is low, 5 is medium, 6-9 is high)
    ///   - calendar: Optional specific calendar. If nil, uses the default reminder calendar.
    /// - Returns: The identifier of the created reminder
    /// - Throws: EventKitError if creation fails
    func createReminder(
        title: String,
        notes: String? = nil,
        dueDate: Date? = nil,
        priority: Int = 0,
        calendar: EKCalendar? = nil
    ) throws -> String {
        guard isRemindersAuthorized else {
            throw EventKitError.notAuthorized
        }

        let reminder = EKReminder(eventStore: eventStore)
        reminder.title = title
        reminder.notes = notes
        reminder.priority = priority
        reminder.calendar = calendar ?? eventStore.defaultCalendarForNewReminders()

        if let dueDate = dueDate {
            let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: dueDate)
            reminder.dueDateComponents = components
        }

        try eventStore.save(reminder, commit: true)

        print("[EventKitService] Created reminder: \(title) with ID: \(reminder.calendarItemIdentifier)")
        HapticManager.shared.notification(.success)

        return reminder.calendarItemIdentifier
    }

    // MARK: - Reminders - Update

    /// Updates an existing reminder.
    /// - Parameters:
    ///   - identifier: The unique identifier of the reminder to update
    ///   - title: Optional new title
    ///   - notes: Optional new notes
    ///   - dueDate: Optional new due date
    ///   - priority: Optional new priority
    ///   - isCompleted: Optional new completion status
    /// - Throws: EventKitError if update fails
    func updateReminder(
        identifier: String,
        title: String? = nil,
        notes: String? = nil,
        dueDate: Date? = nil,
        priority: Int? = nil,
        isCompleted: Bool? = nil
    ) throws {
        guard isRemindersAuthorized else {
            throw EventKitError.notAuthorized
        }

        guard let reminder = eventStore.calendarItem(withIdentifier: identifier) as? EKReminder else {
            throw EventKitError.reminderNotFound
        }

        if let title = title {
            reminder.title = title
        }
        if let notes = notes {
            reminder.notes = notes
        }
        if let dueDate = dueDate {
            let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: dueDate)
            reminder.dueDateComponents = components
        }
        if let priority = priority {
            reminder.priority = priority
        }
        if let isCompleted = isCompleted {
            reminder.isCompleted = isCompleted
            if isCompleted {
                reminder.completionDate = Date()
            } else {
                reminder.completionDate = nil
            }
        }

        try eventStore.save(reminder, commit: true)

        print("[EventKitService] Updated reminder: \(identifier)")
        HapticManager.shared.notification(.success)
    }

    // MARK: - Reminders - Complete

    /// Marks a reminder as completed.
    /// - Parameter identifier: The unique identifier of the reminder
    /// - Throws: EventKitError if completion fails
    func completeReminder(identifier: String) throws {
        guard isRemindersAuthorized else {
            throw EventKitError.notAuthorized
        }

        guard let reminder = eventStore.calendarItem(withIdentifier: identifier) as? EKReminder else {
            throw EventKitError.reminderNotFound
        }

        reminder.isCompleted = true
        reminder.completionDate = Date()

        try eventStore.save(reminder, commit: true)

        print("[EventKitService] Completed reminder: \(identifier)")
        HapticManager.shared.notification(.success)
    }

    // MARK: - Reminders - Delete

    /// Deletes a reminder.
    /// - Parameter identifier: The unique identifier of the reminder to delete
    /// - Throws: EventKitError if deletion fails
    func deleteReminder(identifier: String) throws {
        guard isRemindersAuthorized else {
            throw EventKitError.notAuthorized
        }

        guard let reminder = eventStore.calendarItem(withIdentifier: identifier) as? EKReminder else {
            throw EventKitError.reminderNotFound
        }

        try eventStore.remove(reminder, commit: true)

        print("[EventKitService] Deleted reminder: \(identifier)")
        HapticManager.shared.notification(.success)
    }

    // MARK: - Utility Methods

    /// Returns all available calendars for events
    func getEventCalendars() -> [EKCalendar] {
        guard isCalendarAuthorized else { return [] }
        return eventStore.calendars(for: .event)
    }

    /// Returns all available calendars for reminders
    func getReminderCalendars() -> [EKCalendar] {
        guard isRemindersAuthorized else { return [] }
        return eventStore.calendars(for: .reminder)
    }
}

// MARK: - EventKit Errors

enum EventKitError: LocalizedError {
    case notAuthorized
    case eventNotFound
    case reminderNotFound
    case saveFailed
    case deleteFailed

    var errorDescription: String? {
        switch self {
        case .notAuthorized:
            return "Calendar or Reminders access not authorized. Please grant permission in Settings."
        case .eventNotFound:
            return "The calendar event could not be found."
        case .reminderNotFound:
            return "The reminder could not be found."
        case .saveFailed:
            return "Failed to save changes to Calendar or Reminders."
        case .deleteFailed:
            return "Failed to delete the item from Calendar or Reminders."
        }
    }
}
