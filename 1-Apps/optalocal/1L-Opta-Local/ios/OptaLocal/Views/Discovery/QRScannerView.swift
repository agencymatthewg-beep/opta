import SwiftUI
import AVFoundation

/// QR code scanner for tunnel pairing.
/// Scans for URLs containing tunnel connection info.
struct QRScannerView: View {
    @Environment(ConnectionManager.self) private var connectionManager
    @Environment(\.dismiss) private var dismiss

    @State private var scannedURL: String?
    @State private var isProcessing = false
    @State private var error: String?
    @State private var torchOn = false

    var body: some View {
        NavigationStack {
            ZStack {
                OptaColors.void_.ignoresSafeArea()

                QRCameraView(onCodeScanned: handleScannedCode, torchOn: torchOn)
                    .ignoresSafeArea()

                // Overlay
                VStack {
                    Spacer()

                    // Scanning frame guide
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(OptaColors.primary.opacity(0.6), lineWidth: 2)
                        .frame(width: 250, height: 250)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(OptaColors.primary.opacity(0.15), lineWidth: 40)
                                .blur(radius: 10)
                        )

                    Spacer()

                    // Bottom info panel
                    VStack(spacing: 12) {
                        if isProcessing {
                            ProgressView()
                                .tint(OptaColors.primary)
                            Text("Connecting…")
                                .font(.subheadline)
                                .foregroundStyle(OptaColors.textSecondary)
                        } else if let error {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundStyle(OptaColors.neonRed)
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(OptaColors.neonRed)
                                .multilineTextAlignment(.center)
                        } else {
                            Image(systemName: "qrcode.viewfinder")
                                .font(.title2)
                                .foregroundStyle(OptaColors.primary)
                            Text("Scan QR code from `opta serve tunnel`")
                                .font(.subheadline)
                                .foregroundStyle(OptaColors.textSecondary)
                                .multilineTextAlignment(.center)
                        }
                    }
                    .padding(24)
                    .frame(maxWidth: .infinity)
                    .glassPanel()
                    .padding()
                }
            }
            .navigationTitle("Scan QR")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(OptaColors.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        torchOn.toggle()
                    } label: {
                        Image(systemName: torchOn ? "flashlight.on.fill" : "flashlight.off.fill")
                            .foregroundStyle(torchOn ? OptaColors.neonAmber : OptaColors.textMuted)
                    }
                }
            }
        }
    }

    private func handleScannedCode(_ code: String) {
        guard !isProcessing else { return }
        guard scannedURL != code else { return }
        scannedURL = code

        OptaHaptics.success()

        // Parse QR — expect URL like: https://xxx.trycloudflare.com?key=ADMIN_KEY
        // or just https://xxx.trycloudflare.com (key entered separately)
        guard let url = URLComponents(string: code),
              let host = url.host,
              url.scheme == "https" || url.scheme == "http" else {
            error = "Invalid QR code — expected a tunnel URL"
            return
        }

        let tunnelURL = "\(url.scheme ?? "https")://\(host)\(url.port.map { ":\($0)" } ?? "")"
        let adminKey = url.queryItems?.first(where: { $0.name == "key" })?.value
            ?? connectionManager.storedAdminKey

        isProcessing = true
        error = nil

        Task {
            let config = ConnectionConfig(
                name: host,
                type: .wan,
                host: tunnelURL,
                port: 443
            )
            await connectionManager.connect(config: config, adminKey: adminKey)

            if connectionManager.state.isConnected {
                dismiss()
            } else {
                isProcessing = false
                error = "Failed to connect to tunnel"
                scannedURL = nil
            }
        }
    }
}

// MARK: - AVFoundation Camera

struct QRCameraView: UIViewRepresentable {
    let onCodeScanned: (String) -> Void
    let torchOn: Bool

    func makeUIView(context: Context) -> QRCameraUIView {
        let view = QRCameraUIView(onCodeScanned: onCodeScanned)
        return view
    }

    func updateUIView(_ uiView: QRCameraUIView, context: Context) {
        uiView.setTorch(torchOn)
    }
}

final class QRCameraUIView: UIView, @unchecked Sendable {
    private let captureSession = AVCaptureSession()
    private let onCodeScanned: (String) -> Void
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private let metadataDelegate = QRMetadataDelegate()

    init(onCodeScanned: @escaping (String) -> Void) {
        self.onCodeScanned = onCodeScanned
        super.init(frame: .zero)
        metadataDelegate.onCodeScanned = onCodeScanned
        setupCamera()
    }

    required init?(coder: NSCoder) { fatalError() }

    private func setupCamera() {
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device) else { return }

        captureSession.addInput(input)

        let output = AVCaptureMetadataOutput()
        captureSession.addOutput(output)
        output.setMetadataObjectsDelegate(metadataDelegate, queue: .main)
        output.metadataObjectTypes = [.qr]

        let preview = AVCaptureVideoPreviewLayer(session: captureSession)
        preview.videoGravity = .resizeAspectFill
        layer.addSublayer(preview)
        previewLayer = preview

        DispatchQueue.global(qos: .userInitiated).async { [captureSession] in
            captureSession.startRunning()
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer?.frame = bounds
    }

    func setTorch(_ on: Bool) {
        guard let device = AVCaptureDevice.default(for: .video),
              device.hasTorch else { return }
        try? device.lockForConfiguration()
        device.torchMode = on ? .on : .off
        device.unlockForConfiguration()
    }

    deinit {
        captureSession.stopRunning()
    }
}

final class QRMetadataDelegate: NSObject, AVCaptureMetadataOutputObjectsDelegate {
    var onCodeScanned: ((String) -> Void)?

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              object.type == .qr,
              let value = object.stringValue else { return }
        onCodeScanned?(value)
    }
}
