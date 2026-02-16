//
//  ContextPanel.swift
//  OptaPlusMacOS
//
//  Floating glass indicators showing the bot's current memory/context.
//  Ambient hover effects, staggered pill entrance, and organic expand.
//

import SwiftUI
import OptaMolt

// MARK: - Context Item

struct ContextItem: Identifiable, Equatable {
    let id = UUID()
    let name: String
    let path: String
    let kind: ContextKind
    let sizeHint: String?
    
    enum ContextKind: String, Equatable, CaseIterable {
        case workspace = "workspace"
        case memory = "memory"
        case skill = "skill"
        case system = "system"
        case injected = "injected"
        
        var icon: String {
            switch self {
            case .workspace: return "doc.text"
            case .memory: return "brain.head.profile"
            case .skill: return "hammer"
            case .system: return "gearshape"
            case .injected: return "arrow.down.doc"
            }
        }
        
        var color: Color {
            switch self {
            case .workspace: return .optaBlue
            case .memory: return .optaPrimary
            case .skill: return .optaAmber
            case .system: return .optaTextMuted
            case .injected: return .optaCyan
            }
        }
    }
}

// MARK: - Context Panel

struct ContextPanel: View {
    let items: [ContextItem]
    @Binding var isExpanded: Bool
    @State private var hoveredItemId: UUID?
    @State private var buttonBreathe: CGFloat = 0
    @State private var panelScale: CGFloat = 0.9
    @State private var panelOpacity: CGFloat = 0
    
    private var groupedItems: [(ContextItem.ContextKind, [ContextItem])] {
        let dict = Dictionary(grouping: items) { $0.kind }
        let order: [ContextItem.ContextKind] = [.system, .workspace, .memory, .skill, .injected]
        return order.compactMap { kind in
            if let items = dict[kind], !items.isEmpty {
                return (kind, items)
            }
            return nil
        }
    }
    
    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            // Floating toggle pill with gentle breathing
            Button(action: {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                    isExpanded.toggle()
                }
            }) {
                HStack(spacing: 5) {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 10))
                        .rotationEffect(.degrees(isExpanded ? -10 : 0))
                    
                    Text("\(items.count)")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                    
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 7))
                        .rotationEffect(.degrees(isExpanded ? 0 : 0))
                }
                .foregroundColor(isExpanded ? .optaPrimary : .optaTextSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(
                    Capsule()
                        .fill(Color.optaSurface.opacity(isExpanded ? 0.8 : 0.5))
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                )
                .overlay(
                    Capsule()
                        .stroke(
                            isExpanded ? Color.optaPrimary.opacity(0.2) : Color.optaBorder.opacity(0.15),
                            lineWidth: 0.5
                        )
                )
                .shadow(color: Color.optaPrimary.opacity(isExpanded ? 0.1 : 0), radius: 8, y: 2)
                .scaleEffect(1 + 0.02 * buttonBreathe)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isExpanded ? "Collapse context panel" : "Expand context panel, \(items.count) files")
            .help("Context files (\(items.count))")
            .onAppear {
                withAnimation(.optaPulse) {
                    buttonBreathe = 1
                }
            }
            
            // Expanded panel with organic entrance
            if isExpanded {
                VStack(alignment: .leading, spacing: 6) {
                    // Header
                    HStack {
                        HStack(spacing: 4) {
                            Image(systemName: "square.stack.3d.up")
                                .font(.system(size: 9))
                                .foregroundColor(.optaPrimary)
                            
                            Text("CONTEXT")
                                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                .foregroundColor(.optaTextMuted)
                        }
                        
                        Spacer()
                        
                        Text("\(items.count) files")
                            .font(.sora(9))
                            .foregroundColor(.optaTextMuted)
                            .opacity(0.5)
                    }
                    .padding(.horizontal, 12)
                    .padding(.top, 10)
                    
                    // Gradient divider
                    LinearGradient(
                        colors: [.clear, Color.optaPrimary.opacity(0.15), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(height: 1)
                    
                    // Grouped items with staggered entrance
                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(Array(groupedItems.enumerated()), id: \.element.0) { groupIndex, group in
                                let (kind, kindItems) = group
                                VStack(alignment: .leading, spacing: 4) {
                                    // Group label
                                    Text(kind.rawValue.uppercased())
                                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                                        .foregroundColor(kind.color.opacity(0.5))
                                        .padding(.leading, 4)
                                    
                                    // Items as floating pills
                                    FlowLayout(spacing: 4) {
                                        ForEach(Array(kindItems.enumerated()), id: \.element.id) { itemIndex, item in
                                            ContextPill(
                                                item: item,
                                                isHovered: hoveredItemId == item.id,
                                                entranceDelay: Double(groupIndex) * 0.08 + Double(itemIndex) * 0.03
                                            )
                                            .onHover { isHover in
                                                withAnimation(.spring(response: 0.2, dampingFraction: 0.7)) {
                                                    hoveredItemId = isHover ? item.id : nil
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.bottom, 10)
                    }
                    .frame(maxHeight: 200)
                }
                .frame(width: 280)
                .background(
                    ZStack {
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.optaSurface.opacity(0.7))
                            .background(.ultraThinMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(
                            LinearGradient(
                                colors: [Color.optaPrimary.opacity(0.1), Color.optaBorder.opacity(0.1), Color.clear],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 0.5
                        )
                )
                .shadow(color: Color.optaVoid.opacity(0.25), radius: 20, y: 6)
                .shadow(color: Color.optaPrimary.opacity(0.08), radius: 16, y: 0)
                .scaleEffect(panelScale, anchor: .topTrailing)
                .opacity(panelOpacity)
                .onAppear {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) {
                        panelScale = 1
                        panelOpacity = 1
                    }
                }
                .onDisappear {
                    panelScale = 0.9
                    panelOpacity = 0
                }
                .transition(.asymmetric(
                    insertion: .identity,
                    removal: .scale(scale: 0.95, anchor: .topTrailing).combined(with: .opacity)
                ))
            }
        }
    }
}

// MARK: - Context Pill (with staggered entrance)

struct ContextPill: View {
    let item: ContextItem
    let isHovered: Bool
    let entranceDelay: Double
    
    @State private var appeared = false
    @State private var floatOffset: CGFloat = 0
    
    init(item: ContextItem, isHovered: Bool, entranceDelay: Double = 0) {
        self.item = item
        self.isHovered = isHovered
        self.entranceDelay = entranceDelay
    }
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: item.kind.icon)
                .font(.system(size: 8))
                .foregroundColor(item.kind.color)
            
            Text(item.name)
                .font(.sora(9, weight: .medium))
                .foregroundColor(isHovered ? .optaTextPrimary : .optaTextSecondary)
                .lineLimit(1)
            
            if isHovered, let size = item.sizeHint {
                Text(size)
                    .font(.system(size: 8))
                    .foregroundColor(.optaTextMuted)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(isHovered ? item.kind.color.opacity(0.12) : Color.optaElevated.opacity(0.5))
        )
        .overlay(
            Capsule()
                .stroke(isHovered ? item.kind.color.opacity(0.25) : Color.optaBorder.opacity(0.1), lineWidth: 0.5)
        )
        .shadow(color: isHovered ? item.kind.color.opacity(0.15) : .clear, radius: 6, y: 2)
        .scaleEffect(isHovered ? 1.05 : 1)
        .offset(y: floatOffset)
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 6)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7).delay(entranceDelay)) {
                appeared = true
            }
            // Subtle ambient float (each pill slightly different)
            let duration = 3.0 + Double.random(in: 0...1)
            withAnimation(.spring(response: 1.2, dampingFraction: 0.5).repeatForever(autoreverses: true).delay(entranceDelay)) {
                floatOffset = CGFloat.random(in: -1.5...1.5)
            }
        }
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 4
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        computeLayout(proposal: proposal, subviews: subviews).size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = computeLayout(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() where index < subviews.count {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }
    
    private struct LayoutResult {
        var size: CGSize
        var positions: [CGPoint]
    }
    
    private func computeLayout(proposal: ProposedViewSize, subviews: Subviews) -> LayoutResult {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalSize: CGSize = .zero
        
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > maxWidth && currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }
            positions.append(CGPoint(x: currentX, y: currentY))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
            totalSize.width = max(totalSize.width, currentX - spacing)
        }
        totalSize.height = currentY + lineHeight
        return LayoutResult(size: totalSize, positions: positions)
    }
}
