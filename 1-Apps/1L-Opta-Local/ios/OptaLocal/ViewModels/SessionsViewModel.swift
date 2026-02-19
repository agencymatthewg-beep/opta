import Foundation

@Observable @MainActor
final class SessionsViewModel {
    var sessions: [Session] = []
    var filteredSessions: [Session] = []
    var isLoading = false
    var error: String?

    var searchQuery = "" {
        didSet { applyFilters() }
    }
    var modelFilter: String? = nil {
        didSet { applyFilters() }
    }

    var availableModels: [String] = []

    // MARK: - Fetch

    func loadSessions(client: LMXClient) async {
        isLoading = true
        error = nil
        do {
            let response = try await client.getSessions(limit: 200)
            sessions = response.sessions.sorted {
                $0.updatedAt > $1.updatedAt
            }
            availableModels = Array(Set(sessions.map(\.model))).sorted()
            applyFilters()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func refresh(client: LMXClient) async {
        await loadSessions(client: client)
    }

    // MARK: - Filtering

    private func applyFilters() {
        var result = sessions

        // Model filter
        if let modelFilter, !modelFilter.isEmpty {
            result = result.filter { $0.model == modelFilter }
        }

        // Fuzzy search
        if !searchQuery.isEmpty {
            let query = searchQuery.lowercased()
            result = result.filter { session in
                fuzzyMatch(query: query, target: session.title.lowercased()) ||
                fuzzyMatch(query: query, target: session.model.lowercased())
            }
            // Sort by match quality
            result.sort { a, b in
                let aTitle = a.title.lowercased()
                let bTitle = b.title.lowercased()
                let aExact = aTitle.contains(query)
                let bExact = bTitle.contains(query)
                if aExact != bExact { return aExact }
                return a.updatedAt > b.updatedAt
            }
        }

        filteredSessions = result
    }

    /// Simple fuzzy match — checks if all characters of query appear in order in target.
    private func fuzzyMatch(query: String, target: String) -> Bool {
        var targetIndex = target.startIndex
        for char in query {
            guard let found = target[targetIndex...].firstIndex(of: char) else {
                return false
            }
            targetIndex = target.index(after: found)
        }
        return true
    }

    // MARK: - Date formatting

    static func relativeDate(from isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: isoString) else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: isoString) else {
                return isoString
            }
            return Self.relativeString(from: date)
        }
        return Self.relativeString(from: date)
    }

    private static func relativeString(from date: Date) -> String {
        let now = Date()
        let interval = now.timeIntervalSince(date)

        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        if interval < 604800 { return "\(Int(interval / 86400))d ago" }

        let df = DateFormatter()
        df.dateStyle = .medium
        df.timeStyle = .none
        return df.string(from: date)
    }

    /// Short model name (after last /)
    static func shortModelName(_ model: String) -> String {
        model.split(separator: "/").last.map(String.init) ?? model
    }
}
