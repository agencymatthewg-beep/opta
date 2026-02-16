//
//  QRScannerView.swift
//  OptaPlusIOS
//
//  QR code scanner for bot pairing — wraps DataScannerViewController (VisionKit)
//  to recognise `optaplus://pair?...` URLs from QR codes.
//

import SwiftUI
import VisionKit
import OptaMolt

// MARK: - QR Scanner Sheet

/// Full-screen modal that presents the camera-based QR scanner with a scan-region overlay.
///
/// On recognition of a valid `optaplus://pair?...` QR code, it calls the completion
/// handler with the parsed `PairingInfo`, shows a brief success indicator, then dismisses.
struct QRScannerSheet: View {
    var onPairingDetected: (PairingInfo) -> Void
    var onDismiss: () -> Void

    @State private var showSuccess = false
    @State private var detectedInfo: PairingInfo?

    var body: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()

            if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                QRScannerRepresentable(
                    onPairingDetected: { info in
                        guard !showSuccess else { return }
                        detectedInfo = info
                        withAnimation(.optaSpring) {
                            showSuccess = true
                        }
                        // Brief delay then dismiss
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                            onPairingDetected(info)
                            onDismiss()
                        }
                    }
                )
                .ignoresSafeArea()

                // Semi-transparent overlay with centered scan region
                scanOverlay
            } else {
                unsupportedView
            }

            // Top title
            VStack {
                Text("Scan QR Code")
                    .font(.soraHeadline)
                    .foregroundColor(.optaTextPrimary)
                    .padding(.top, 16)
                    .shadow(color: .black.opacity(0.6), radius: 4, y: 2)

                Spacer()
            }

            // Success indicator
            if showSuccess {
                successView
            }

            // Bottom cancel button
            VStack {
                Spacer()

                Button {
                    onDismiss()
                } label: {
                    Text("Cancel")
                        .font(.soraHeadline)
                        .foregroundColor(.optaTextPrimary)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 14)
                        .background(
                            Capsule()
                                .fill(Color.optaSurface.opacity(0.8))
                                .overlay(
                                    Capsule()
                                        .stroke(Color.optaBorder, lineWidth: 0.5)
                                )
                        )
                }
                .padding(.bottom, 40)
                .opacity(showSuccess ? 0 : 1)
                .animation(.optaSnap, value: showSuccess)
            }
        }
    }

    // MARK: - Scan Overlay

    private var scanOverlay: some View {
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height) * 0.65
            let rect = CGRect(
                x: (geo.size.width - side) / 2,
                y: (geo.size.height - side) / 2,
                width: side,
                height: side
            )

            ZStack {
                // Darkened surround
                ScanRegionMask(cutoutRect: rect)
                    .fill(Color.black.opacity(0.55))
                    .allowsHitTesting(false)

                // Corner brackets around scan region
                ScanCornerBrackets(rect: rect)
                    .stroke(
                        LinearGradient(
                            colors: [.optaPrimary, .optaPrimaryGlow],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 3
                    )
                    .optaBreathing(minOpacity: 0.6, maxOpacity: 1.0)
                    .allowsHitTesting(false)

                // Hint text below scan region
                Text("Point at an OptaPlus pairing QR code")
                    .font(.soraCaption)
                    .foregroundColor(.optaTextSecondary)
                    .position(x: geo.size.width / 2, y: rect.maxY + 28)
                    .allowsHitTesting(false)
            }
        }
        .ignoresSafeArea()
    }

    // MARK: - Success View

    private var successView: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.optaGreen.opacity(0.15))
                    .frame(width: 80, height: 80)

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 44))
                    .foregroundColor(.optaGreen)
                    .symbolEffect(.bounce, value: showSuccess)
            }

            Text("Pairing detected!")
                .font(.soraHeadline)
                .foregroundColor(.optaTextPrimary)

            if let info = detectedInfo, let host = info.host {
                Text(host)
                    .font(.soraCaption)
                    .foregroundColor(.optaTextSecondary)
            }
        }
        .padding(32)
        .glassStrong()
        .scaleEffect(showSuccess ? 1.0 : 0.7)
        .opacity(showSuccess ? 1.0 : 0)
        .animation(.optaSpring, value: showSuccess)
    }

    // MARK: - Unsupported View

    private var unsupportedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "camera.badge.ellipsis")
                .font(.system(size: 48))
                .foregroundColor(.optaTextMuted)

            Text("QR scanning not available")
                .font(.soraTitle3)
                .foregroundColor(.optaTextPrimary)

            Text("This device does not support camera-based scanning. Use a deep link or clipboard paste instead.")
                .font(.soraBody)
                .foregroundColor(.optaTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button {
                onDismiss()
            } label: {
                Text("Dismiss")
                    .font(.soraHeadline)
                    .foregroundColor(.optaVoid)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Capsule().fill(Color.optaPrimary))
            }
            .padding(.top, 8)
        }
        .ignition(delay: 0.1)
    }
}

// MARK: - DataScannerViewController Representable

/// Wraps `DataScannerViewController` for use in SwiftUI.
/// Configured to recognise QR barcodes only.
struct QRScannerRepresentable: UIViewControllerRepresentable {
    var onPairingDetected: (PairingInfo) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {
        // Start scanning when the view appears
        if !uiViewController.isScanning {
            try? uiViewController.startScanning()
        }
    }

    static func dismantleUIViewController(_ uiViewController: DataScannerViewController, coordinator: Coordinator) {
        uiViewController.stopScanning()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onPairingDetected: onPairingDetected)
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onPairingDetected: (PairingInfo) -> Void
        private var hasDetected = false

        init(onPairingDetected: @escaping (PairingInfo) -> Void) {
            self.onPairingDetected = onPairingDetected
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didAdd addedItems: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            guard !hasDetected else { return }

            for item in addedItems {
                guard case .barcode(let barcode) = item else { continue }

                // Try payload string first, then URL
                let urlString: String? = barcode.payloadStringValue

                guard let raw = urlString,
                      raw.hasPrefix("optaplus://pair"),
                      let url = URL(string: raw),
                      let info = PairingCoordinator.parseDeepLink(url)
                else { continue }

                hasDetected = true
                dataScanner.stopScanning()

                DispatchQueue.main.async { [self] in
                    onPairingDetected(info)
                }
                return
            }
        }
    }
}

// MARK: - Scan Region Mask

/// Shape that fills the entire frame except a centered rectangular cutout.
struct ScanRegionMask: Shape {
    let cutoutRect: CGRect

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addRect(rect)
        path.addRoundedRect(
            in: cutoutRect,
            cornerSize: CGSize(width: 16, height: 16)
        )
        return path
    }

    var style: FillStyle {
        FillStyle(eoFill: true)
    }

    func fill<S: ShapeStyle>(
        _ content: S,
        style fillStyle: FillStyle = FillStyle()
    ) -> some View {
        // Use even-odd fill to create the cutout
        _ShapeView(shape: self, style: content, fillStyle: FillStyle(eoFill: true))
    }
}

// MARK: - Scan Corner Brackets

/// Draws corner brackets (L-shaped) at each corner of a rectangle.
struct ScanCornerBrackets: Shape {
    let rect: CGRect
    private let bracketLength: CGFloat = 24
    private let cornerRadius: CGFloat = 6

    func path(in _: CGRect) -> Path {
        var path = Path()

        // Top-left
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + bracketLength))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + cornerRadius))
        path.addQuadCurve(
            to: CGPoint(x: rect.minX + cornerRadius, y: rect.minY),
            control: CGPoint(x: rect.minX, y: rect.minY)
        )
        path.addLine(to: CGPoint(x: rect.minX + bracketLength, y: rect.minY))

        // Top-right
        path.move(to: CGPoint(x: rect.maxX - bracketLength, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - cornerRadius, y: rect.minY))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY + cornerRadius),
            control: CGPoint(x: rect.maxX, y: rect.minY)
        )
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + bracketLength))

        // Bottom-right
        path.move(to: CGPoint(x: rect.maxX, y: rect.maxY - bracketLength))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - cornerRadius))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX - cornerRadius, y: rect.maxY),
            control: CGPoint(x: rect.maxX, y: rect.maxY)
        )
        path.addLine(to: CGPoint(x: rect.maxX - bracketLength, y: rect.maxY))

        // Bottom-left
        path.move(to: CGPoint(x: rect.minX + bracketLength, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX + cornerRadius, y: rect.maxY))
        path.addQuadCurve(
            to: CGPoint(x: rect.minX, y: rect.maxY - cornerRadius),
            control: CGPoint(x: rect.minX, y: rect.maxY)
        )
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - bracketLength))

        return path
    }
}
