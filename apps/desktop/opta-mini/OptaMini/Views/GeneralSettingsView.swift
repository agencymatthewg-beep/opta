import SwiftUI

struct GeneralSettingsView: View {
    @StateObject private var loginItemManager = LoginItemManager()

    var body: some View {
        Form {
            Toggle("Launch at Login", isOn: Binding(
                get: { loginItemManager.isEnabled },
                set: { loginItemManager.setEnabled($0) }
            ))
            .help("Start Opta Mini automatically when you log in")
        }
        .padding()
    }
}

#Preview {
    GeneralSettingsView()
}
