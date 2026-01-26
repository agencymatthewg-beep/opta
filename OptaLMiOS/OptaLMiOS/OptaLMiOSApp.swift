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

    var body: some View {
        ZStack {
            Color.optaVoid
                .ignoresSafeArea()

            VStack(spacing: 40) {
                Spacer()

                // Logo & Title
                VStack(spacing: 20) {
                    EnhancedOptaRing(isActive: .constant(true), size: 140)

                    Text("Opta LM")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.white, .optaPrimaryGlow],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )

                    Text("Your AI Life Manager")
                        .font(.subheadline)
                        .foregroundColor(.optaTextSecondary)
                }

                Spacer()

                // Sign in buttons
                VStack(spacing: 16) {
                    // Sign in with Apple (native, works immediately)
                    Button {
                        HapticManager.shared.impact(.medium)
                        authManager.signInWithApple()
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "apple.logo")
                                .font(.title3)

                            Text("Continue with Apple")
                                .fontWeight(.medium)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.black)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.2), lineWidth: 1)
                        )
                    }
                    .disabled(authManager.isLoading)

                    // Google Sign In
                    Button {
                        HapticManager.shared.impact(.medium)
                        authManager.signInWithGoogle()
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "g.circle.fill")
                                .font(.title3)

                            Text("Continue with Google")
                                .fontWeight(.medium)
                        }
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.white)
                        .cornerRadius(12)
                    }
                    .disabled(authManager.isLoading)

                    // Manual setup option
                    Button {
                        HapticManager.shared.impact(.light)
                        authManager.skipAuthentication()
                    } label: {
                        Text("Continue without account")
                            .font(.subheadline)
                            .foregroundColor(.optaTextMuted)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 60)

                // Loading overlay
                if authManager.isLoading {
                    LoadingOverlay(message: "Signing in...")
                }
            }
        }
        .alert("Google Sign-In Setup Required", isPresented: $authManager.showGoogleSignInAlert) {
            Button("Continue Without Account") {
                authManager.skipAuthentication()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Google Sign-In requires OAuth configuration in Google Cloud Console. Continue without an account for now.")
        }
        .alert("Apple Sign-In Unavailable", isPresented: $authManager.showAppleSignInAlert) {
            Button("Continue Without Account") {
                authManager.skipAuthentication()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Sign in with Apple requires an Apple Developer Program membership. Continue without an account for now.")
        }
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
