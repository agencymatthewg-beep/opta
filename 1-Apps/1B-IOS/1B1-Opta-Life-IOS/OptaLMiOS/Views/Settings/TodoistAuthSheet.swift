import SwiftUI
import SafariServices

// MARK: - Todoist Auth Sheet

struct TodoistAuthSheet: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var todoistService = TodoistService.shared
    @State private var showSafari = false
    @State private var authURL: URL?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaVoid
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 32) {
                        // Header
                        headerSection

                        // Features
                        featuresSection

                        // Connect Button
                        if !todoistService.isAuthenticated {
                            connectButton
                        } else {
                            connectedSection
                        }

                        // Privacy Notice
                        privacySection

                        Spacer(minLength: 40)
                    }
                    .padding()
                }
            }
            .navigationTitle("Connect Todoist")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        HapticManager.shared.impact(.light)
                        dismiss()
                    }
                    .foregroundColor(.optaTextSecondary)
                }
            }
            .sheet(isPresented: $showSafari) {
                if let url = authURL {
                    SafariView(url: url)
                        .ignoresSafeArea()
                }
            }
            .overlay {
                if todoistService.isLoading {
                    loadingOverlay
                }
            }
            .alert("Error", isPresented: .constant(todoistService.lastError != nil)) {
                Button("OK") {
                    todoistService.lastError = nil
                }
            } message: {
                if let error = todoistService.lastError {
                    Text(error)
                }
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(spacing: 16) {
            // Todoist Logo
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(hex: "E44332").opacity(0.2),
                                Color(hex: "E44332").opacity(0.05)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 100, height: 100)

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 50))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                Color(hex: "E44332"),
                                Color(hex: "FF6B6B")
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
            .optaGlow(Color(hex: "E44332"), radius: 20)

            Text("Todoist Integration")
                .font(.title2.bold())
                .foregroundColor(.optaTextPrimary)

            Text("Connect your Todoist account to sync tasks directly")
                .font(.subheadline)
                .foregroundColor(.optaTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }

    // MARK: - Features Section

    private var featuresSection: some View {
        VStack(spacing: 12) {
            FeatureRow(
                icon: "arrow.triangle.2.circlepath",
                title: "Two-Way Sync",
                description: "Changes sync instantly between Opta and Todoist"
            )

            FeatureRow(
                icon: "wifi.slash",
                title: "Offline Support",
                description: "Work offline, changes sync when you're back online"
            )

            FeatureRow(
                icon: "arrow.merge",
                title: "Hybrid Mode",
                description: "Merge tasks from Todoist and Google Tasks"
            )

            FeatureRow(
                icon: "lock.shield.fill",
                title: "Secure OAuth",
                description: "Industry-standard OAuth 2.0 authentication"
            )
        }
    }

    // MARK: - Connect Button

    private var connectButton: some View {
        Button {
            HapticManager.shared.impact(.medium)
            initiateOAuth()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "link.circle.fill")
                    .font(.title3)

                Text("Connect Todoist Account")
                    .font(.headline)

                Spacer()

                Image(systemName: "arrow.right")
                    .font(.subheadline)
            }
            .foregroundColor(.white)
            .padding()
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(
                    colors: [
                        Color(hex: "E44332"),
                        Color(hex: "C73E2F")
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(12)
            .optaGlow(Color(hex: "E44332"), radius: 10)
        }
    }

    // MARK: - Connected Section

    private var connectedSection: some View {
        VStack(spacing: 16) {
            // Success indicator
            HStack(spacing: 12) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(.optaNeonGreen)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Connected")
                        .font(.headline)
                        .foregroundColor(.optaTextPrimary)

                    Text("Your Todoist account is linked")
                        .font(.caption)
                        .foregroundColor(.optaTextSecondary)
                }

                Spacer()
            }
            .padding()
            .background(Color.optaNeonGreen.opacity(0.1))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.optaNeonGreen.opacity(0.3), lineWidth: 1)
            )

            // Projects count
            if !todoistService.projects.isEmpty {
                HStack {
                    Image(systemName: "folder.fill")
                        .foregroundColor(.optaNeonBlue)

                    Text("\(todoistService.projects.count) projects synced")
                        .font(.subheadline)
                        .foregroundColor(.optaTextSecondary)

                    Spacer()
                }
                .padding(.horizontal)
            }

            // Disconnect button
            Button(role: .destructive) {
                HapticManager.shared.impact(.medium)
                disconnectTodoist()
            } label: {
                HStack {
                    Image(systemName: "link.badge.minus")
                    Text("Disconnect Account")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.optaNeonRed.opacity(0.1))
                .foregroundColor(.optaNeonRed)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.optaNeonRed.opacity(0.3), lineWidth: 1)
                )
            }
        }
    }

    // MARK: - Privacy Section

    private var privacySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "hand.raised.fill")
                    .font(.caption)
                    .foregroundColor(.optaNeonAmber)

                Text("Privacy & Security")
                    .font(.caption.bold())
                    .foregroundColor(.optaTextSecondary)
            }

            Text("Your Todoist credentials are never stored by Opta. Authentication uses OAuth 2.0, and your access token is securely stored in the iOS Keychain.")
                .font(.caption)
                .foregroundColor(.optaTextMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding()
        .background(Color.optaGlassBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaGlassBorder, lineWidth: 1)
        )
    }

    // MARK: - Loading Overlay

    private var loadingOverlay: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.optaPrimary)

                Text("Connecting to Todoist...")
                    .font(.subheadline)
                    .foregroundColor(.optaTextPrimary)
            }
            .padding(32)
            .background(Color.optaGlassBackground)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.optaGlassBorder, lineWidth: 1)
            )
        }
    }

    // MARK: - Actions

    private func initiateOAuth() {
        guard let url = todoistService.initiateOAuth() else {
            todoistService.lastError = "Failed to generate OAuth URL"
            return
        }

        authURL = url
        showSafari = true
    }

    private func disconnectTodoist() {
        todoistService.signOut()
        HapticManager.shared.notification(.success)
        dismiss()
    }
}

// MARK: - Feature Row

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.optaPrimary)
                .frame(width: 40, height: 40)
                .background(Color.optaPrimary.opacity(0.1))
                .cornerRadius(10)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.bold())
                    .foregroundColor(.optaTextPrimary)

                Text(description)
                    .font(.caption)
                    .foregroundColor(.optaTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()
        }
        .padding()
        .background(Color.optaGlassBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaGlassBorder, lineWidth: 1)
        )
    }
}

// MARK: - Safari View

struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let safari = SFSafariViewController(url: url)
        safari.preferredControlTintColor = UIColor(Color.optaPrimary)
        return safari
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {
        // No updates needed
    }
}

// MARK: - Preview

#Preview {
    TodoistAuthSheet()
}
