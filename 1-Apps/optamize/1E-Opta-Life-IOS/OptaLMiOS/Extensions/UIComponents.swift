import SwiftUI

// MARK: - Animated Opta Ring

struct AnimatedOptaRing: View {
    @Binding var isActive: Bool
    var size: CGFloat = 100
    var lineWidth: CGFloat = 4
    
    @State private var rotation: Double = 0
    @State private var trimEnd: CGFloat = 0.7
    
    var body: some View {
        ZStack {
            // Outer glow
            Circle()
                .fill(Color.optaPrimary.opacity(0.1))
                .frame(width: size * 1.4, height: size * 1.4)
                .blur(radius: 20)
            
            // Background ring
            Circle()
                .stroke(Color.optaGlassBorder, lineWidth: lineWidth)
                .frame(width: size, height: size)
            
            // Animated gradient ring
            Circle()
                .trim(from: 0, to: isActive ? 1 : trimEnd)
                .stroke(
                    AngularGradient(
                        colors: [.optaPrimary, .optaNeonCyan, .optaPrimary],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .frame(width: size, height: size)
                .rotationEffect(.degrees(rotation))
            
            // Center icon
            Image(systemName: "sparkles")
                .font(.system(size: size * 0.32))
                .foregroundColor(.optaPrimary)
                .scaleEffect(isActive ? 1.1 : 1)
        }
        .optaGlow()
        .onAppear {
            withAnimation(.linear(duration: 3).repeatForever(autoreverses: false)) {
                rotation = 360
            }
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                trimEnd = isActive ? 1 : 0.85
            }
        }
    }
}

// MARK: - Countdown Timer View

struct CountdownView: View {
    let targetDate: Date
    @State private var timeRemaining: TimeInterval = 0
    @State private var timer: Timer?
    
    var body: some View {
        HStack(spacing: 4) {
            if timeRemaining > 0 {
                Image(systemName: "clock")
                    .font(.caption2)
                Text(formattedTime)
                    .font(.caption.monospacedDigit())
            } else {
                Image(systemName: "clock.fill")
                    .font(.caption2)
                Text("Now")
                    .font(.caption.bold())
            }
        }
        .foregroundColor(timeRemaining < 300 ? .optaNeonRed : .optaTextMuted)
        .onAppear {
            updateTimeRemaining()
            timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
                updateTimeRemaining()
            }
        }
        .onDisappear {
            timer?.invalidate()
        }
    }
    
    private var formattedTime: String {
        let hours = Int(timeRemaining) / 3600
        let minutes = (Int(timeRemaining) % 3600) / 60
        
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            let seconds = Int(timeRemaining) % 60
            return String(format: "%d:%02d", minutes, seconds)
        }
    }
    
    private func updateTimeRemaining() {
        timeRemaining = max(0, targetDate.timeIntervalSinceNow)
    }
}

// MARK: - Progress Ring

struct ProgressRing: View {
    let progress: Double // 0.0 to 1.0
    var color: Color = .optaPrimary
    var size: CGFloat = 40
    var lineWidth: CGFloat = 4
    
    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.optaGlassBorder, lineWidth: lineWidth)
            
            Circle()
                .trim(from: 0, to: CGFloat(min(progress, 1.0)))
                .stroke(
                    color,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.4), value: progress)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Stat Counter

struct StatCounter: View {
    let value: Int
    let label: String
    var icon: String? = nil
    var color: Color = .optaPrimary
    
    @State private var displayedValue: Int = 0
    
    var body: some View {
        VStack(spacing: 6) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundColor(color.opacity(0.7))
            }
            
            Text("\(displayedValue)")
                .font(.title2.bold().monospacedDigit())
                .foregroundColor(color)
            
            Text(label)
                .font(.caption2)
                .foregroundColor(.optaTextMuted)
                .textCase(.uppercase)
                .tracking(1)
        }
        .onAppear {
            animateValue()
        }
        .onChange(of: value) { _, _ in
            animateValue()
        }
    }
    
    private func animateValue() {
        let steps = 20
        let increment = Double(value - displayedValue) / Double(steps)
        
        for i in 0..<steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.02) {
                displayedValue = Int(Double(displayedValue) + increment)
            }
        }
        
        // Ensure final value is exact
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            displayedValue = value
        }
    }
}

// MARK: - Greeting Header

struct GreetingHeader: View {
    let userName: String?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greeting)
                .font(.title3)
                .foregroundColor(.optaTextSecondary)
            
            if let name = userName {
                Text(name)
                    .font(.title.bold())
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, .optaPrimaryGlow],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            }
        }
    }
    
    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<5: return "Good night"
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<21: return "Good evening"
        default: return "Good night"
        }
    }
}

// MARK: - Tag Pill

struct TagPill: View {
    let text: String
    var color: Color = .optaPrimary
    var icon: String? = nil
    
    var body: some View {
        HStack(spacing: 4) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 9))
            }
            Text(text)
                .font(.system(size: 10, weight: .medium))
        }
        .foregroundColor(color)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.15))
        .cornerRadius(6)
    }
}

// MARK: - Swipe Action Row

struct SwipeActionRow<Content: View>: View {
    let content: Content
    var onComplete: (() -> Void)? = nil
    var onDelete: (() -> Void)? = nil
    
    @State private var offset: CGFloat = 0
    @State private var isSwiping = false
    
    init(@ViewBuilder content: () -> Content, onComplete: (() -> Void)? = nil, onDelete: (() -> Void)? = nil) {
        self.content = content()
        self.onComplete = onComplete
        self.onDelete = onDelete
    }
    
    var body: some View {
        ZStack(alignment: .trailing) {
            // Background actions
            HStack(spacing: 0) {
                Spacer()
                
                if let onComplete = onComplete {
                    Button(action: {
                        HapticManager.shared.notification(.success)
                        onComplete()
                    }) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .frame(width: 60)
                    }
                    .background(Color.optaNeonGreen)
                }
                
                if let onDelete = onDelete {
                    Button(action: {
                        HapticManager.shared.notification(.warning)
                        onDelete()
                    }) {
                        Image(systemName: "trash.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .frame(width: 60)
                    }
                    .background(Color.optaNeonRed)
                }
            }
            
            // Main content
            content
                .offset(x: offset)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            if value.translation.width < 0 {
                                offset = value.translation.width
                                isSwiping = true
                            }
                        }
                        .onEnded { value in
                            withAnimation(.spring(response: 0.3)) {
                                if value.translation.width < -100 {
                                    offset = -120
                                } else {
                                    offset = 0
                                }
                            }
                            isSwiping = false
                        }
                )
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

#Preview {
    VStack(spacing: 30) {
        AnimatedOptaRing(isActive: .constant(true))
        
        ProgressRing(progress: 0.7)
        
        StatCounter(value: 42, label: "Tasks", icon: "checkmark.circle", color: .optaNeonGreen)
        
        GreetingHeader(userName: "Matthew")
        
        HStack {
            TagPill(text: "Work", color: .optaNeonBlue, icon: "briefcase")
            TagPill(text: "Urgent", color: .optaNeonRed, icon: "flag.fill")
        }
    }
    .padding()
    .background(Color.optaVoid)
}
