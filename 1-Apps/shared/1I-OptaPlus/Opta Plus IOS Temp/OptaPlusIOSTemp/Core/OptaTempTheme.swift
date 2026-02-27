import SwiftUI

extension Color {
    static let optaTempBackground = Color(hex: "05050A")
    static let optaTempSurface = Color(hex: "10101A")
    static let optaTempRaised = Color(hex: "171728")
    static let optaTempBorder = Color(hex: "2B2B45")
    static let optaTempPrimary = Color(hex: "8B5CF6")
    static let optaTempSecondary = Color(hex: "22D3EE")
    static let optaTempAccent = Color(hex: "F97316")
    static let optaTempTextPrimary = Color(hex: "EEEAFB")
    static let optaTempTextSecondary = Color(hex: "B6AECE")
    static let optaTempTextMuted = Color(hex: "6F6787")
    static let optaTempSuccess = Color(hex: "22C55E")
    static let optaTempWarning = Color(hex: "F59E0B")
}

extension Font {
    static let optaTempTitle = Font.system(size: 30, weight: .bold, design: .rounded)
    static let optaTempSection = Font.system(size: 18, weight: .semibold, design: .rounded)
    static let optaTempBody = Font.system(size: 14, weight: .regular, design: .default)
    static let optaTempCaption = Font.system(size: 12, weight: .medium, design: .default)
}

private extension Color {
    init(hex: String) {
        let sanitized = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&int)
        let r, g, b: UInt64
        switch sanitized.count {
        case 6:
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0xFF, 0x00, 0x00)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255.0,
            green: Double(g) / 255.0,
            blue: Double(b) / 255.0,
            opacity: 1.0
        )
    }
}
