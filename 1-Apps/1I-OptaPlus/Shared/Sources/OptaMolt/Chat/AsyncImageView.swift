//
//  AsyncImageView.swift
//  OptaMolt
//
//  Renders inline images with async loading, disk caching, and expand-to-preview.
//  Implements Opta glass styling with loading shimmer and error states.
//
//  Plan 07-03: Inline Image Loading and Caching
//

import SwiftUI

// MARK: - AsyncImageView (Stub)

/// Async image view for displaying markdown inline images
///
/// This is the initial stub implementation. Full implementation will add:
/// - Disk caching via ImageCache actor (Task 3)
/// - Loading shimmer animation (Task 5)
/// - Tap-to-expand interaction (Task 6)
/// - Error states and retry (Task 5)
///
/// Usage:
/// ```swift
/// AsyncImageView(data: ImageData(url: url, altText: "Description"))
/// ```
public struct AsyncImageView: View {
    /// The image data containing URL and alt text
    let data: ImageData

    public init(data: ImageData) {
        self.data = data
    }

    public var body: some View {
        // Stub implementation - will be expanded in Tasks 4-6
        AsyncImage(url: data.url) { phase in
            switch phase {
            case .empty:
                // Loading state
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.optaSurface)
                    .frame(height: 150)
                    .overlay(
                        ProgressView()
                            .tint(.optaPurple)
                    )
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            case .failure:
                // Error state
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.optaSurface)
                    .frame(height: 100)
                    .overlay(
                        VStack(spacing: 8) {
                            Image(systemName: "photo.badge.exclamationmark")
                                .foregroundColor(.optaTextMuted)
                            Text("Failed to load image")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                        }
                    )
            @unknown default:
                EmptyView()
            }
        }
        .accessibilityLabel(data.altText)
    }
}

// MARK: - Preview

#if DEBUG
struct AsyncImageView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            // Valid image
            AsyncImageView(data: ImageData(
                url: URL(string: "https://picsum.photos/200/150")!,
                altText: "Sample image"
            ))

            // With caption
            AsyncImageView(data: ImageData(
                url: URL(string: "https://picsum.photos/200/100")!,
                altText: "Another image",
                caption: "A beautiful landscape"
            ))
        }
        .padding()
        .background(Color.optaBackground)
    }
}
#endif
