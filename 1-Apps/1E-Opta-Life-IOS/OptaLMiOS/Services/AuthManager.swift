import Foundation
import AuthenticationServices
import SwiftUI
import GoogleSignIn
import Supabase

// MARK: - Auth Manager

@MainActor
class AuthManager: NSObject, ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var error: String?
    @Published var showAppleSignInAlert = false
    @Published var showGoogleSignInAlert = false
    
    private let supabase = SupabaseService.shared.client

    var sessionToken: String? {
        KeychainHelper.get("opta_session_token")
    }

    override private init() {
        super.init()
        // Check for existing session on launch 
        Task {
            await checkExistingSession()
        }
    }

    // MARK: - Public Methods
    
    /// Sign in with Supabase Email/Password
    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil
        
        defer { isLoading = false }
        
        do {
            let session = try await supabase.auth.signIn(email: email, password: password)
            await handleSupabaseSession(session)
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    /// Sign up with Supabase
    func signUp(email: String, password: String, name: String) async {
        isLoading = true
        error = nil
        
        defer { isLoading = false }
        
        do {
            let response = try await supabase.auth.signUp(email: email, password: password, data: ["full_name": .string(name)])
            if let session = response.session {
                await handleSupabaseSession(session)
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func signInWithGoogle() {
        isLoading = true
        error = nil

        // Get the root view controller
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            isLoading = false
            error = "Unable to find root view controller"
            return
        }

        // Check if we have a valid client ID configured
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
              !clientID.isEmpty,
              !clientID.contains("YOUR_CLIENT_ID") else {
            isLoading = false
            showGoogleSignInAlert = true
            return
        }

        // Configure Google Sign-In
        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config

        // Perform sign-in
        GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController) { [weak self] result, error in
            Task { @MainActor in
                self?.isLoading = false

                if let error = error {
                    // Check if user cancelled
                    if (error as NSError).code == GIDSignInError.canceled.rawValue {
                        // User cancelled - not an error
                        return
                    }
                    self?.error = error.localizedDescription
                    return
                }

                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString else {
                    self?.error = "Failed to get user profile"
                    return
                }

                // Sign in to Supabase with Google ID Token
                do {
                    let session = try await self?.supabase.auth.signInWithIdToken(credentials: .init(provider: .google, idToken: idToken))
                    if let session = session {
                        await self?.handleSupabaseSession(session)
                    }
                } catch {
                    self?.error = "Supabase Auth failed: \(error.localizedDescription)"
                }
            }
        }
    }

    func signInWithApple() {
        // Sign in with Apple using Supabase native support
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.performRequests()
        isLoading = true
    }

    func skipAuthentication() {
        // For development/testing - skip auth
        isAuthenticated = true
        currentUser = User(
            id: "local_user",
            name: "Opta User",
            email: "user@opta.local",
            image: nil
        )
    }

    func signOut() {
        Task {
            try? await supabase.auth.signOut()
            
            // Clear stored data
            KeychainHelper.delete("opta_session_token")
            KeychainHelper.delete("opta_user_id")
            KeychainHelper.delete("opta_user_name")
            KeychainHelper.delete("opta_user_email")
            KeychainHelper.delete("opta_user_image")

            currentUser = nil
            isAuthenticated = false
            
            // Sign out from Google
            GIDSignIn.sharedInstance.signOut()
        }
    }

    func handleAuthCallback(token: String) {
        KeychainHelper.set(token, forKey: "opta_session_token")
        Task {
            await verifySession()
        }
    }

    /// Handle URL callback from Google Sign-In
    func handleURL(_ url: URL) -> Bool {
        return GIDSignIn.sharedInstance.handle(url)
    }

    /// Restore previous sign-in (call on app launch)
    func restorePreviousSignIn() async {
        // Supabase SDK handles session restoration automatically via its internal storage
        // but we'll verify it here
        await checkExistingSession()
    }

    // MARK: - Private Methods

    private func checkExistingSession() async {
        do {
            let session = try await supabase.auth.session
            await handleSupabaseSession(session)
        } catch {
            // No session or error
            isAuthenticated = false
        }
    }

    private func verifySession() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let session = try await supabase.auth.session
            await handleSupabaseSession(session)
        } catch {
            isAuthenticated = false
            self.error = error.localizedDescription
        }
    }

    private func handleSupabaseSession(_ session: Session) async {
        let user = session.user
        
        // Save to keychain for redundancy and existing logic compatibility
        KeychainHelper.set(session.accessToken, forKey: "opta_session_token")
        KeychainHelper.set(user.id.uuidString, forKey: "opta_user_id")
        
        let email = user.email ?? ""
        KeychainHelper.set(email, forKey: "opta_user_email")
        
        var name = "Opta User"
        let metadata = user.userMetadata
        if let fullName = metadata["full_name"] {
            name = String(describing: fullName)
        }
        KeychainHelper.set(name, forKey: "opta_user_name")
        
        self.currentUser = User(
            id: user.id.uuidString,
            name: name,
            email: email,
            image: nil // Can be fetched from metadata if available
        )
        self.isAuthenticated = true
        
        // Trigger Credential Sync
        Task {
            await OptaCredentialService.shared.pullCredentialsFromCloud()
            await OptaCredentialService.shared.syncLocalCredentialsToCloud()
        }
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AuthManager: ASAuthorizationControllerDelegate {
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        Task {
            do {
                switch authorization.credential {
                case let appleIDCredential as ASAuthorizationAppleIDCredential:
                    guard let idTokenData = appleIDCredential.identityToken,
                          let idToken = String(data: idTokenData, encoding: .utf8) else {
                        throw AuthError.invalidAppleToken
                    }
                    
                    let nonce = "" // nonce should be generated and verified if possible
                    
                    let session = try await supabase.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: idToken, nonce: nonce))
                    await handleSupabaseSession(session)
                    
                default:
                    break
                }
            } catch {
                self.error = "Apple Sign In failed: \(error.localizedDescription)"
                self.isLoading = false
            }
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        isLoading = false

        if let authError = error as? ASAuthorizationError {
            switch authError.code {
            case .canceled:
                break
            default:
                self.error = error.localizedDescription
            }
        } else {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - User Model

struct User: Codable {
    let id: String
    let name: String
    let email: String
    let image: String?
}

// MARK: - Auth Error

enum AuthError: LocalizedError {
    case todoistOAuthFailed
    case invalidAppleToken

    var errorDescription: String? {
        switch self {
        case .todoistOAuthFailed:
            return "Failed to initiate Todoist OAuth flow"
        case .invalidAppleToken:
            return "Invalid identity token from Apple"
        }
    }
}

// MARK: - Keychain Helper

enum KeychainHelper {
    static func set(_ value: String, forKey key: String) {
        guard let data = value.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]

        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }

        return string
    }

    static func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}
