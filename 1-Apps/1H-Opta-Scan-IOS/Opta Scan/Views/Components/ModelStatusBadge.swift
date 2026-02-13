//
//  ModelStatusBadge.swift
//  Opta Scan
//
//  Visual badge showing model download and readiness status
//  Created by Matthew Byrden
//

import SwiftUI

struct ModelStatusBadge: View {
    let state: ModelDownloadState

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: iconName)
                .font(.system(size: 10, weight: .medium))

            Text(text)
                .font(.system(size: 11, weight: .medium))
        }
        .foregroundStyle(foregroundColor)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(backgroundColor)
        .clipShape(Capsule())
    }

    private var iconName: String {
        switch state {
        case .notDownloaded:
            return "arrow.down.circle"
        case .downloading:
            return "arrow.down.circle"
        case .downloaded:
            return "checkmark.circle.fill"
        case .failed:
            return "exclamationmark.circle"
        }
    }

    private var text: String {
        switch state {
        case .notDownloaded:
            return "Available"
        case .downloading:
            return "Downloading"
        case .downloaded:
            return "Ready"
        case .failed:
            return "Error"
        }
    }

    private var foregroundColor: Color {
        switch state {
        case .notDownloaded:
            return .optaTextSecondary
        case .downloading:
            return .optaBlue
        case .downloaded:
            return .optaGreen
        case .failed:
            return .optaRed
        }
    }

    private var backgroundColor: Color {
        switch state {
        case .notDownloaded:
            return .optaSurface
        case .downloading:
            return .optaBlue.opacity(0.15)
        case .downloaded:
            return .optaGreen.opacity(0.15)
        case .failed:
            return .optaRed.opacity(0.15)
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        ModelStatusBadge(state: .notDownloaded)
        ModelStatusBadge(state: .downloading(progress: 0.5))
        ModelStatusBadge(state: .downloaded)
        ModelStatusBadge(state: .failed("Failed"))
    }
    .padding()
    .background(Color.optaBackground)
}
