//
//  TelegramAuthView.swift
//  OptaPlusMacOS
//
//  Settings pane for Telegram authentication.
//  Drives the TelegramSyncManager auth state machine:
//  Disconnected → Phone Input → Code Input → (Optional) Password → Connected.
//

#if canImport(TDLibKit)
import SwiftUI
import OptaMolt
import OptaPlus

// MARK: - Telegram Auth View

struct TelegramAuthView: View {
    @ObservedObject var manager: TelegramSyncManager
    @EnvironmentObject var appState: AppState

    @State private var phoneNumber = ""
    @State private var verificationCode = ""
    @State private var password = ""
    @State private var apiIdText = ""
    @State private var apiHashText = ""
    @State private var isWorking = false
    @State private var localError: String?

    // Keychain keys for Telegram API credentials
    private static let apiIdKey = "optaplus.telegram.apiId"
    private static let apiHashKey = "optaplus.telegram.apiHash"

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header
                HStack(spacing: 10) {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.optaBlue, .optaPrimary],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Telegram Sync")
                            .font(.sora(15, weight: .semibold))
                            .foregroundColor(.optaTextPrimary)

                        Text("Bidirectional sync with @Opta_Bot")
                            .font(.sora(11))
                            .foregroundColor(.optaTextMuted)
                    }

                    Spacer()

                    statusBadge
                }

                Divider().background(Color.optaBorder)

                // Content based on auth state
                switch manager.authState {
                case .uninitialized:
                    apiCredentialsForm

                case .awaitingPhoneNumber:
                    phoneNumberForm

                case .awaitingCode:
                    verificationCodeForm

                case .awaitingPassword:
                    passwordForm

                case .ready:
                    connectedView

                case .loggingOut:
                    ProgressView("Logging out…")
                        .foregroundColor(.optaTextSecondary)

                case .error(let message):
                    errorView(message)
                }

                // Local error display
                if let error = localError {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.optaAmber)
                            .font(.system(size: 12))
                        Text(error)
                            .font(.sora(11))
                            .foregroundColor(.optaAmber)
                    }
                    .padding(8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.optaAmber.opacity(0.1))
                    )
                }

                Spacer()
            }
            .padding()
        }
        .frame(maxWidth: .infinity)
        .onAppear {
            migrateTelegramCredsFromUserDefaultsIfNeeded()
            apiIdText = SecureStorage.shared.load(key: Self.apiIdKey) ?? ""
            apiHashText = SecureStorage.shared.load(key: Self.apiHashKey) ?? ""
        }
        .onChange(of: manager.authState) { _ in
            localError = nil
        }
    }

    // MARK: - Status Badge

    private var statusBadge: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(statusColor)
                .frame(width: 6, height: 6)
            Text(statusText)
                .font(.sora(10, weight: .medium))
                .foregroundColor(statusColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(
            Capsule()
                .fill(statusColor.opacity(0.15))
        )
    }

    private var statusColor: Color {
        switch manager.authState {
        case .ready: return .optaGreen
        case .error: return .optaRed
        case .loggingOut: return .optaAmber
        case .uninitialized: return .optaTextMuted
        default: return .optaBlue
        }
    }

    private var statusText: String {
        switch manager.authState {
        case .uninitialized: return "Not Connected"
        case .awaitingPhoneNumber: return "Awaiting Phone"
        case .awaitingCode: return "Awaiting Code"
        case .awaitingPassword: return "Awaiting 2FA"
        case .ready: return "Connected"
        case .loggingOut: return "Logging Out"
        case .error: return "Error"
        }
    }

    // MARK: - API Credentials Form

    private var apiCredentialsForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TELEGRAM API CREDENTIALS")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(.optaTextMuted)

            Text("Get these from my.telegram.org → API development tools.")
                .font(.sora(11))
                .foregroundColor(.optaTextMuted)

            LabeledField("API ID", text: $apiIdText, placeholder: "12345678")
            LabeledField("API Hash", text: $apiHashText, placeholder: "abc123def456...")

            Button(action: initializeTelegram) {
                HStack(spacing: 6) {
                    if isWorking {
                        ProgressView()
                            .scaleEffect(0.7)
                    }
                    Text("Connect to Telegram")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .tint(.optaBlue)
            .disabled(apiIdText.isEmpty || apiHashText.isEmpty || isWorking)
        }
    }

    // MARK: - Phone Number Form

    private var phoneNumberForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("PHONE NUMBER")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(.optaTextMuted)

            Text("Enter your phone number with country code (e.g., +61...).")
                .font(.sora(11))
                .foregroundColor(.optaTextMuted)

            LabeledField("Phone", text: $phoneNumber, placeholder: "+61...")

            Button(action: submitPhone) {
                HStack(spacing: 6) {
                    if isWorking { ProgressView().scaleEffect(0.7) }
                    Text("Send Code")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .tint(.optaBlue)
            .disabled(phoneNumber.isEmpty || isWorking)
        }
    }

    // MARK: - Verification Code Form

    private var verificationCodeForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("VERIFICATION CODE")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(.optaTextMuted)

            Text("Check your Telegram app or SMS for the code.")
                .font(.sora(11))
                .foregroundColor(.optaTextMuted)

            LabeledField("Code", text: $verificationCode, placeholder: "12345")

            Button(action: submitCode) {
                HStack(spacing: 6) {
                    if isWorking { ProgressView().scaleEffect(0.7) }
                    Text("Verify")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .tint(.optaBlue)
            .disabled(verificationCode.isEmpty || isWorking)
        }
    }

    // MARK: - Password Form (2FA)

    private var passwordForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TWO-FACTOR AUTHENTICATION")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(.optaTextMuted)

            Text("Your account has 2FA enabled. Enter your cloud password.")
                .font(.sora(11))
                .foregroundColor(.optaTextMuted)

            VStack(alignment: .leading, spacing: 4) {
                Text("Password")
                    .font(.sora(11, weight: .medium))
                    .foregroundColor(.optaTextMuted)

                SecureField("Cloud password", text: $password)
                    .textFieldStyle(.plain)
                    .font(.sora(13))
                    .foregroundColor(.optaTextPrimary)
                    .padding(8)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.optaElevated)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.optaBorder, lineWidth: 1)
                    )
            }

            Button(action: submitPassword) {
                HStack(spacing: 6) {
                    if isWorking { ProgressView().scaleEffect(0.7) }
                    Text("Submit")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .tint(.optaBlue)
            .disabled(password.isEmpty || isWorking)
        }
    }

    // MARK: - Connected View

    private var connectedView: some View {
        VStack(spacing: 16) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.optaGreen)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Telegram Connected")
                        .font(.sora(14, weight: .semibold))
                        .foregroundColor(.optaTextPrimary)

                    if let phone = manager.connectedPhone {
                        Text(phone)
                            .font(.sora(11))
                            .foregroundColor(.optaTextMuted)
                    }
                }

                Spacer()
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.optaGreen.opacity(0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.optaGreen.opacity(0.2), lineWidth: 1)
            )

            Text("Messages sent in synced sessions will be mirrored to @Opta_Bot on Telegram.")
                .font(.sora(11))
                .foregroundColor(.optaTextMuted)
                .multilineTextAlignment(.center)

            Button(action: disconnectTelegram) {
                Text("Disconnect")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.bordered)
            .tint(.optaRed)
        }
    }

    // MARK: - Error View

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.optaRed)

                Text(message)
                    .font(.sora(12))
                    .foregroundColor(.optaTextSecondary)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.optaRed.opacity(0.08))
            )

            Button("Retry") {
                initializeTelegram()
            }
            .buttonStyle(.borderedProminent)
            .tint(.optaBlue)
        }
    }

    // MARK: - Actions

    private func initializeTelegram() {
        guard let apiId = Int32(apiIdText), apiId > 0, !apiHashText.isEmpty else {
            localError = "Invalid API ID or Hash"
            return
        }

        localError = nil
        isWorking = true
        SecureStorage.shared.save(key: Self.apiIdKey, value: apiIdText)
        SecureStorage.shared.save(key: Self.apiHashKey, value: apiHashText)

        Task {
            // Re-create the manager with validated credentials
            // (the placeholder manager may have apiId: 0)
            appState.initializeTelegramIfNeeded()
            if let tg = appState.telegramManager {
                await tg.initialize()
            }
            isWorking = false
        }
    }

    private func submitPhone() {
        isWorking = true
        localError = nil
        Task {
            do {
                try await manager.setPhoneNumber(phoneNumber)
            } catch {
                localError = error.localizedDescription
            }
            isWorking = false
        }
    }

    private func submitCode() {
        isWorking = true
        localError = nil
        Task {
            do {
                try await manager.submitCode(verificationCode)
            } catch {
                localError = error.localizedDescription
            }
            isWorking = false
        }
    }

    private func submitPassword() {
        isWorking = true
        localError = nil
        Task {
            do {
                try await manager.submitPassword(password)
            } catch {
                localError = error.localizedDescription
            }
            isWorking = false
        }
    }

    /// One-time migration: move Telegram API creds from UserDefaults to Keychain.
    private func migrateTelegramCredsFromUserDefaultsIfNeeded() {
        let legacyApiId = UserDefaults.standard.string(forKey: Self.apiIdKey)
        let legacyApiHash = UserDefaults.standard.string(forKey: Self.apiHashKey)

        if let id = legacyApiId, !id.isEmpty {
            SecureStorage.shared.save(key: Self.apiIdKey, value: id)
            UserDefaults.standard.removeObject(forKey: Self.apiIdKey)
        }
        if let hash = legacyApiHash, !hash.isEmpty {
            SecureStorage.shared.save(key: Self.apiHashKey, value: hash)
            UserDefaults.standard.removeObject(forKey: Self.apiHashKey)
        }
        if legacyApiId != nil || legacyApiHash != nil {
            NSLog("[TelegramAuthView] Migrated Telegram API credentials from UserDefaults to Keychain")
        }
    }

    private func disconnectTelegram() {
        Task {
            await manager.disconnect()
            phoneNumber = ""
            verificationCode = ""
            password = ""
        }
    }
}

#endif
