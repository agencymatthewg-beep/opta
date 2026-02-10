import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @AppStorage("hapticFeedback") private var hapticFeedback = true
    @AppStorage("notificationsEnabled") private var notificationsEnabled = true
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()
                
                List {
                    // Account Section
                    Section {
                        HStack(spacing: 16) {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [.optaPrimary.opacity(0.5), .optaVoid],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 60, height: 60)
                                .overlay(
                                    Image(systemName: "person.fill")
                                        .font(.title2)
                                        .foregroundColor(.optaTextSecondary)
                                )
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(authManager.currentUser?.name ?? "User")
                                    .font(.headline)
                                    .foregroundColor(.optaTextPrimary)
                                
                                Text(authManager.currentUser?.email ?? "Connected")
                                    .font(.caption)
                                    .foregroundColor(.optaTextMuted)
                            }
                            
                            Spacer()
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    } header: {
                        Text("Account")
                    }
                    
                    // Preferences Section
                    Section {
                        Toggle(isOn: $hapticFeedback) {
                            Label("Haptic Feedback", systemImage: "waveform")
                                .foregroundColor(.optaTextPrimary)
                        }
                        .tint(.optaPrimary)
                        .listRowBackground(Color.optaGlassBackground)

                        NavigationLink {
                            NotificationSettingsView()
                        } label: {
                            HStack {
                                Label("Notifications", systemImage: "bell.badge.fill")
                                    .foregroundColor(.optaTextPrimary)
                                Spacer()
                                Text(NotificationSettingsManager.shared.settings.masterEnabled ? "On" : "Off")
                                    .font(.caption)
                                    .foregroundColor(.optaTextMuted)
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    } header: {
                        Text("Preferences")
                    }
                    
                    // Siri Section
                    Section {
                        NavigationLink {
                            SiriSettingsView()
                        } label: {
                            Label("Siri Shortcuts", systemImage: "waveform.circle")
                                .foregroundColor(.optaTextPrimary)
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    } header: {
                        Text("Siri & Shortcuts")
                    }
                    
                    // Backend Section
                    Section {
                        HStack {
                            Label("Server", systemImage: "server.rack")
                                .foregroundColor(.optaTextPrimary)
                            
                            Spacer()
                            
                            Text("localhost:3000")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                        }
                        .listRowBackground(Color.optaGlassBackground)
                        
                        HStack {
                            Label("Status", systemImage: "circle.fill")
                                .foregroundColor(.optaTextPrimary)
                            
                            Spacer()
                            
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(Color.optaNeonGreen)
                                    .frame(width: 8, height: 8)
                                Text("Connected")
                                    .font(.caption)
                                    .foregroundColor(.optaNeonGreen)
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    } header: {
                        Text("Connection")
                    }
                    
                    // About Section
                    Section {
                        HStack {
                            Text("Version")
                                .foregroundColor(.optaTextPrimary)
                            Spacer()
                            Text("1.0.0")
                                .foregroundColor(.optaTextMuted)
                        }
                        .listRowBackground(Color.optaGlassBackground)
                        
                        Link(destination: URL(string: "https://github.com")!) {
                            HStack {
                                Text("Source Code")
                                    .foregroundColor(.optaTextPrimary)
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .foregroundColor(.optaTextMuted)
                            }
                        }
                        .listRowBackground(Color.optaGlassBackground)
                    } header: {
                        Text("About")
                    }
                    
                    // Sign Out
                    Section {
                        Button(role: .destructive) {
                            authManager.signOut()
                        } label: {
                            HStack {
                                Spacer()
                                Text("Sign Out")
                                Spacer()
                            }
                        }
                        .listRowBackground(Color.optaNeonRed.opacity(0.1))
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Settings")
        }
    }
}

struct SiriSettingsView: View {
    var body: some View {
        ZStack {
            Color.optaVoid
                .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 16) {
                        Image(systemName: "waveform.circle.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.optaPrimary)
                        
                        Text("Siri Shortcuts")
                            .font(.title2.bold())
                            .foregroundColor(.optaTextPrimary)
                        
                        Text("Use your voice to control Opta")
                            .font(.subheadline)
                            .foregroundColor(.optaTextSecondary)
                    }
                    .padding(.top, 20)
                    
                    // Shortcuts List
                    VStack(spacing: 12) {
                        ShortcutRow(
                            phrase: "Hey Siri, add a task to Opta",
                            description: "Create a new task"
                        )
                        
                        ShortcutRow(
                            phrase: "Hey Siri, what's on my Opta schedule?",
                            description: "Get your daily briefing"
                        )
                        
                        ShortcutRow(
                            phrase: "Hey Siri, ask Opta",
                            description: "Start a conversation with Opta AI"
                        )
                        
                        ShortcutRow(
                            phrase: "Hey Siri, Opta status",
                            description: "Quick status update"
                        )
                        
                        ShortcutRow(
                            phrase: "Hey Siri, schedule meeting in Opta",
                            description: "Create a calendar event"
                        )
                    }
                    .padding(.horizontal)
                    
                    // Add to Siri Button
                    Button {
                        // Open Siri settings
                    } label: {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Add to Siri")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.optaPrimary)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .padding(.horizontal)
                    .padding(.top, 12)
                    
                    Spacer()
                }
            }
        }
        .navigationTitle("Siri Shortcuts")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ShortcutRow: View {
    let phrase: String
    let description: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(phrase)
                .font(.subheadline.bold())
                .foregroundColor(.optaTextPrimary)
            
            Text(description)
                .font(.caption)
                .foregroundColor(.optaTextMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.optaGlassBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaGlassBorder, lineWidth: 1)
        )
    }
}

#Preview {
    SettingsView()
        .environmentObject(AuthManager.shared)
}
