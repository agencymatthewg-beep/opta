import SwiftUI

// MARK: - Onboarding View

struct OnboardingView: View {
    @Binding var hasCompletedOnboarding: Bool
    @State private var currentPage = 0
    
    let pages: [OnboardingPage] = [
        OnboardingPage(
            icon: "sparkles",
            iconColor: .optaPrimary,
            title: "Meet Opta LM",
            subtitle: "Your AI-Powered Life Manager",
            description: "Opta LM intelligently manages your tasks, calendar, emails, and more — all in one place."
        ),
        OnboardingPage(
            icon: "checklist",
            iconColor: .optaNeonGreen,
            title: "Smart Task Management",
            subtitle: "Powered by Todoist",
            description: "Add, complete, and organize tasks with voice commands or natural language. Opta prioritizes what matters most."
        ),
        OnboardingPage(
            icon: "calendar",
            iconColor: .optaNeonBlue,
            title: "Calendar Intelligence",
            subtitle: "Google Calendar Sync",
            description: "View your schedule, create events, and get smart suggestions for optimal time management."
        ),
        OnboardingPage(
            icon: "waveform.circle",
            iconColor: .optaNeonCyan,
            title: "Hey Siri, Ask Opta",
            subtitle: "Deep Siri Integration",
            description: "Control everything with your voice. \"Add a task\", \"What's on my schedule?\", \"Quick status\" and more."
        ),
        OnboardingPage(
            icon: "square.grid.2x2",
            iconColor: .optaNeonAmber,
            title: "Widgets Everywhere",
            subtitle: "Home & Lock Screen",
            description: "Stay informed with beautiful widgets showing tasks, events, and your daily briefing at a glance."
        )
    ]
    
    var body: some View {
        ZStack {
            Color.optaVoid
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Skip button
                HStack {
                    Spacer()
                    
                    if currentPage < pages.count - 1 {
                        Button("Skip") {
                            completeOnboarding()
                        }
                        .font(.subheadline)
                        .foregroundColor(.optaTextMuted)
                    }
                }
                .padding()
                
                // Page content
                TabView(selection: $currentPage) {
                    ForEach(0..<pages.count, id: \.self) { index in
                        OnboardingPageView(page: pages[index])
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                
                // Page indicators
                HStack(spacing: 8) {
                    ForEach(0..<pages.count, id: \.self) { index in
                        Capsule()
                            .fill(currentPage == index ? Color.optaPrimary : Color.optaGlassBorder)
                            .frame(width: currentPage == index ? 24 : 8, height: 8)
                            .animation(.spring(response: 0.3), value: currentPage)
                    }
                }
                .padding(.bottom, 40)
                
                // Action button
                Button {
                    HapticManager.shared.impact(.medium)
                    if currentPage < pages.count - 1 {
                        withAnimation(.spring(response: 0.3)) {
                            currentPage += 1
                        }
                    } else {
                        completeOnboarding()
                    }
                } label: {
                    HStack {
                        Text(currentPage < pages.count - 1 ? "Continue" : "Get Started")
                            .fontWeight(.semibold)
                        
                        if currentPage == pages.count - 1 {
                            Image(systemName: "arrow.right")
                        }
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(
                        LinearGradient(
                            colors: [.optaPrimary, .optaPrimary.opacity(0.8)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(16)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
            }
        }
    }
    
    private func completeOnboarding() {
        HapticManager.shared.notification(.success)
        withAnimation(.easeInOut(duration: 0.3)) {
            hasCompletedOnboarding = true
        }
        UserDefaults.standard.set(true, forKey: "hasCompletedOnboarding")
    }
}

struct OnboardingPage {
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String
    let description: String
}

struct OnboardingPageView: View {
    let page: OnboardingPage
    
    @State private var isVisible = false
    
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            // Icon
            ZStack {
                // Glow
                Circle()
                    .fill(page.iconColor.opacity(0.15))
                    .frame(width: 160, height: 160)
                    .blur(radius: 30)
                
                // Ring
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [page.iconColor, page.iconColor.opacity(0.3)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 3
                    )
                    .frame(width: 120, height: 120)
                
                // Icon
                Image(systemName: page.icon)
                    .font(.system(size: 50))
                    .foregroundColor(page.iconColor)
            }
            .scaleEffect(isVisible ? 1 : 0.8)
            .opacity(isVisible ? 1 : 0)
            
            // Title
            Text(page.title)
                .font(.title.bold())
                .foregroundStyle(
                    LinearGradient(
                        colors: [.white, page.iconColor.opacity(0.8)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .offset(y: isVisible ? 0 : 20)
                .opacity(isVisible ? 1 : 0)
            
            // Subtitle
            Text(page.subtitle)
                .font(.subheadline)
                .foregroundColor(page.iconColor)
                .offset(y: isVisible ? 0 : 15)
                .opacity(isVisible ? 1 : 0)
            
            // Description
            Text(page.description)
                .font(.body)
                .foregroundColor(.optaTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
                .offset(y: isVisible ? 0 : 10)
                .opacity(isVisible ? 1 : 0)
            
            Spacer()
            Spacer()
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7).delay(0.1)) {
                isVisible = true
            }
        }
        .onDisappear {
            isVisible = false
        }
    }
}

// MARK: - Feature Tour Tooltip

struct FeatureTooltip: View {
    let title: String
    let description: String
    var onDismiss: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline.bold())
                    .foregroundColor(.optaTextPrimary)
                
                Spacer()
                
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
            }
            
            Text(description)
                .font(.caption)
                .foregroundColor(.optaTextSecondary)
        }
        .padding()
        .background(Color.optaGlassBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaPrimary.opacity(0.3), lineWidth: 1)
        )
        .shadow(color: .optaPrimary.opacity(0.2), radius: 10, x: 0, y: 5)
    }
}

// MARK: - First Launch Checks

class OnboardingManager: ObservableObject {
    static let shared = OnboardingManager()
    
    @Published var hasCompletedOnboarding: Bool
    @Published var hasSeenDashboardTip = false
    @Published var hasSeenChatTip = false
    @Published var hasSeenWidgetTip = false
    
    private init() {
        self.hasCompletedOnboarding = UserDefaults.standard.bool(forKey: "hasCompletedOnboarding")
        self.hasSeenDashboardTip = UserDefaults.standard.bool(forKey: "hasSeenDashboardTip")
        self.hasSeenChatTip = UserDefaults.standard.bool(forKey: "hasSeenChatTip")
        self.hasSeenWidgetTip = UserDefaults.standard.bool(forKey: "hasSeenWidgetTip")
    }
    
    func markDashboardTipSeen() {
        hasSeenDashboardTip = true
        UserDefaults.standard.set(true, forKey: "hasSeenDashboardTip")
    }
    
    func markChatTipSeen() {
        hasSeenChatTip = true
        UserDefaults.standard.set(true, forKey: "hasSeenChatTip")
    }
    
    func markWidgetTipSeen() {
        hasSeenWidgetTip = true
        UserDefaults.standard.set(true, forKey: "hasSeenWidgetTip")
    }
    
    func resetOnboarding() {
        hasCompletedOnboarding = false
        hasSeenDashboardTip = false
        hasSeenChatTip = false
        hasSeenWidgetTip = false
        
        UserDefaults.standard.set(false, forKey: "hasCompletedOnboarding")
        UserDefaults.standard.set(false, forKey: "hasSeenDashboardTip")
        UserDefaults.standard.set(false, forKey: "hasSeenChatTip")
        UserDefaults.standard.set(false, forKey: "hasSeenWidgetTip")
    }
}

#Preview {
    OnboardingView(hasCompletedOnboarding: .constant(false))
}
