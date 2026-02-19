import SwiftUI

struct ModelListView: View {
    let models: [LoadedModel]
    var onUnload: ((String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Loaded Models")
                    .font(.caption)
                    .foregroundStyle(OptaColors.textMuted)
                    .textCase(.uppercase)
                    .tracking(1)
                Spacer()
                Text("\(models.count)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(OptaColors.primary)
            }

            if models.isEmpty {
                Text("No models loaded")
                    .font(.subheadline)
                    .foregroundStyle(OptaColors.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 12)
            } else {
                ForEach(models) { model in
                    modelRow(model)
                        .transition(.asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .move(edge: .trailing).combined(with: .opacity)
                        ))
                }
            }
        }
        .padding()
        .glassPanel()
        .animation(.optaSpring, value: models.map(\.id))
    }

    private func modelRow(_ model: LoadedModel) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(model.name)
                    .font(.subheadline.bold())
                    .foregroundStyle(OptaColors.textPrimary)
                    .lineLimit(1)
                Text("\(model.quantization) · \(model.contextLength / 1024)K ctx")
                    .font(.caption)
                    .foregroundStyle(OptaColors.textSecondary)
            }
            Spacer()
            Text(String(format: "%.1f GB", model.vramGb))
                .font(.caption.monospacedDigit())
                .foregroundStyle(OptaColors.primary)
                .contentTransition(.numericText())
        }
        .padding(.vertical, 4)
        .swipeActions(edge: .trailing) {
            if let onUnload {
                Button(role: .destructive) {
                    OptaHaptics.tap()
                    onUnload(model.id)
                } label: {
                    Label("Unload", systemImage: "xmark.circle")
                }
            }
        }
    }
}
