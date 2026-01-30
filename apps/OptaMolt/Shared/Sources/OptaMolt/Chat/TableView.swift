//
//  TableView.swift
//  OptaMolt
//
//  Renders markdown tables as styled SwiftUI views with scrollable columns,
//  headers, and alternating row colors.
//

import SwiftUI

/// A view that renders a TableData as a scrollable, styled table
public struct TableView: View {
    /// The table data to render
    let data: TableData

    /// Text color for table content
    let textColor: Color

    /// Initialize with table data
    /// - Parameters:
    ///   - data: The TableData to render
    ///   - textColor: Base color for text (default: optaTextPrimary)
    public init(data: TableData, textColor: Color = .optaTextPrimary) {
        self.data = data
        self.textColor = textColor
    }

    public var body: some View {
        // Placeholder - will be fully implemented in Task 3
        Text("Table: \(data.headers.joined(separator: ", "))")
            .foregroundColor(textColor)
    }
}

// MARK: - Preview

#if DEBUG
struct TableView_Previews: PreviewProvider {
    static var previews: some View {
        let sampleData = TableData(
            headers: ["Name", "Value"],
            rows: [["Item 1", "100"], ["Item 2", "200"]],
            alignments: [.left, .right]
        )

        TableView(data: sampleData)
            .padding()
            .background(Color.optaBackground)
            .previewLayout(.sizeThatFits)
    }
}
#endif
