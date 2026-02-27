//
//  SecurityManager.swift
//  OptaMolt
//
//  Privacy mode, auto-lock, connection security, and data wipe.
//

import Foundation
import SwiftUI
import Combine
import os.log
#if canImport(LocalAuthentication)
import LocalAuthentication
#endif

// MARK: - Privacy Manager

@MainActor
public final class PrivacyManager: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Security")
    public static let shared = PrivacyManager()
    
    /// When true, message previews are hidden throughout the app.
    @Published public var privacyModeEnabled: Bool {
        didSet { UserDefaults.standard.set(privacyModeEnabled, forKey: "optaplus.privacyMode") }
    }
    
    /// Auto-lock timeout in minutes (0 = disabled).
    @Published public var autoLockMinutes: Int {
        didSet { UserDefaults.standard.set(autoLockMinutes, forKey: "optaplus.autoLockMinutes") }
    }
    
    /// Whether the app is currently locked.
    @Published public var isLocked: Bool = false
    
    /// Last activity timestamp for auto-lock.
    private var lastActivityDate: Date = Date()
    private var lockTimer: Timer?
    
    private init() {
        self.privacyModeEnabled = UserDefaults.standard.bool(forKey: "optaplus.privacyMode")
        self.autoLockMinutes = UserDefaults.standard.integer(forKey: "optaplus.autoLockMinutes")
        startLockTimer()
    }
    
    // MARK: - Activity Tracking
    
    /// Call on any user interaction to reset auto-lock timer.
    public func recordActivity() {
        lastActivityDate = Date()
        if isLocked { return }
    }
    
    private func startLockTimer() {
        lockTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.checkAutoLock()
            }
        }
    }
    
    private func checkAutoLock() {
        guard autoLockMinutes > 0, !isLocked else { return }
        let elapsed = Date().timeIntervalSince(lastActivityDate)
        if elapsed >= Double(autoLockMinutes) * 60 {
            isLocked = true
        }
    }
    
    // MARK: - Biometric Unlock
    
    /// Attempt to unlock using biometrics (Touch ID / Face ID).
    public func unlock() {
        #if canImport(LocalAuthentication)
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            // Fallback to device passcode
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock OptaPlus") { success, _ in
                Task { @MainActor in
                    if success { self.isLocked = false }
                }
            }
            return
        }
        
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Unlock OptaPlus") { success, _ in
            Task { @MainActor in
                if success { self.isLocked = false }
            }
        }
        #else
        isLocked = false
        #endif
    }
    
    // MARK: - Privacy Helpers
    
    /// Returns masked or real text based on privacy mode.
    public func privacyText(_ text: String, placeholder: String = "•••") -> String {
        privacyModeEnabled ? placeholder : text
    }
    
    /// Returns masked message preview for notifications.
    public func notificationBody(botName: String, message: String) -> String {
        privacyModeEnabled ? "New message from \(botName)" : String(message.prefix(200))
    }
    
    // MARK: - Data Wipe
    
    /// Completely reset the app to first-launch state.
    public func wipeAllData() {
        // Clear Keychain
        SecureStorage.shared.deleteAll()
        
        // Clear UserDefaults
        if let bundleId = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: bundleId)
        }
        
        // Clear message store files
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        if let chatDir = appSupport?.appendingPathComponent("OptaPlus/ChatHistory") {
            try? FileManager.default.removeItem(at: chatDir)
        }
        
        Self.logger.info("All data wiped — app reset to first-launch state")
    }
}

// MARK: - Connection Security

/// Determines if a host is local or remote for security indicator.
public enum ConnectionSecurity {
    case local
    case remote
    
    public init(host: String) {
        let h = host.lowercased().trimmingCharacters(in: .whitespaces)
        if h == "127.0.0.1" || h == "localhost" || h == "::1" || h.hasSuffix(".local") {
            self = .local
        } else {
            self = .remote
        }
    }
    
    public var icon: String {
        switch self {
        case .local: return "lock.fill"
        case .remote: return "lock.open.fill"
        }
    }
    
    public var label: String {
        switch self {
        case .local: return "Local connection"
        case .remote: return "Remote connection — traffic may not be encrypted"
        }
    }
    
    public var color: Color {
        switch self {
        case .local: return .green
        case .remote: return .orange
        }
    }
}

// MARK: - Lock Screen View

public struct LockScreenView: View {
    @ObservedObject var privacyManager: PrivacyManager
    
    public init(privacyManager: PrivacyManager = .shared) {
        self.privacyManager = privacyManager
    }
    
    public var body: some View {
        ZStack {
            // Blurred background
            Color.black.opacity(0.85)
                .ignoresSafeArea()
            
            VStack(spacing: 24) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 48))
                    .foregroundColor(.white.opacity(0.7))
                
                Text("OptaPlus is Locked")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
                
                Button(action: { privacyManager.unlock() }) {
                    HStack(spacing: 8) {
                        Image(systemName: "faceid")
                            .font(.system(size: 16))
                        Text("Unlock")
                            .font(.system(size: 16, weight: .medium))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 14)
                    .background(
                        Capsule()
                            .fill(Color.purple.opacity(0.6))
                    )
                    .overlay(Capsule().stroke(Color.white.opacity(0.2), lineWidth: 1))
                }
            }
        }
    }
}

// MARK: - Connection Security Indicator

public struct ConnectionSecurityBadge: View {
    let host: String
    
    public init(host: String) {
        self.host = host
    }
    
    private var security: ConnectionSecurity {
        ConnectionSecurity(host: host)
    }
    
    public var body: some View {
        Image(systemName: security.icon)
            .font(.system(size: 11))
            .foregroundColor(security.color)
            .help(security.label)
    }
}
