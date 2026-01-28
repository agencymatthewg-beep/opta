//
//  PhotoPickerButton.swift
//  Opta Scan
//
//  PhotosUI picker integration with design system styling
//  Created by Matthew Byrden
//

import PhotosUI
import SwiftUI

struct PhotoPickerButton: View {

    @Binding var selectedImage: UIImage?
    @State private var selectedItem: PhotosPickerItem?

    var body: some View {
        PhotosPicker(
            selection: $selectedItem,
            matching: .images,
            photoLibrary: .shared()
        ) {
            HStack(spacing: OptaDesign.Spacing.sm) {
                Image(systemName: "photo.on.rectangle")
                    .font(.system(size: 18, weight: .medium))
                Text("Library")
                    .font(.optaBody)
            }
            .foregroundStyle(Color.optaTextPrimary)
            .padding(.horizontal, OptaDesign.Spacing.lg)
            .padding(.vertical, OptaDesign.Spacing.md)
            .glassContent()
        }
        .onChange(of: selectedItem) { _, newItem in
            Task {
                await loadImage(from: newItem)
            }
        }
    }

    private func loadImage(from item: PhotosPickerItem?) async {
        guard let item = item else { return }

        do {
            if let data = try await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data) {
                await MainActor.run {
                    selectedImage = image
                    OptaHaptics.shared.success()
                }
            }
        } catch {
            print("Failed to load image: \(error.localizedDescription)")
        }
    }
}

#Preview {
    ZStack {
        Color.optaBackground.ignoresSafeArea()
        PhotoPickerButton(selectedImage: .constant(nil))
    }
}
