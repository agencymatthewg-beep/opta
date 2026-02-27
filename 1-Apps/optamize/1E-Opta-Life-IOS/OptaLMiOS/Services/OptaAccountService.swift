//
//  OptaAccountService.swift
//  OptaLMiOS
//
//  Handles authentication and account management for Opta Accounts.
//  Uses Supabase Auth for email, Google, and Apple Sign In.
//

import Foundation
import AuthenticationServices
import CryptoKit
import GoogleSignIn
import Supabase

@MainActor
class OptaAccountService: NSObject, ObservableObject {
    static let shared = OptaAccountService()
    
    // MARK: - Published State
    
    @Published var session: Session?
    @Published var user: User?
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let supabase = SupabaseService.shared.client
    private var currentNonce: String?
    
    override private init() {
        super.init()
        Task {
            await initializeSession()
        }
    }
    
    // MARK: - Initialization
    
    private func initializeSession() async {
        do {
            // Check for existing session
            self.session = try await supabase.auth.session
            self.user = self.session?.user
            self.isAuthenticated = (self.session != nil)
            
            // Listen for auth state changes
            for await state in supabase.auth.authStateChanges {
                self.session = state.session
                self.user = state.session?.user
                self.isAuthenticated = (state.session != nil)
                
                if let session = state.session {
                    // Sync credentials on login
                    await OptaCredentialService.shared.pullCredentialsFromCloud()
                }
            }
        } catch {
            print("OptaAccountService: No existing session found.")
            self.isAuthenticated = false
        }
    }
    
    // MARK: - Sign In with Apple
    
    func signInWithApple() {
        isLoading = true
        errorMessage = nil
        
        let nonce = randomNonceString()
        currentNonce = nonce
        
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)
        
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.performRequests()
    }
    
    // MARK: - Sign In with Google
    
    func signInWithGoogle(presenting viewController: UIViewController? = nil) {
        isLoading = true
        errorMessage = nil
        
        let rootViewController: UIViewController?
        
        if let viewController = viewController {
            rootViewController = viewController
        } else {
            // Attempt to find root view controller
            rootViewController = UIApplication.shared.connectedScenes
                .filter({ $0.activationState == .foregroundActive })
                .compactMap({ $0 as? UIWindowScene })
                .first?.windows
                .filter({ $0.isKeyWindow }).first?.rootViewController
        }
        
        guard let presentingVC = rootViewController else {
            self.errorMessage = "Unable to find root view controller."
            self.isLoading = false
            return
        }
        
        // Ensure Google Client ID is configured in Info.plist
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String else {
            self.errorMessage = "Google Client ID not configured."
            self.isLoading = false
            return
        }
        
        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config
        
        GIDSignIn.sharedInstance.signIn(withPresenting: presentingVC) { [weak self] result, error in
            guard let self = self else { return }
            
            if let error = error {
                self.isLoading = false
                if (error as NSError).code == GIDSignInError.canceled.rawValue {
                    return
                }
                self.errorMessage = error.localizedDescription
                return
            }
            
            guard let user = result?.user,
                  let idToken = user.idToken?.tokenString else {
                self.isLoading = false
                self.errorMessage = "Failed to get Google ID Token."
                return
            }
            
            Task {
                do {
                    // Exchange Google ID Token for Supabase Session
                    try await self.supabase.auth.signInWithIdToken(credentials: .init(provider: .google, idToken: idToken))
                    self.isLoading = false
                } catch {
                    self.errorMessage = "Supabase Google Sign In failed: \(error.localizedDescription)"
                    self.isLoading = false
                }
            }
        }
    }
    
    // MARK: - URL Handling
    
    func handleURL(_ url: URL) -> Bool {
        return GIDSignIn.sharedInstance.handle(url)
    }
    
    // MARK: - Sign Out
    
    func signOut() {
        Task {
            do {
                try await supabase.auth.signOut()
                self.session = nil
                self.user = nil
                self.isAuthenticated = false
            } catch {
                self.errorMessage = "Sign out failed: \(error.localizedDescription)"
            }
        }
    }
    
    // MARK: - Helpers (Nonce)
    
    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        var randomBytes = [UInt8](repeating: 0, count: length)
        let errorCode = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
        if errorCode != errSecSuccess {
            fatalError("Unable to generate nonce. SecRandomCopyBytes failed with OSStatus \(errorCode)")
        }
        
        let charset: [Character] =
            Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        
        let nonce = randomBytes.map { byte in
            // Pick a random character from the set, wrapping around if needed.
            charset[Int(byte) % charset.count]
        }
        
        return String(nonce)
    }
    
    private func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        let hashString = hashedData.compactMap {
            return String(format: "%02x", $0)
        }.joined()
        
        return hashString
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension OptaAccountService: ASAuthorizationControllerDelegate {
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        if let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential {
            guard let nonce = currentNonce else {
                fatalError("Invalid state: A login callback was received, but no login request was sent.")
            }
            
            guard let appleIDToken = appleIDCredential.identityToken else {
                print("Unable to fetch identity token")
                self.errorMessage = "Unable to fetch identity token."
                self.isLoading = false
                return
            }
            
            guard let idTokenString = String(data: appleIDToken, encoding: .utf8) else {
                print("Unable to serialize token string from data: \(appleIDToken.debugDescription)")
                self.errorMessage = "Unable to serialize token string."
                self.isLoading = false
                return
            }
            
            Task {
                do {
                    // Exchange Apple ID Token + Nonce for Supabase Session
                    try await supabase.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: idTokenString, nonce: nonce))
                    self.isLoading = false
                } catch {
                    self.errorMessage = "Supabase Apple Sign In failed: \(error.localizedDescription)"
                    self.isLoading = false
                }
            }
        }
    }
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        self.isLoading = false
        // Handle error.
        print("Sign in with Apple errored: \(error)")
        self.errorMessage = error.localizedDescription
    }
}
