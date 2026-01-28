import SwiftUI

// MARK: - Haptic Feedback Manager

class HapticManager {
    static let shared = HapticManager()
    
    private init() {}
    
    func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.impactOccurred()
    }
    
    func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(type)
    }
    
    func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.selectionChanged()
    }
}

// MARK: - View Extensions

extension View {
    /// Add haptic feedback on tap
    func hapticTap(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) -> some View {
        self.simultaneousGesture(
            TapGesture().onEnded { _ in
                HapticManager.shared.impact(style)
            }
        )
    }
    
    /// Shimmer loading effect
    func shimmer(isLoading: Bool) -> some View {
        self.modifier(ShimmerModifier(isLoading: isLoading))
    }
    
    /// Slide in animation
    func slideIn(delay: Double = 0) -> some View {
        self.modifier(SlideInModifier(delay: delay))
    }
    
    /// Pulse animation for attention
    func pulse(_ isPulsing: Bool = true) -> some View {
        self.modifier(PulseModifier(isPulsing: isPulsing))
    }
}

// MARK: - Shimmer Effect

struct ShimmerModifier: ViewModifier {
    let isLoading: Bool
    @State private var phase: CGFloat = 0
    
    func body(content: Content) -> some View {
        content
            .overlay(
                Group {
                    if isLoading {
                        LinearGradient(
                            colors: [
                                .clear,
                                .white.opacity(0.1),
                                .clear
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .offset(x: phase)
                        .onAppear {
                            withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                                phase = 400
                            }
                        }
                    }
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Slide In Animation

struct SlideInModifier: ViewModifier {
    let delay: Double
    @State private var isVisible = false
    
    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 20)
            .onAppear {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8).delay(delay)) {
                    isVisible = true
                }
            }
    }
}

// MARK: - Pulse Animation

struct PulseModifier: ViewModifier {
    let isPulsing: Bool
    @State private var scale: CGFloat = 1
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(scale)
            .onAppear {
                guard isPulsing else { return }
                withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) {
                    scale = 1.05
                }
            }
    }
}

// MARK: - Loading Skeleton

struct SkeletonView: View {
    var width: CGFloat = 100
    var height: CGFloat = 16
    
    @State private var phase: CGFloat = 0
    
    var body: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(Color.optaGlassBackground)
            .frame(width: width, height: height)
            .overlay(
                LinearGradient(
                    colors: [
                        .clear,
                        .white.opacity(0.08),
                        .clear
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase)
            )
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .onAppear {
                withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                    phase = width * 2
                }
            }
    }
}

// MARK: - Empty State View

struct EmptyStateView: View {
    let icon: String
    let title: String
    let subtitle: String
    var actionLabel: String? = nil
    var action: (() -> Void)? = nil
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.optaTextMuted)
            
            Text(title)
                .font(.headline)
                .foregroundColor(.optaTextPrimary)
            
            Text(subtitle)
                .font(.subheadline)
                .foregroundColor(.optaTextMuted)
                .multilineTextAlignment(.center)
            
            if let actionLabel = actionLabel, let action = action {
                Button(action: action) {
                    Text(actionLabel)
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(.optaPrimary)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color.optaPrimary.opacity(0.15))
                        .cornerRadius(20)
                }
                .padding(.top, 8)
            }
        }
        .padding(40)
    }
}

// MARK: - Error Banner

struct ErrorBanner: View {
    let message: String
    var onDismiss: (() -> Void)? = nil
    var onRetry: (() -> Void)? = nil
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.optaNeonAmber)
            
            Text(message)
                .font(.caption)
                .foregroundColor(.optaTextSecondary)
            
            Spacer()
            
            if let onRetry = onRetry {
                Button(action: onRetry) {
                    Text("Retry")
                        .font(.caption.bold())
                        .foregroundColor(.optaPrimary)
                }
            }
            
            if let onDismiss = onDismiss {
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
            }
        }
        .padding()
        .background(Color.optaNeonAmber.opacity(0.1))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaNeonAmber.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Success Toast

struct SuccessToast: View {
    let message: String
    
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.optaNeonGreen)
            
            Text(message)
                .font(.subheadline)
                .foregroundColor(.optaTextPrimary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(Color.optaNeonGreen.opacity(0.15))
        .cornerRadius(20)
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(Color.optaNeonGreen.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Loading Overlay

struct LoadingOverlay: View {
    var message: String = "Loading..."
    
    var body: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
            
            VStack(spacing: 16) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .optaPrimary))
                    .scaleEffect(1.5)
                
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.optaTextSecondary)
            }
            .padding(32)
            .background(Color.optaVoid)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.optaGlassBorder, lineWidth: 1)
            )
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        EmptyStateView(
            icon: "checklist",
            title: "No Tasks",
            subtitle: "Add a task to get started",
            actionLabel: "Add Task",
            action: {}
        )
        
        ErrorBanner(message: "Failed to load data", onRetry: {})
        
        SuccessToast(message: "Task completed!")
        
        SkeletonView(width: 200, height: 20)
    }
    .padding()
    .background(Color.optaVoid)
}
