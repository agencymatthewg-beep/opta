//
//  CameraPreviewView.swift
//  Opta Scan
//
//  UIViewRepresentable wrapper for AVCaptureVideoPreviewLayer
//  Created by Matthew Byrden
//

import AVFoundation
import SwiftUI

struct CameraPreviewView: UIViewRepresentable {

    let session: AVCaptureSession

    func makeUIView(context: Context) -> CameraPreviewUIView {
        let view = CameraPreviewUIView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: CameraPreviewUIView, context: Context) {
        // Session is already set, no updates needed
    }
}

// MARK: - Camera Preview UIView

class CameraPreviewUIView: UIView {

    override class var layerClass: AnyClass {
        AVCaptureVideoPreviewLayer.self
    }

    var previewLayer: AVCaptureVideoPreviewLayer {
        layer as! AVCaptureVideoPreviewLayer
    }
}
