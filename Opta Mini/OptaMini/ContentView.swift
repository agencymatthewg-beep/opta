import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text("Opta Mini")
                    .font(.title2.bold())

                Text("Opta Ecosystem Hub")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Divider()

            // Placeholder for app list
            Text("Apps will appear here")
                .font(.body)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 40)

            Spacer()
        }
        .padding()
        .frame(width: 300, height: 400)
    }
}

#Preview {
    ContentView()
}
