import SwiftUI

struct MessageBubble: View {
    let message: ChatMessage

    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 60) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(message.content.isEmpty ? " " : message.content)
                    .font(.body)
                    .foregroundStyle(OptaColors.textPrimary)
                    .textSelection(.enabled)

                if let model = message.model {
                    Text(model.split(separator: "/").last.map(String.init) ?? model)
                        .font(.caption2)
                        .foregroundStyle(OptaColors.textMuted)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                isUser ? OptaColors.primary.opacity(0.2) : OptaColors.surface,
                in: RoundedRectangle(cornerRadius: 16)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        isUser ? OptaColors.primary.opacity(0.3) : OptaColors.border.opacity(0.3),
                        lineWidth: 0.5
                    )
            )

            if !isUser { Spacer(minLength: 60) }
        }
    }
}

struct StreamingIndicator: View {
    @State private var dotCount = 0

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3) { i in
                Circle()
                    .fill(OptaColors.primary)
                    .frame(width: 6, height: 6)
                    .opacity(dotCount == i ? 1 : 0.3)
            }
        }
        .onAppear {
            Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { _ in
                withAnimation(.optaSpring) {
                    dotCount = (dotCount + 1) % 3
                }
            }
        }
    }
}
