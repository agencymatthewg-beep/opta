//
//  AboutView.swift
//  OptaPlusIOS
//

import SwiftUI

struct AboutView: View {
    @State private var pulseScale: CGFloat = 1.0
    @Environment(\.dismiss) private var dismiss

    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.1.0"
    }

    private var build: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                Spacer().frame(height: 20)

                // Logo
                ZStack {
                    Circle()
                        .fill(Color.optaPrimary.opacity(0.12))
                        .frame(width: 120, height: 120)
                        .scaleEffect(pulseScale)
                        .blur(radius: 15)

                    Text("O+")
                        .font(.system(size: 48, weight: .black, design: .rounded))
                        .foregroundStyle(
                            LinearGradient(colors: [.optaPrimary, .optaCyan], startPoint: .topLeading, endPoint: .bottomTrailing)
                        )
                }
                .onAppear {
                    withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                        pulseScale = 1.15
                    }
                }

                VStack(spacing: 4) {
                    Text("OptaPlus")
                        .font(.title.bold())
                        .foregroundColor(.optaTextPrimary)
                    Text("Version \(version) (\(build))")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }

                Text("Made with 🥷🏿 by Opta Operations")
                    .font(.subheadline)
                    .foregroundColor(.optaTextSecondary)

                // Links
                VStack(spacing: 0) {
                    aboutLink("Website", icon: "globe", url: "https://optamize.biz")
                    Divider().overlay(Color.optaBorder)
                    aboutLink("GitHub", icon: "chevron.left.forwardslash.chevron.right", url: "https://github.com/optamize")
                    Divider().overlay(Color.optaBorder)
                    aboutLink("Support", icon: "envelope.fill", url: "mailto:support@optamize.biz")
                }
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.optaSurface)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.optaBorder, lineWidth: 1))
                )
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 20)

                // Acknowledgments
                VStack(alignment: .leading, spacing: 8) {
                    Text("Acknowledgments")
                        .font(.headline)
                        .foregroundColor(.optaTextPrimary)

                    Text("Built with SwiftUI, OptaMolt design system, and the OpenClaw platform. Powered by the relentless pursuit of premium.")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                        .lineSpacing(4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)

                Spacer()
            }
        }
        .background(Color.optaVoid)
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func aboutLink(_ title: String, icon: String, url: String) -> some View {
        Button {
            if let u = URL(string: url) { UIApplication.shared.open(u) }
        } label: {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.optaPrimary)
                    .frame(width: 24)
                Text(title)
                    .foregroundColor(.optaTextPrimary)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.caption)
                    .foregroundColor(.optaTextMuted)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
    }
}
