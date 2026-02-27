//
//  DepthLayerView.swift
//  Opta Scan
//
//  Multi-layer depth view component
//  Part of Phase 13: 3D Transforms
//

import SwiftUI

/// A container that arranges content in depth layers
struct DepthLayerStack<Content: View>: View {
    let layers: Int
    let spacing: CGFloat
    let perspective: CGFloat
    @Binding var expandedIndex: Int?
    let content: (Int) -> Content

    init(
        layers: Int,
        spacing: CGFloat = 10,
        perspective: CGFloat = 0.001,
        expandedIndex: Binding<Int?>,
        @ViewBuilder content: @escaping (Int) -> Content
    ) {
        self.layers = layers
        self.spacing = spacing
        self.perspective = perspective
        self._expandedIndex = expandedIndex
        self.content = content
    }

    var body: some View {
        ZStack {
            ForEach(0..<layers, id: \.self) { index in
                content(index)
                    .layerSeparation(
                        index: index,
                        total: layers,
                        isExpanded: expandedIndex != nil,
                        config: .subtle
                    )
                    .onTapGesture {
                        withAnimation(.optaSpring) {
                            if expandedIndex == index {
                                expandedIndex = nil
                            } else {
                                expandedIndex = index
                            }
                        }
                    }
            }
        }
    }
}

/// A view that provides depth context
struct DepthContextView<Content: View>: View {
    let depth: CGFloat
    let content: Content

    init(depth: CGFloat = 0.5, @ViewBuilder content: () -> Content) {
        self.depth = depth
        self.content = content()
    }

    var body: some View {
        content
            .depthShadow(depth)
            .scaleEffect(1 - depth * 0.05)
    }
}
