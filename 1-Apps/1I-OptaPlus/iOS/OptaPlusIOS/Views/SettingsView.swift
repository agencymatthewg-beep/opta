//
//  SettingsView.swift
//  OptaPlusIOS
//

import SwiftUI
import OptaPlus
import OptaMolt

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showAddBot = false
    @State private var editingBot: BotConfig?

    var body: some View {
        NavigationStack {
            List {
                Section("Bots") {
                    ForEach(appState.bots) { bot in
                        Button {
                            editingBot = bot
                        } label: {
                            HStack(spacing: 12) {
                                Text(bot.emoji)
                                    .font(.title2)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(bot.name)
                                        .font(.body)
                                        .foregroundColor(.optaTextPrimary)
                                    Text("\(bot.host):\(bot.port)")
                                        .font(.caption)
                                        .foregroundColor(.optaTextMuted)
                                }
                                Spacer()
                                connectionIndicator(for: bot)
                            }
                        }
                        .listRowBackground(Color.optaSurface)
                    }
                    .onDelete { indexSet in
                        for idx in indexSet {
                            appState.removeBot(id: appState.bots[idx].id)
                        }
                    }

                    Button {
                        showAddBot = true
                    } label: {
                        Label("Add Bot", systemImage: "plus.circle.fill")
                            .foregroundColor(.optaPrimary)
                    }
                    .listRowBackground(Color.optaSurface)
                }

                Section("About") {
                    HStack {
                        Text("Version")
                            .foregroundColor(.optaTextSecondary)
                        Spacer()
                        Text("0.1.0")
                            .foregroundColor(.optaTextMuted)
                    }
                    .listRowBackground(Color.optaSurface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.optaVoid)
            .navigationTitle("Settings")
            .sheet(isPresented: $showAddBot) {
                BotEditSheet(bot: nil) { newBot in
                    appState.addBot(newBot)
                }
            }
            .sheet(item: $editingBot) { bot in
                BotEditSheet(bot: bot) { updated in
                    appState.updateBot(updated)
                }
            }
        }
    }

    private func connectionIndicator(for bot: BotConfig) -> some View {
        let vm = appState.viewModel(for: bot)
        return Circle()
            .fill(vm.connectionState == .connected ? Color.optaGreen :
                  vm.connectionState == .disconnected ? Color.optaTextMuted : Color.optaAmber)
            .frame(width: 8, height: 8)
    }
}

// MARK: - Bot Edit Sheet

struct BotEditSheet: View {
    let bot: BotConfig?
    let onSave: (BotConfig) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var host: String = ""
    @State private var port: String = ""
    @State private var token: String = ""
    @State private var emoji: String = "🤖"

    var body: some View {
        NavigationStack {
            Form {
                Section("Identity") {
                    TextField("Name", text: $name)
                    TextField("Emoji", text: $emoji)
                }

                Section("Connection") {
                    TextField("Host", text: $host)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Port", text: $port)
                        .keyboardType(.numberPad)
                    SecureField("Token", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.optaVoid)
            .navigationTitle(bot == nil ? "Add Bot" : "Edit Bot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let p = Int(port) ?? 18793
                        let config = BotConfig(
                            id: bot?.id ?? UUID().uuidString,
                            name: name,
                            host: host,
                            port: p,
                            token: token,
                            emoji: emoji
                        )
                        onSave(config)
                        dismiss()
                    }
                    .disabled(name.isEmpty || host.isEmpty || port.isEmpty)
                }
            }
            .onAppear {
                if let bot = bot {
                    name = bot.name
                    host = bot.host
                    port = String(bot.port)
                    token = bot.token
                    emoji = bot.emoji
                }
            }
        }
    }
}
