import Foundation
import AuthenticationServices
import SwiftUI
import GoogleSignIn

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
                      let profile = user.profile else {
                    self?.error = "Failed to get user profile"
                    return
                }

                // Save user data
                self?.saveGoogleUser(
                    userId: user.userID ?? UUID().uuidString,
                    name: profile.name,
                    email: profile.email,
                    imageURL: profile.imageURL(withDimension: 200)?.absoluteString
                )
            }
        }
    }

    func signInWithApple() {
        // Sign in with Apple requires Apple Developer Program membership
        // For personal/free developer accounts, show an alert
        showAppleSignInAlert = true

        // Uncomment below when using a paid Apple Developer account:
        // let provider = ASAuthorizationAppleIDProvider()
        // let request = provider.createRequest()
        // request.requestedScopes = [.fullName, .email]
        // let controller = ASAuthorizationController(authorizationRequests: [request])
        // controller.delegate = self
        // controller.performRequests()
        // isLoading = true
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
        // Sign out from Google
        GIDSignIn.sharedInstance.signOut()

        // Clear stored data
        KeychainHelper.delete("opta_session_token")
        KeychainHelper.delete("opta_user_id")
        KeychainHelper.delete("opta_user_name")
        KeychainHelper.delete("opta_user_email")
        KeychainHelper.delete("opta_user_image")

        currentUser = nil
        isAuthenticated = false
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
        // Try to restore Google Sign-In
        if GIDSignIn.sharedInstance.hasPreviousSignIn() {
            do {
                let user = try await GIDSignIn.sharedInstance.restorePreviousSignIn()
                if let profile = user.profile {
                    saveGoogleUser(
                        userId: user.userID ?? UUID().uuidString,
                        name: profile.name,
                        email: profile.email,
                        imageURL: profile.imageURL(withDimension: 200)?.absoluteString
                    )
                }
            } catch {
                // Restoration failed - check local storage
                await checkExistingSession()
            }
        } else {
            await checkExistingSession()
        }
    }

    // MARK: - Private Methods

    private func checkExistingSession() async {
        // Check if we have a stored user ID (local auth)
        if let userId = KeychainHelper.get("opta_user_id") {
            currentUser = User(
                id: userId,
                name: KeychainHelper.get("opta_user_name") ?? "Opta User",
                email: KeychainHelper.get("opta_user_email") ?? "",
                image: KeychainHelper.get("opta_user_image")
            )
            isAuthenticated = true
            return
        }

        // Check for API session token
        guard sessionToken != nil else {
            isAuthenticated = false
            return
        }

        await verifySession()
    }

    private func verifySession() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let isValid = try await APIService.shared.verifyAuth()
            isAuthenticated = isValid
        } catch {
            // If API verification fails, check for local auth
            if KeychainHelper.get("opta_user_id") != nil {
                isAuthenticated = true
            } else {
                isAuthenticated = false
                self.error = error.localizedDescription
            }
        }
    }

    private func saveGoogleUser(userId: String, name: String, email: String, imageURL: String?) {
        KeychainHelper.set(userId, forKey: "opta_user_id")
        KeychainHelper.set(name, forKey: "opta_user_name")
        KeychainHelper.set(email, forKey: "opta_user_email")
        if let imageURL = imageURL {
            KeychainHelper.set(imageURL, forKey: "opta_user_image")
        }

        currentUser = User(
            id: userId,
            name: name,
            email: email,
            image: imageURL
        )
        isAuthenticated = true
    }

    private func saveAppleUser(userId: String, fullName: PersonNameComponents?, email: String?) {
        KeychainHelper.set(userId, forKey: "opta_user_id")

        var name = "Opta User"
        if let fullName = fullName {
            let firstName = fullName.givenName ?? ""
            let lastName = fullName.familyName ?? ""
            name = "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
            if name.isEmpty { name = "Opta User" }
        }
        KeychainHelper.set(name, forKey: "opta_user_name")

        if let email = email {
            KeychainHelper.set(email, forKey: "opta_user_email")
        }

        currentUser = User(
            id: userId,
            name: name,
            email: email ?? "",
            image: nil
        )
        isAuthenticated = true
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AuthManager: ASAuthorizationControllerDelegate {
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        isLoading = false

        switch authorization.credential {
        case let appleIDCredential as ASAuthorizationAppleIDCredential:
            let userId = appleIDCredential.user
            let fullName = appleIDCredential.fullName
            let email = appleIDCredential.email

            saveAppleUser(userId: userId, fullName: fullName, email: email)

        default:
            break
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        isLoading = false

        if let authError = error as? ASAuthorizationError {
            switch authError.code {
            case .canceled:
                // User canceled - not an error
                break
            case .failed:
                self.error = "Sign in failed. Please try again."
            case .invalidResponse:
                self.error = "Invalid response from Apple."
            case .notHandled:
                self.error = "Sign in was not handled."
            case .unknown:
                self.error = "An unknown error occurred."
            case .notInteractive:
                self.error = "Sign in requires interaction."
            @unknown default:
                self.error = "Sign in failed."
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
