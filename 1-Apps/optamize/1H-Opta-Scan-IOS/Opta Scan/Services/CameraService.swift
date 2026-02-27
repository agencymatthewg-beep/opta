//
//  CameraService.swift
//  Opta Scan
//
//  AVFoundation camera service for real-time preview and capture
//  Created by Matthew Byrden
//

import AVFoundation
import SwiftUI

@MainActor
class CameraService: NSObject, ObservableObject {

    // MARK: - Published Properties

    @Published var isAuthorized = false
    @Published var isCameraAvailable = false
    @Published var capturedImage: UIImage?
    @Published var error: CameraError?

    // MARK: - Camera Session

    let session = AVCaptureSession()
    private var photoOutput = AVCapturePhotoOutput()
    private var videoDeviceInput: AVCaptureDeviceInput?

    // MARK: - State

    private var isConfigured = false

    // MARK: - Initialization

    override init() {
        super.init()
        isCameraAvailable = UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    // MARK: - Authorization

    func checkAuthorization() async {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            isAuthorized = true
        case .notDetermined:
            isAuthorized = await AVCaptureDevice.requestAccess(for: .video)
        case .denied, .restricted:
            isAuthorized = false
        @unknown default:
            isAuthorized = false
        }
    }

    // MARK: - Session Configuration

    func configure() async {
        guard !isConfigured else { return }
        guard isAuthorized else {
            error = .notAuthorized
            return
        }

        session.beginConfiguration()
        session.sessionPreset = .photo

        // Add video input
        do {
            guard let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
                error = .cameraUnavailable
                session.commitConfiguration()
                return
            }

            let videoInput = try AVCaptureDeviceInput(device: videoDevice)

            if session.canAddInput(videoInput) {
                session.addInput(videoInput)
                videoDeviceInput = videoInput
            } else {
                error = .cannotAddInput
                session.commitConfiguration()
                return
            }
        } catch {
            self.error = .configurationFailed
            session.commitConfiguration()
            return
        }

        // Add photo output
        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)
            photoOutput.isHighResolutionCaptureEnabled = true
            photoOutput.maxPhotoQualityPrioritization = .quality
        } else {
            error = .cannotAddOutput
            session.commitConfiguration()
            return
        }

        session.commitConfiguration()
        isConfigured = true
    }

    // MARK: - Session Control

    func start() {
        guard isConfigured, !session.isRunning else { return }
        Task.detached(priority: .userInitiated) { [weak self] in
            self?.session.startRunning()
        }
    }

    func stop() {
        guard session.isRunning else { return }
        Task.detached(priority: .userInitiated) { [weak self] in
            self?.session.stopRunning()
        }
    }

    // MARK: - Photo Capture

    func capturePhoto() {
        guard isConfigured else { return }

        let settings = AVCapturePhotoSettings()
        settings.flashMode = .auto

        photoOutput.capturePhoto(with: settings, delegate: self)
    }
}

// MARK: - AVCapturePhotoCaptureDelegate

extension CameraService: AVCapturePhotoCaptureDelegate {

    nonisolated func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        Task { @MainActor in
            if let error = error {
                self.error = .captureFailed
                print("Photo capture error: \(error.localizedDescription)")
                return
            }

            guard let imageData = photo.fileDataRepresentation(),
                  let image = UIImage(data: imageData) else {
                self.error = .captureFailed
                return
            }

            self.capturedImage = image
            OptaHaptics.shared.success()
        }
    }
}

// MARK: - Camera Error

enum CameraError: LocalizedError {
    case notAuthorized
    case cameraUnavailable
    case cannotAddInput
    case cannotAddOutput
    case configurationFailed
    case captureFailed

    var errorDescription: String? {
        switch self {
        case .notAuthorized:
            return "Camera access not authorized"
        case .cameraUnavailable:
            return "Camera is not available"
        case .cannotAddInput:
            return "Cannot add camera input"
        case .cannotAddOutput:
            return "Cannot add photo output"
        case .configurationFailed:
            return "Camera configuration failed"
        case .captureFailed:
            return "Photo capture failed"
        }
    }
}
