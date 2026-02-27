import SwiftUI

// MARK: - Advanced Animation Library

// Custom spring configurations for consistent feel
extension Animation {
    static let optaSpring = Animation.spring(response: 0.4, dampingFraction: 0.75, blendDuration: 0.1)
    static let optaQuick = Animation.spring(response: 0.25, dampingFraction: 0.8, blendDuration: 0)
    static let optaBouncy = Animation.spring(response: 0.5, dampingFraction: 0.6, blendDuration: 0.1)
    static let optaSmooth = Animation.easeInOut(duration: 0.35)
    static let optaSnap = Animation.interpolatingSpring(stiffness: 300, damping: 20)
}

// MARK: - Breathing Animation

struct BreathingModifier: ViewModifier {
    @State private var isBreathing = false
    let minScale: CGFloat
    let maxScale: CGFloat
    let duration: Double
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isBreathing ? maxScale : minScale)
            .opacity(isBreathing ? 1.0 : 0.85)
            .onAppear {
                withAnimation(.easeInOut(duration: duration).repeatForever(autoreverses: true)) {
                    isBreathing = true
                }
            }
    }
}

extension View {
    func breathing(minScale: CGFloat = 0.97, maxScale: CGFloat = 1.03, duration: Double = 2.0) -> some View {
        modifier(BreathingModifier(minScale: minScale, maxScale: maxScale, duration: duration))
    }
}

// MARK: - Ripple Effect

struct RippleEffect: ViewModifier {
    @State private var rippleScale: CGFloat = 0
    @State private var rippleOpacity: Double = 0.5
    let color: Color
    let trigger: Bool
    
    func body(content: Content) -> some View {
        content
            .background(
                Circle()
                    .fill(color)
                    .scaleEffect(rippleScale)
                    .opacity(rippleOpacity)
            )
            .onChange(of: trigger) { _, newValue in
                if newValue {
                    rippleScale = 0
                    rippleOpacity = 0.5
                    withAnimation(.easeOut(duration: 0.6)) {
                        rippleScale = 2.5
                        rippleOpacity = 0
                    }
                }
            }
    }
}

extension View {
    func rippleEffect(color: Color = .optaPrimary, trigger: Bool) -> some View {
        modifier(RippleEffect(color: color, trigger: trigger))
    }
}

// MARK: - Shake Animation

struct ShakeModifier: ViewModifier {
    @State private var shakeOffset: CGFloat = 0
    let trigger: Bool
    
    func body(content: Content) -> some View {
        content
            .offset(x: shakeOffset)
            .onChange(of: trigger) { _, newValue in
                if newValue {
                    withAnimation(.interpolatingSpring(stiffness: 600, damping: 10)) {
                        shakeOffset = -10
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        withAnimation(.interpolatingSpring(stiffness: 600, damping: 10)) {
                            shakeOffset = 10
                        }
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                        withAnimation(.interpolatingSpring(stiffness: 600, damping: 15)) {
                            shakeOffset = 0
                        }
                    }
                }
            }
    }
}

extension View {
    func shake(trigger: Bool) -> some View {
        modifier(ShakeModifier(trigger: trigger))
    }
}

// MARK: - Float Animation

struct FloatModifier: ViewModifier {
    @State private var offset: CGFloat = 0
    let amplitude: CGFloat
    let duration: Double
    
    func body(content: Content) -> some View {
        content
            .offset(y: offset)
            .onAppear {
                withAnimation(.easeInOut(duration: duration).repeatForever(autoreverses: true)) {
                    offset = amplitude
                }
            }
    }
}

extension View {
    func floating(amplitude: CGFloat = 5, duration: Double = 2.0) -> some View {
        modifier(FloatModifier(amplitude: amplitude, duration: duration))
    }
}

// MARK: - Glow Pulse

struct GlowPulseModifier: ViewModifier {
    @State private var glowIntensity: Double = 0.3
    let color: Color
    let baseRadius: CGFloat
    
    func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(glowIntensity), radius: baseRadius, x: 0, y: 0)
            .shadow(color: color.opacity(glowIntensity * 0.5), radius: baseRadius * 2, x: 0, y: 0)
            .onAppear {
                withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                    glowIntensity = 0.7
                }
            }
    }
}

extension View {
    func glowPulse(color: Color = .optaPrimary, radius: CGFloat = 10) -> some View {
        modifier(GlowPulseModifier(color: color, baseRadius: radius))
    }
}

// MARK: - Typewriter Effect

struct TypewriterText: View {
    let text: String
    let speed: Double
    @State private var displayedText = ""
    @State private var currentIndex = 0
    
    var body: some View {
        Text(displayedText)
            .onAppear {
                startTyping()
            }
    }
    
    private func startTyping() {
        displayedText = ""
        currentIndex = 0
        typeNextCharacter()
    }
    
    private func typeNextCharacter() {
        guard currentIndex < text.count else { return }
        
        let index = text.index(text.startIndex, offsetBy: currentIndex)
        displayedText += String(text[index])
        currentIndex += 1
        
        DispatchQueue.main.asyncAfter(deadline: .now() + speed) {
            typeNextCharacter()
        }
    }
}

// MARK: - Staggered List Animation

struct StaggeredListModifier: ViewModifier {
    let index: Int
    let baseDelay: Double
    @State private var appeared = false
    
    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 30)
            .scaleEffect(appeared ? 1 : 0.9)
            .onAppear {
                withAnimation(.optaSpring.delay(Double(index) * baseDelay)) {
                    appeared = true
                }
            }
    }
}

extension View {
    func staggeredAppear(index: Int, baseDelay: Double = 0.05) -> some View {
        modifier(StaggeredListModifier(index: index, baseDelay: baseDelay))
    }
}

// MARK: - Magnetic Button Effect

struct MagneticButtonStyle: ButtonStyle {
    @State private var isPressed = false
    @State private var magneticOffset: CGSize = .zero
    let color: Color
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .offset(magneticOffset)
            .animation(.optaQuick, value: configuration.isPressed)
            .animation(.optaSpring, value: magneticOffset)
    }
}

// MARK: - Morph Shape

struct MorphingCircle: View {
    @State private var morphProgress: CGFloat = 0
    let color: Color
    let size: CGFloat
    
    var body: some View {
        ZStack {
            ForEach(0..<3) { i in
                Circle()
                    .fill(color.opacity(0.3 - Double(i) * 0.1))
                    .frame(width: size + CGFloat(i * 10), height: size + CGFloat(i * 10))
                    .scaleEffect(1 + morphProgress * CGFloat(i + 1) * 0.1)
                    .blur(radius: CGFloat(i * 2))
            }
            
            Circle()
                .fill(
                    RadialGradient(
                        colors: [color, color.opacity(0.7)],
                        center: .center,
                        startRadius: 0,
                        endRadius: size / 2
                    )
                )
                .frame(width: size, height: size)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) {
                morphProgress = 1
            }
        }
    }
}

// MARK: - Particle System

struct ParticleView: View {
    @State private var particles: [Particle] = []
    let color: Color
    let count: Int
    
    struct Particle: Identifiable {
        let id = UUID()
        var x: CGFloat
        var y: CGFloat
        var scale: CGFloat
        var opacity: Double
        var speed: Double
    }
    
    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(particles) { particle in
                    Circle()
                        .fill(color)
                        .frame(width: 4 * particle.scale, height: 4 * particle.scale)
                        .position(x: particle.x, y: particle.y)
                        .opacity(particle.opacity)
                }
            }
            .onAppear {
                createParticles(in: geo.size)
                animateParticles(in: geo.size)
            }
        }
    }
    
    private func createParticles(in size: CGSize) {
        particles = (0..<count).map { _ in
            Particle(
                x: CGFloat.random(in: 0...size.width),
                y: CGFloat.random(in: 0...size.height),
                scale: CGFloat.random(in: 0.5...1.5),
                opacity: Double.random(in: 0.3...0.7),
                speed: Double.random(in: 1...3)
            )
        }
    }
    
    private func animateParticles(in size: CGSize) {
        Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { _ in
            for i in particles.indices {
                particles[i].y -= CGFloat(particles[i].speed)
                particles[i].opacity -= 0.005
                
                if particles[i].y < 0 || particles[i].opacity <= 0 {
                    particles[i].y = size.height
                    particles[i].x = CGFloat.random(in: 0...size.width)
                    particles[i].opacity = Double.random(in: 0.3...0.7)
                }
            }
        }
    }
}

// MARK: - Counter Animation

struct AnimatedCounter: View {
    let value: Int
    let font: Font
    let color: Color
    
    @State private var displayValue: Int = 0
    
    var body: some View {
        Text("\(displayValue)")
            .font(font)
            .foregroundColor(color)
            .contentTransition(.numericText(value: Double(displayValue)))
            .onChange(of: value) { oldValue, newValue in
                animateToValue(from: oldValue, to: newValue)
            }
            .onAppear {
                animateToValue(from: 0, to: value)
            }
    }
    
    private func animateToValue(from: Int, to: Int) {
        let steps = 20
        let difference = to - from
        let stepValue = Double(difference) / Double(steps)
        
        for i in 0...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.025) {
                withAnimation(.linear(duration: 0.025)) {
                    displayValue = from + Int(Double(i) * stepValue)
                }
            }
        }
        
        // Ensure final value is exact
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(steps) * 0.025 + 0.1) {
            displayValue = to
        }
    }
}

// MARK: - Confetti Effect

struct ConfettiView: View {
    @Binding var isActive: Bool
    let colors: [Color]
    
    @State private var confetti: [ConfettiPiece] = []
    
    struct ConfettiPiece: Identifiable {
        let id = UUID()
        var x: CGFloat
        var y: CGFloat
        var rotation: Double
        var scale: CGFloat
        let color: Color
        var velocity: CGFloat
        var rotationSpeed: Double
    }
    
    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(confetti) { piece in
                    Rectangle()
                        .fill(piece.color)
                        .frame(width: 8, height: 12)
                        .scaleEffect(piece.scale)
                        .rotationEffect(.degrees(piece.rotation))
                        .position(x: piece.x, y: piece.y)
                }
            }
            .onChange(of: isActive) { _, active in
                if active {
                    createConfetti(in: geo.size)
                    animateConfetti(in: geo.size)
                }
            }
        }
        .allowsHitTesting(false)
    }
    
    private func createConfetti(in size: CGSize) {
        confetti = (0..<50).map { _ in
            ConfettiPiece(
                x: size.width / 2,
                y: -20,
                rotation: Double.random(in: 0...360),
                scale: CGFloat.random(in: 0.5...1.2),
                color: colors.randomElement() ?? .optaPrimary,
                velocity: CGFloat.random(in: 2...6),
                rotationSpeed: Double.random(in: -10...10)
            )
        }
    }
    
    private func animateConfetti(in size: CGSize) {
        Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { timer in
            var allDone = true
            
            for i in confetti.indices {
                confetti[i].y += confetti[i].velocity
                confetti[i].x += CGFloat.random(in: -2...2)
                confetti[i].rotation += confetti[i].rotationSpeed
                confetti[i].velocity += 0.1 // gravity
                
                if confetti[i].y < size.height + 50 {
                    allDone = false
                }
            }
            
            if allDone {
                timer.invalidate()
                confetti = []
                isActive = false
            }
        }
    }
}

// MARK: - Elastic Scale

struct ElasticScaleModifier: ViewModifier {
    @State private var scale: CGFloat = 0
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(scale)
            .onAppear {
                withAnimation(.interpolatingSpring(stiffness: 100, damping: 8)) {
                    scale = 1
                }
            }
    }
}

extension View {
    func elasticAppear() -> some View {
        modifier(ElasticScaleModifier())
    }
}

// MARK: - Card Flip

struct CardFlipModifier: ViewModifier {
    @Binding var isFlipped: Bool
    
    func body(content: Content) -> some View {
        content
            .rotation3DEffect(
                .degrees(isFlipped ? 180 : 0),
                axis: (x: 0, y: 1, z: 0)
            )
            .animation(.optaSpring, value: isFlipped)
    }
}

extension View {
    func cardFlip(isFlipped: Binding<Bool>) -> some View {
        modifier(CardFlipModifier(isFlipped: isFlipped))
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.optaVoid.ignoresSafeArea()
        
        VStack(spacing: 40) {
            MorphingCircle(color: .optaPrimary, size: 80)
            
            AnimatedCounter(value: 42, font: .title.bold(), color: .optaNeonGreen)
            
            Text("Floating Text")
                .foregroundColor(.white)
                .floating()
            
            Circle()
                .fill(Color.optaPrimary)
                .frame(width: 50, height: 50)
                .breathing()
                .glowPulse()
        }
    }
}
