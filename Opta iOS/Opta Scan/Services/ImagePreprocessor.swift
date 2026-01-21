//
//  ImagePreprocessor.swift
//  Opta Scan
//
//  Image preprocessing for vision model input
//  Part of Phase 19: Vision Inference
//

import UIKit

// MARK: - Image Preprocessor

enum ImagePreprocessor {

    // MARK: - Configuration

    /// Target size for vision model input
    static let targetSize = CGSize(width: 560, height: 560)

    /// JPEG compression quality (0.0-1.0)
    static let compressionQuality: CGFloat = 0.9

    /// Maximum dimension before downscaling
    static let maxDimension: CGFloat = 2048

    // MARK: - Preprocessing

    /// Prepare image for vision model
    /// - Parameter image: Original UIImage
    /// - Returns: Preprocessed UIImage at target size
    static func prepare(_ image: UIImage) -> UIImage {
        // Step 1: Downscale if too large (memory safety)
        let safeImage = constrainSize(image, maxDimension: maxDimension)

        // Step 2: Resize to target dimensions
        let resized = resize(safeImage, to: targetSize)

        return resized
    }

    /// Convert image to JPEG data for model input
    /// - Parameter image: Preprocessed UIImage
    /// - Returns: JPEG data or nil if conversion fails
    static func toJPEGData(_ image: UIImage) -> Data? {
        image.jpegData(compressionQuality: compressionQuality)
    }

    /// Full pipeline: prepare and convert to data
    /// - Parameter image: Original UIImage
    /// - Returns: Preprocessed JPEG data ready for model
    static func preprocess(_ image: UIImage) -> Data? {
        let prepared = prepare(image)
        return toJPEGData(prepared)
    }

    // MARK: - Private Helpers

    private static func constrainSize(_ image: UIImage, maxDimension: CGFloat) -> UIImage {
        let size = image.size
        let maxSide = max(size.width, size.height)

        guard maxSide > maxDimension else {
            return image
        }

        let scale = maxDimension / maxSide
        let newSize = CGSize(
            width: size.width * scale,
            height: size.height * scale
        )

        return resize(image, to: newSize)
    }

    private static func resize(_ image: UIImage, to targetSize: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1.0  // Exact pixel dimensions
        format.opaque = true  // No alpha channel needed

        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)

        return renderer.image { context in
            // Use high-quality interpolation
            context.cgContext.interpolationQuality = .high

            // Calculate aspect-fill rect (center crop)
            let rect = aspectFillRect(for: image.size, in: targetSize)
            image.draw(in: rect)
        }
    }

    private static func aspectFillRect(for sourceSize: CGSize, in targetSize: CGSize) -> CGRect {
        let sourceAspect = sourceSize.width / sourceSize.height
        let targetAspect = targetSize.width / targetSize.height

        var drawSize = targetSize
        var origin = CGPoint.zero

        if sourceAspect > targetAspect {
            // Source is wider - fit height, crop width
            drawSize.width = targetSize.height * sourceAspect
            origin.x = (targetSize.width - drawSize.width) / 2
        } else {
            // Source is taller - fit width, crop height
            drawSize.height = targetSize.width / sourceAspect
            origin.y = (targetSize.height - drawSize.height) / 2
        }

        return CGRect(origin: origin, size: drawSize)
    }
}

// MARK: - UIImage Extension

extension UIImage {
    /// Preprocessed version ready for vision model
    var preprocessedForVision: UIImage {
        ImagePreprocessor.prepare(self)
    }

    /// JPEG data ready for vision model input
    var visionModelData: Data? {
        ImagePreprocessor.preprocess(self)
    }
}
