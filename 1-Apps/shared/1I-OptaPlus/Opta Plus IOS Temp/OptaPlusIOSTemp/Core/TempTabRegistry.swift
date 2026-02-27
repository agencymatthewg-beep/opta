import Foundation

struct TempTabDescriptor: Identifiable, Hashable {
    let id: String
    let title: String
    let symbol: String
    let isLegacy: Bool
}

enum TempTabRegistry {
    static let orderedTabs: [TempTabDescriptor] = [
        .init(id: "home", title: "Home", symbol: "house.fill", isLegacy: false),
        .init(id: "plan", title: "Plan", symbol: "calendar", isLegacy: false),
        .init(id: "chat", title: "Chat", symbol: "bubble.left.and.bubble.right.fill", isLegacy: false),
        .init(id: "work", title: "Work", symbol: "rectangle.3.group.bubble.left", isLegacy: false),
        .init(id: "more", title: "More", symbol: "ellipsis.circle.fill", isLegacy: false),
        .init(id: "map", title: "Map", symbol: "circle.hexagongrid.fill", isLegacy: true),
        .init(id: "legacy-chat", title: "Legacy Chat", symbol: "text.bubble.fill", isLegacy: true),
        .init(id: "automations", title: "Automations", symbol: "bolt.circle.fill", isLegacy: true),
        .init(id: "settings", title: "Settings", symbol: "gearshape.fill", isLegacy: true),
        .init(id: "diagnostics", title: "Diagnostics", symbol: "stethoscope", isLegacy: true),
    ]
}
