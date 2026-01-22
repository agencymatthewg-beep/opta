//
//  OfflineIndicator.swift
//  Opta Scan
//
//  Shows offline status and model availability
//  Created by Matthew Byrden
//

import SwiftUI

struct OfflineIndicator: View {
    let isOffline: Bool
    let hasModel: Bool

    var body: some View {
        if isOffline && hasModel {
            // Offline but ready
            HStack(spacing: 8) {
                Image(systemName: "wifi.slash")
                    .font(.system(size: 14, weight: .medium))
                Text("Offline Mode")
                    .font(.optaCaption)
                Spacer()
                Text("Ready")
                    .font(.optaCaption)
                    .foregroundStyle(.optaGreen)
            }
            .foregroundStyle(.optaTextSecondary)
            .padding(.horizontal, OptaDesign.Spacing.md)
            .padding(.vertical, OptaDesign.Spacing.sm)
            .background(Color.optaSurface)
        } else if isOffline && !hasModel {
            // Offline and no model
            HStack(spacing: 8) {
                Image(systemName: "wifi.slash")
                    .font(.system(size: 14, weight: .medium))
                Text("Offline - Model Required")
                    .font(.optaCaption)
                Spacer()
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
            }
            .foregroundStyle(.optaTextSecondary)
            .padding(.horizontal, OptaDesign.Spacing.md)
            .padding(.vertical, OptaDesign.Spacing.sm)
            .background(Color.orange.opacity(0.1))
        }
        // Online: no indicator shown
    }
}

#Preview {
    VStack(spacing: 0) {
        OfflineIndicator(isOffline: true, hasModel: true)
        OfflineIndicator(isOffline: true, hasModel: false)
        OfflineIndicator(isOffline: false, hasModel: true)
    }
    .background(Color.optaBackground)
}
