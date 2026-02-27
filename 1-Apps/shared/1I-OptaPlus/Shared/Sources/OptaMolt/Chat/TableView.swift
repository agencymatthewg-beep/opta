//
//  TableView.swift
//  OptaMolt
//
//  Renders markdown tables as styled SwiftUI views with scrollable columns,
//  headers, and alternating row colors. Integrates with Opta design system.
//

import SwiftUI

// MARK: - Table Layout Constants

private enum TableLayout {
    /// Minimum column width
    static let minColumnWidth: CGFloat = 60

    /// Maximum column width
    static let maxColumnWidth: CGFloat = 200

    /// Horizontal cell padding
    static let cellPaddingH: CGFloat = 8

    /// Vertical cell padding
    static let cellPaddingV: CGFloat = 6

    /// Border width
    static let borderWidth: CGFloat = 0.5

    /// Outer corner radius
    static let cornerRadius: CGFloat = 8
}

// MARK: - TableView

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
        ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                // Header row
                headerRow

                // Header separator — slightly thicker
                Rectangle()
                    .fill(Color.optaBorder)
                    .frame(height: 1)

                // Data rows
                ForEach(Array(data.rows.enumerated()), id: \.offset) { index, row in
                    dataRow(row, isEven: index % 2 == 0)

                    // Row separator (except after last row)
                    if index < data.rows.count - 1 {
                        Rectangle()
                            .fill(Color.optaBorder)
                            .frame(height: TableLayout.borderWidth)
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: TableLayout.cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: TableLayout.cornerRadius)
                    .stroke(Color.optaBorder, lineWidth: TableLayout.borderWidth)
            )
        }
    }

    // MARK: - Header Row

    private var headerRow: some View {
        HStack(spacing: 0) {
            ForEach(Array(data.headers.enumerated()), id: \.offset) { index, header in
                headerCell(header, alignment: alignment(for: index))

                if index < data.headers.count - 1 {
                    Rectangle()
                        .fill(Color.optaBorder)
                        .frame(width: TableLayout.borderWidth)
                }
            }
        }
        .background(Color.optaElevated)
    }

    private func headerCell(_ text: String, alignment: TableData.TableAlignment) -> some View {
        Text(text)
            .font(.sora(14, weight: .medium))
            .foregroundColor(.optaTextPrimary)
            .multilineTextAlignment(textAlignment(for: alignment))
            .padding(.horizontal, TableLayout.cellPaddingH)
            .padding(.vertical, TableLayout.cellPaddingV)
            .frame(minWidth: TableLayout.minColumnWidth, maxWidth: TableLayout.maxColumnWidth, alignment: frameAlignment(for: alignment))
    }

    // MARK: - Data Row

    private func dataRow(_ row: [String], isEven: Bool) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(row.enumerated()), id: \.offset) { index, cell in
                dataCell(cell, alignment: alignment(for: index))

                if index < row.count - 1 {
                    Rectangle()
                        .fill(Color.optaBorder)
                        .frame(width: TableLayout.borderWidth)
                }
            }
        }
        .background(isEven ? Color.optaElevated.opacity(0.4) : Color.clear)
    }

    private func dataCell(_ text: String, alignment: TableData.TableAlignment) -> some View {
        Text(text)
            .font(.sora(13, weight: .regular))
            .foregroundColor(.optaTextSecondary)
            .multilineTextAlignment(textAlignment(for: alignment))
            .padding(.horizontal, TableLayout.cellPaddingH)
            .padding(.vertical, TableLayout.cellPaddingV)
            .frame(minWidth: TableLayout.minColumnWidth, maxWidth: TableLayout.maxColumnWidth, alignment: frameAlignment(for: alignment))
    }

    // MARK: - Alignment Helpers

    private func alignment(for columnIndex: Int) -> TableData.TableAlignment {
        guard columnIndex < data.alignments.count else { return .left }
        return data.alignments[columnIndex]
    }

    private func textAlignment(for alignment: TableData.TableAlignment) -> TextAlignment {
        switch alignment {
        case .left: return .leading
        case .center: return .center
        case .right: return .trailing
        }
    }

    private func frameAlignment(for alignment: TableData.TableAlignment) -> Alignment {
        switch alignment {
        case .left: return .leading
        case .center: return .center
        case .right: return .trailing
        }
    }
}

// MARK: - Preview

#if DEBUG
struct TableView_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Simple 2-column table
                TableView(data: TableData(
                    headers: ["Name", "Value"],
                    rows: [
                        ["Item 1", "100"],
                        ["Item 2", "200"],
                        ["Item 3", "300"]
                    ],
                    alignments: [.left, .right]
                ))

                // 4-column table with mixed alignments
                TableView(data: TableData(
                    headers: ["ID", "Name", "Status", "Score"],
                    rows: [
                        ["001", "Alpha Test", "Active", "95.5"],
                        ["002", "Beta Test", "Pending", "87.2"],
                        ["003", "Gamma Test", "Complete", "99.1"],
                        ["004", "Delta Test", "Active", "72.8"]
                    ],
                    alignments: [.center, .left, .center, .right]
                ))

                // Wide table (scrollable)
                TableView(data: TableData(
                    headers: ["Column A", "Column B", "Column C", "Column D", "Column E", "Column F"],
                    rows: [
                        ["Data A1", "Data B1", "Data C1", "Data D1", "Data E1", "Data F1"],
                        ["Data A2", "Data B2", "Data C2", "Data D2", "Data E2", "Data F2"]
                    ],
                    alignments: [.left, .center, .right, .left, .center, .right]
                ))

                // Header-only table (streaming state)
                TableView(data: TableData(
                    headers: ["Loading", "Data", "Soon"],
                    rows: [],
                    alignments: [.left, .center, .right]
                ))
            }
            .padding()
        }
        .background(Color.optaBackground)
        .preferredColorScheme(.dark)
        .previewLayout(.sizeThatFits)
    }
}
#endif
