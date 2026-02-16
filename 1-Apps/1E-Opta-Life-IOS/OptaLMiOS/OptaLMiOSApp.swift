import SwiftUI

@main
struct OptaLMiOSApp: App {
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var apiService = APIService.shared
    @StateObject private var onboardingManager = OnboardingManager.shared
    @StateObject private var networkMonitor = NetworkMonitor.shared
    @State private var selectedTab = 0
    
    var body: some Scene {
        WindowGroup {
            Group {
                if !onboardingManager.hasCompletedOnboarding {
                    OnboardingView(hasCompletedOnboarding: $onboardingManager.hasCompletedOnboarding)
                } else if !authManager.isAuthenticated {
                    LoginView()
                } else {
                    MainTabView(selectedTab: $selectedTab)
                        .overlay(
                            // Offline indicator
                            Group {
                                if !networkMonitor.isConnected {
                                    OfflineBanner()
                                        .transition(.move(edge: .top).combined(with: .opacity))
                                }
                            },
                            alignment: .top
                        )
                }
            }
            .environmentObject(authManager)
            .environmentObject(apiService)
            .environmentObject(onboardingManager)
            .preferredColorScheme(.dark)
            .onAppear {
                setupAppearance()
                NotificationManager.shared.requestPermission()
                // Initialize notification delegate
                _ = NotificationDelegateHandler.shared
            }
            .onOpenURL { url in
                // Handle Google Sign-In callback
                _ = authManager.handleURL(url)
                // TodoistService temporarily disabled
                /*
                if !authManager.handleURL(url) {
                    // Check if it's a Todoist OAuth callback
                    if TodoistService.isOAuthCallback(url),
                       let code = TodoistService.extractCode(from: url) {
                        Task {
                            await authManager.handleTodoistCallback(code: code)
                        }
                    }
                }
                */
            }
            .task {
                // Restore previous Google Sign-In on app launch
                await authManager.restorePreviousSignIn()

                // Schedule daily briefing at preferred time
                await scheduleDailyBriefing()
            }
        }
    }
    
    private func setupAppearance() {
        // Tab bar appearance
        let tabBarAppearance = UITabBarAppearance()
        tabBarAppearance.configureWithOpaqueBackground()
        tabBarAppearance.backgroundColor = UIColor(Color.optaVoid)
        tabBarAppearance.stackedLayoutAppearance.selected.iconColor = UIColor(Color.optaPrimary)
        tabBarAppearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor(Color.optaPrimary)]
        tabBarAppearance.stackedLayoutAppearance.normal.iconColor = UIColor(Color.optaTextMuted)
        tabBarAppearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: UIColor(Color.optaTextMuted)]
        
        UITabBar.appearance().standardAppearance = tabBarAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabBarAppearance
        
        // Navigation bar appearance
        let navBarAppearance = UINavigationBarAppearance()
        navBarAppearance.configureWithOpaqueBackground()
        navBarAppearance.backgroundColor = UIColor(Color.optaVoid)
        navBarAppearance.titleTextAttributes = [.foregroundColor: UIColor.white]
        navBarAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor.white]
        
        UINavigationBar.appearance().standardAppearance = navBarAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navBarAppearance
        UINavigationBar.appearance().compactAppearance = navBarAppearance
        
        // Table view & scroll view
        UITableView.appearance().backgroundColor = UIColor(Color.optaVoid)
        UITableViewCell.appearance().backgroundColor = UIColor(Color.optaVoid)
    }

    private func scheduleDailyBriefing() async {
        // Get briefing time from user preferences
        let briefingTime = await MainActor.run { UserPreferences.shared.briefingTime }

        // Schedule daily briefing notification
        await MainActor.run {
            NotificationManager.shared.scheduleDailyBriefing(at: briefingTime)
        }

        print("[OptaLM] Daily briefing scheduled for: \(briefingTime)")
    }
}

// MARK: - Main Tab View

struct MainTabView: View {
    @Binding var selectedTab: Int
    
    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "square.grid.2x2")
                }
                .tag(0)
            
            OptaChatView()
                .tabItem {
                    Label("Opta", systemImage: "sparkles")
                }
                .tag(1)
            
            TasksListView()
                .tabItem {
                    Label("Tasks", systemImage: "checklist")
                }
                .tag(2)
            
            CalendarListView()
                .tabItem {
                    Label("Schedule", systemImage: "calendar")
                }
                .tag(3)
            
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
                .tag(4)
        }
        .tint(.optaPrimary)
        .onAppear {
            HapticManager.shared.impact(.light)
        }
        .onChange(of: selectedTab) { _, _ in
            HapticManager.shared.selection()
        }
    }
}

// MARK: - Offline Banner

struct OfflineBanner: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash")
                .font(.caption)
            
            Text("You're offline. Some features may be limited.")
                .font(.caption)
        }
        .foregroundColor(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity)
        .background(Color.optaNeonAmber.opacity(0.9))
    }
}

// MARK: - Login View

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var isSignUp = false

    var body: some View {
        ZStack {
            Color.optaVoid
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 32) {
                    // Logo & Title
                    VStack(spacing: 16) {
                        EnhancedOptaRing(isActive: .constant(true), size: 100)

                        Text("Opta LM")
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.white, .optaPrimaryGlow],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )

                        Text(isSignUp ? "Create your account" : "Welcome back")
                            .font(.headline)
                            .foregroundColor(.optaTextSecondary)
                    }
                    .padding(.top, 40)

                    // Email/Password Form
                    VStack(spacing: 16) {
                        if isSignUp {
                            TextField("Full Name", text: $name)
                                .textFieldStyle(OptaTextFieldStyle())
                                .textContentType(.name)
                        }

                        TextField("Email Address", text: $email)
                            .textFieldStyle(OptaTextFieldStyle())
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .textContentType(.emailAddress)

                        SecureField("Password", text: $password)
                            .textFieldStyle(OptaTextFieldStyle())
                            .textContentType(isSignUp ? .newPassword : .password)

                        Button {
                            HapticManager.shared.impact(.medium)
                            Task {
                                if isSignUp {
                                    await authManager.signUp(email: email, password: password, name: name)
                                } else {
                                    await authManager.signIn(email: email, password: password)
                                }
                            }
                        } label: {
                            Text(isSignUp ? "Create Account" : "Sign In")
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(Color.optaPrimary)
                                .cornerRadius(12)
                        }
                        .disabled(email.isEmpty || password.isEmpty || (isSignUp && name.isEmpty) || authManager.isLoading)

                        Button {
                            withAnimation {
                                isSignUp.toggle()
                            }
                        } label: {
                            Text(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Create one")
                                .font(.subheadline)
                                .foregroundColor(.optaPrimary)
                        }
                    }
                    .padding(.horizontal, 24)

                    // Divider
                    HStack {
                        Rectangle()
                            .fill(Color.white.opacity(0.1))
                            .frame(height: 1)
                        Text("OR")
                            .font(.caption2)
                            .foregroundColor(.optaTextMuted)
                        Rectangle()
                            .fill(Color.white.opacity(0.1))
                            .frame(height: 1)
                    }
                    .padding(.horizontal, 24)

                    // Social Sign in buttons
                    VStack(spacing: 16) {
                        Button {
                            HapticManager.shared.impact(.medium)
                            authManager.signInWithApple()
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "apple.logo")
                                Text("Continue with Apple")
                                    .fontWeight(.medium)
                            }
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.black)
                            .cornerRadius(12)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.2), lineWidth: 1))
                        }
                        .disabled(authManager.isLoading)

                        Button {
                            HapticManager.shared.impact(.medium)
                            authManager.signInWithGoogle()
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "g.circle.fill")
                                Text("Continue with Google")
                                    .fontWeight(.medium)
                            }
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.white)
                            .cornerRadius(12)
                        }
                        .disabled(authManager.isLoading)

                        Button {
                            authManager.skipAuthentication()
                        } label: {
                            Text("Continue Offline")
                                .font(.subheadline)
                                .foregroundColor(.optaTextMuted)
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 40)
                }
            }

            // Loading overlay
            if authManager.isLoading {
                LoadingOverlay(message: isSignUp ? "Creating account..." : "Signing in...")
            }
        }
        .alert("Auth Error", isPresented: .init(get: { authManager.error != nil }, set: { _ in authManager.error = nil })) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(authManager.error ?? "")
        }
    }
}

// Simple text field style
struct OptaTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding()
            .background(Color.white.opacity(0.05))
            .cornerRadius(10)
            .foregroundColor(.white)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.1), lineWidth: 1))
    }
}

// MARK: - App Icon Badge Extension

extension UIApplication {
    func setAppBadge(_ count: Int) {
        UNUserNotificationCenter.current().setBadgeCount(count)
    }
}

#Preview("Main App") {
    MainTabView(selectedTab: .constant(0))
        .environmentObject(AuthManager.shared)
        .environmentObject(APIService.shared)
        .environmentObject(OnboardingManager.shared)
}

#Preview("Login") {
    LoginView()
        .environmentObject(AuthManager.shared)
}
