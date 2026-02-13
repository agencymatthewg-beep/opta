import SwiftUI

struct AboutView: View {
    private var version: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }

    private var build: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "circle.grid.2x2.fill")
                .font(.system(size: 48))
                .foregroundColor(.accentColor)

            Text("Opta Mini")
                .font(.title2.bold())

            Text("Version \(version) (\(build))")
                .font(.caption)
                .foregroundColor(.secondary)

            Divider()
                .padding(.horizontal, 40)

            Text("Ecosystem hub for Opta apps")
                .font(.caption)
                .foregroundColor(.secondary)

            Text("\u{00A9} 2026 Opta")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    AboutView()
}
