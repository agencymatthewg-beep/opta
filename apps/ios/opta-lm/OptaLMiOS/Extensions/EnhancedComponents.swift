import SwiftUI

// MARK: - Enhanced Animated Opta Ring

struct EnhancedOptaRing: View {
    @Binding var isActive: Bool
    var size: CGFloat = 100
    var lineWidth: CGFloat = 4
    var showParticles: Bool = true
    
    @State private var rotation: Double = 0
    @State private var innerRotation: Double = 0
    @State private var pulseScale: CGFloat = 1
    @State private var glowOpacity: Double = 0.2
    @State private var sparkleRotation: Double = 0
    
    var body: some View {
        ZStack {
            // Particle background
            if showParticles {
                ParticleView(color: .optaPrimary.opacity(0.5), count: 15)
                    .frame(width: size * 2, height: size * 2)
                    .blur(radius: 1)
            }
            
            // Outer glow layers
            ForEach(0..<3) { i in
                Circle()
                    .fill(Color.optaPrimary.opacity(0.05 - Double(i) * 0.015))
                    .frame(width: size * (1.6 + CGFloat(i) * 0.2), height: size * (1.6 + CGFloat(i) * 0.2))
                    .blur(radius: 15 + CGFloat(i * 5))
                    .scaleEffect(pulseScale)
            }
            
            // Background ring
            Circle()
                .stroke(Color.optaGlassBorder.opacity(0.3), lineWidth: lineWidth / 2)
                .frame(width: size, height: size)
            
            // Secondary rotating ring
            Circle()
                .trim(from: 0.2, to: 0.5)
                .stroke(
                    Color.optaNeonCyan.opacity(0.4),
                    style: StrokeStyle(lineWidth: lineWidth / 2, lineCap: .round)
                )
                .frame(width: size * 0.85, height: size * 0.85)
                .rotationEffect(.degrees(-innerRotation))
            
            // Main animated gradient ring
            Circle()
                .trim(from: 0, to: isActive ? 1 : 0.7)
                .stroke(
                    AngularGradient(
                        colors: [
                            .optaPrimary,
                            .optaNeonCyan,
                            .optaPrimary.opacity(0.8),
                            .optaNeonBlue,
                            .optaPrimary
                        ],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .frame(width: size, height: size)
                .rotationEffect(.degrees(rotation))
                .shadow(color: .optaPrimary.opacity(0.5), radius: 8, x: 0, y: 0)
            
            // Inner glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color.optaPrimary.opacity(glowOpacity),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 0,
                        endRadius: size / 2
                    )
                )
                .frame(width: size * 0.8, height: size * 0.8)
            
            // Center sparkle icon
            Image(systemName: "sparkles")
                .font(.system(size: size * 0.28))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.white, .optaPrimary],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .rotationEffect(.degrees(sparkleRotation))
                .scaleEffect(isActive ? 1.1 : 1)
            
            // Orbiting dots
            ForEach(0..<4) { i in
                Circle()
                    .fill(Color.optaNeonCyan)
                    .frame(width: 4, height: 4)
                    .offset(y: -size / 2 - 10)
                    .rotationEffect(.degrees(rotation + Double(i * 90)))
                    .opacity(0.6)
            }
        }
        .onAppear {
            startAnimations()
        }
    }
    
    private func startAnimations() {
        // Main rotation
        withAnimation(.linear(duration: 4).repeatForever(autoreverses: false)) {
            rotation = 360
        }
        
        // Counter rotation for inner ring
        withAnimation(.linear(duration: 6).repeatForever(autoreverses: false)) {
            innerRotation = 360
        }
        
        // Pulse effect
        withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
            pulseScale = 1.1
            glowOpacity = 0.4
        }
        
        // Subtle sparkle rotation
        withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) {
            sparkleRotation = 10
        }
    }
}

// MARK: - Enhanced Stat Counter

struct EnhancedStatCounter: View {
    let value: Int
    let label: String
    var icon: String? = nil
    var color: Color = .optaPrimary
    
    @State private var displayedValue: Int = 0
    @State private var iconScale: CGFloat = 1
    @State private var appeared = false
    
    var body: some View {
        VStack(spacing: 8) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundColor(color.opacity(0.7))
                    .scaleEffect(iconScale)
            }
            
            Text("\(displayedValue)")
                .font(.title2.bold().monospacedDigit())
                .foregroundColor(color)
                .contentTransition(.numericText(value: Double(displayedValue)))
            
            Text(label)
                .font(.caption2)
                .foregroundColor(.optaTextMuted)
                .textCase(.uppercase)
                .tracking(1)
        }
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 20)
        .onAppear {
            withAnimation(.optaSpring.delay(0.2)) {
                appeared = true
            }
            animateValue()
            animateIcon()
        }
        .onChange(of: value) { _, _ in
            animateValue()
            pulseIcon()
        }
    }
    
    private func animateValue() {
        let steps = 25
        let targetValue = value
        let startValue = displayedValue
        let increment = Double(targetValue - startValue) / Double(steps)
        
        for i in 0...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.02) {
                withAnimation(.linear(duration: 0.02)) {
                    displayedValue = startValue + Int(Double(i) * increment)
                }
            }
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            displayedValue = targetValue
        }
    }
    
    private func animateIcon() {
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            iconScale = 1.1
        }
    }
    
    private func pulseIcon() {
        withAnimation(.optaBouncy) {
            iconScale = 1.3
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            withAnimation(.optaSpring) {
                iconScale = 1.1
            }
        }
    }
}

// MARK: - Animated Task Row

struct AnimatedTaskRow: View {
    let task: OptaTask
    let index: Int
    let onComplete: () -> Void
    
    @State private var appeared = false
    @State private var isCompleting = false
    @State private var checkScale: CGFloat = 1
    @State private var showRipple = false
    @State private var strikeProgress: CGFloat = 0
    
    var body: some View {
        HStack(spacing: 12) {
            // Animated checkbox
            Button {
                completeWithAnimation()
            } label: {
                ZStack {
                    Circle()
                        .stroke(priorityColor, lineWidth: 2)
                        .frame(width: 24, height: 24)
                    
                    if isCompleting {
                        Circle()
                            .fill(priorityColor)
                            .frame(width: 24, height: 24)
                            .transition(.scale.combined(with: .opacity))
                        
                        Image(systemName: "checkmark")
                            .font(.caption.bold())
                            .foregroundColor(.white)
                            .scaleEffect(checkScale)
                            .transition(.scale)
                    }
                }
                .rippleEffect(color: priorityColor, trigger: showRipple)
            }
            .scaleEffect(checkScale)
            .disabled(isCompleting)
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                ZStack(alignment: .leading) {
                    Text(task.content)
                        .font(.subheadline)
                        .foregroundColor(isCompleting ? .optaTextMuted : .optaTextPrimary)
                    
                    // Strike-through animation
                    if isCompleting {
                        Rectangle()
                            .fill(Color.optaTextMuted)
                            .frame(height: 1.5)
                            .scaleEffect(x: strikeProgress, y: 1, anchor: .leading)
                    }
                }
                
                if let due = task.due {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.system(size: 10))
                        Text(due.string)
                            .font(.caption)
                    }
                    .foregroundColor(.optaTextMuted)
                }
            }
            
            Spacer()
            
            // Priority indicator
            if task.priority.rawValue > 1 {
                Circle()
                    .fill(priorityColor)
                    .frame(width: 8, height: 8)
                    .breathing(minScale: 0.8, maxScale: 1.2, duration: 1)
            }
        }
        .padding()
        .background(Color.optaGlassBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(priorityColor.opacity(0.2), lineWidth: 1)
        )
        .opacity(appeared ? (isCompleting ? 0.6 : 1) : 0)
        .offset(x: appeared ? 0 : -50)
        .onAppear {
            withAnimation(.optaSpring.delay(Double(index) * 0.05)) {
                appeared = true
            }
        }
    }
    
    private var priorityColor: Color {
        switch task.priority {
        case .urgent: return .optaNeonRed
        case .high: return .optaNeonAmber
        case .medium: return .optaNeonBlue
        case .normal: return .optaTextMuted
        }
    }
    
    private func completeWithAnimation() {
        HapticManager.shared.notification(.success)
        showRipple = true
        
        withAnimation(.optaBouncy) {
            checkScale = 1.3
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.optaSpring) {
                isCompleting = true
                checkScale = 1
            }
        }
        
        // Strike-through animation
        withAnimation(.easeOut(duration: 0.4).delay(0.15)) {
            strikeProgress = 1
        }
        
        // Call complete after animation
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            onComplete()
        }
    }
}

// MARK: - Animated Event Row

struct AnimatedEventRow: View {
    let event: CalendarEvent
    let index: Int
    
    @State private var appeared = false
    @State private var timelineHeight: CGFloat = 0
    
    var body: some View {
        HStack(spacing: 16) {
            // Timeline indicator
            VStack(spacing: 0) {
                Circle()
                    .fill(Color.optaNeonBlue)
                    .frame(width: 10, height: 10)
                    .glowPulse(color: .optaNeonBlue, radius: 5)
                
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [.optaNeonBlue, .optaNeonBlue.opacity(0.2)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: 2, height: timelineHeight)
            }
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                Text(event.summary)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.optaTextPrimary)
                
                HStack(spacing: 8) {
                    if let start = event.startDate {
                        Text(start.formatted(date: .omitted, time: .shortened))
                            .font(.caption.monospacedDigit())
                            .foregroundColor(.optaNeonBlue)
                    }
                    
                    if event.startDate?.isToday ?? false {
                        TagPill(text: "Today", color: .optaNeonGreen, icon: "sun.max")
                    }
                }
            }
            
            Spacer()
            
            // Countdown
            if let start = event.startDate, start.timeIntervalSinceNow > 0 && start.timeIntervalSinceNow < 3600 {
                CountdownView(targetDate: start)
                    .breathing()
            }
        }
        .padding()
        .background(Color.optaGlassBackground)
        .cornerRadius(12)
        .opacity(appeared ? 1 : 0)
        .offset(x: appeared ? 0 : 30)
        .onAppear {
            withAnimation(.optaSpring.delay(Double(index) * 0.08)) {
                appeared = true
            }
            withAnimation(.easeOut(duration: 0.5).delay(Double(index) * 0.08 + 0.2)) {
                timelineHeight = 30
            }
        }
    }
}

// MARK: - Animated Message Bubble

struct AnimatedMessageBubble: View {
    let message: ChatMessage
    let index: Int
    
    @State private var appeared = false
    @State private var showAvatar = false
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.role == .assistant {
                // Animated avatar
                ZStack {
                    Circle()
                        .fill(Color.optaPrimary.opacity(0.2))
                        .frame(width: 32, height: 32)
                    
                    Image(systemName: "sparkle")
                        .font(.caption)
                        .foregroundColor(.optaPrimary)
                        .rotationEffect(.degrees(showAvatar ? 0 : -180))
                        .scaleEffect(showAvatar ? 1 : 0)
                }
                .onAppear {
                    withAnimation(.optaBouncy.delay(0.1)) {
                        showAvatar = true
                    }
                }
            }
            
            if message.role == .user {
                Spacer(minLength: 40)
            }
            
            // Message content
            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.text)
                    .font(.subheadline)
                    .foregroundColor(message.role == .user ? .white : .optaTextSecondary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(
                        message.role == .user
                            ? AnyShapeStyle(
                                LinearGradient(
                                    colors: [.optaPrimary, .optaPrimary.opacity(0.85)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                              )
                            : AnyShapeStyle(Color.optaGlassBackground)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        message.role == .assistant
                            ? RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.optaGlassBorder, lineWidth: 1)
                            : nil
                    )
                
                if let actionType = message.actionType {
                    AnimatedActionBadge(actionType: actionType)
                }
            }
            .frame(maxWidth: 280, alignment: message.role == .user ? .trailing : .leading)
            .opacity(appeared ? 1 : 0)
            .offset(x: appeared ? 0 : (message.role == .user ? 50 : -50))
            .scaleEffect(appeared ? 1 : 0.8)
            
            if message.role == .assistant {
                Spacer(minLength: 40)
            }
            
            if message.role == .user {
                Circle()
                    .fill(Color.optaGlassBackground)
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.caption)
                            .foregroundColor(.optaTextMuted)
                    )
            }
        }
        .onAppear {
            withAnimation(.optaSpring.delay(Double(index) * 0.1)) {
                appeared = true
            }
        }
    }
}

struct AnimatedActionBadge: View {
    let actionType: String
    
    @State private var appeared = false
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(label)
                .font(.caption2)
        }
        .foregroundColor(color)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(color.opacity(0.15))
        .cornerRadius(12)
        .scaleEffect(appeared ? 1 : 0)
        .onAppear {
            withAnimation(.optaBouncy.delay(0.3)) {
                appeared = true
            }
        }
    }
    
    private var icon: String {
        switch actionType {
        case "CALENDAR": return "calendar.badge.checkmark"
        case "EMAIL": return "envelope.badge.fill"
        case "TASK": return "checkmark.circle.fill"
        default: return "sparkle"
        }
    }
    
    private var label: String {
        switch actionType {
        case "CALENDAR": return "Event Created"
        case "EMAIL": return "Draft Saved"
        case "TASK": return "Task Added"
        default: return ""
        }
    }
    
    private var color: Color {
        switch actionType {
        case "CALENDAR": return .optaNeonBlue
        case "EMAIL": return .optaNeonGreen
        case "TASK": return .optaNeonAmber
        default: return .optaPrimary
        }
    }
}

// MARK: - Animated Typing Indicator

struct EnhancedTypingIndicator: View {
    @State private var dots: [Bool] = [false, false, false]
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Animated avatar
            ZStack {
                Circle()
                    .fill(Color.optaPrimary.opacity(0.2))
                    .frame(width: 32, height: 32)
                
                Image(systemName: "sparkle")
                    .font(.caption)
                    .foregroundColor(.optaPrimary)
                    .breathing(minScale: 0.9, maxScale: 1.1, duration: 1)
            }
            
            // Dots container
            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Color.optaPrimary)
                        .frame(width: 8, height: 8)
                        .scaleEffect(dots[index] ? 1.2 : 0.8)
                        .opacity(dots[index] ? 1 : 0.4)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .background(Color.optaGlassBackground)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.optaGlassBorder, lineWidth: 1)
            )
            .onAppear {
                animateDots()
            }
            
            Spacer()
        }
    }
    
    private func animateDots() {
        Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { _ in
            withAnimation(.optaQuick) {
                // Shift the active dot
                let activeIndex = dots.firstIndex(of: true) ?? -1
                let nextIndex = (activeIndex + 1) % 3
                
                for i in 0..<3 {
                    dots[i] = (i == nextIndex)
                }
            }
        }
    }
}

#Preview {
    ZStack {
        Color.optaVoid.ignoresSafeArea()
        
        VStack(spacing: 30) {
            EnhancedOptaRing(isActive: .constant(true))
            
            HStack(spacing: 20) {
                EnhancedStatCounter(value: 12, label: "Tasks", icon: "checkmark.circle", color: .optaNeonGreen)
                EnhancedStatCounter(value: 5, label: "Events", icon: "calendar", color: .optaNeonBlue)
            }
            
            EnhancedTypingIndicator()
        }
        .padding()
    }
}
