import Foundation

// MARK: - Email Model

struct Email: Identifiable, Codable, Hashable {
    let id: String
    let threadId: String?
    let snippet: String
    let subject: String
    let from: EmailSender
    let date: String?
    
    var dateObject: Date? {
        // Parse email date format
        guard let dateStr = date else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss Z"
        return formatter.date(from: dateStr)
    }
    
    var displayDate: String {
        guard let date = dateObject else { return "" }
        return date.relativeDescription
    }
}

struct EmailSender: Codable, Hashable {
    let name: String
    let email: String
    
    var displayName: String {
        name.isEmpty ? email : name
    }
    
    var initials: String {
        let parts = displayName.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(displayName.prefix(2)).uppercased()
    }
}

// MARK: - Email Response

struct EmailResponse: Codable {
    let success: Bool
    let emails: [Email]
    let count: Int
}
