//
//  ChessBoardView.swift
//  OptaNative
//
//  Opta Chess Arena - Obsidian Glass Design
//
//  Design Philosophy:
//  - Instant Play: Game starts immediately, no setup screens
//  - 3-Click Moves: Dashboard → Chess → Piece → Destination
//  - Never Timed: Default untimed for relaxed play
//  - Board as Hero: Centered, immersive, atmospheric
//
//  Created for Opta Native macOS - Redesign v2.0
//

import SwiftUI

// MARK: - Opta Chess Theme (Using DesignSystem Tokens)

struct OptaChessTheme {
    // Board Colors - Obsidian Glass (aligned with DesignSystem)
    static let darkSquare = Color.optaSurface          // Deep obsidian
    static let lightSquare = Color.optaMuted           // Lighter obsidian (#27272A)

    // Interactive States
    static let selected = Color.optaNeonPurple         // Electric Violet selection
    static let legalMove = Color.optaNeonPurple.opacity(0.4)  // Valid destination
    static let lastMove = Color.optaElectricBlue.opacity(0.3) // Previous move highlight
    static let check = Color.optaNeonRed.opacity(0.5)  // King in check

    // Piece Colors (using design system grays)
    static let whitePiece = Color.optaTextPrimary      // #fafafa
    static let blackPiece = Color.optaSurface          // #18181b

    // Ambient
    static let boardGlow = Color.optaNeonPurple.opacity(0.15)
    static let boardBorder = Color.optaNeonPurple.opacity(0.3)
}

// MARK: - Main View

struct ChessBoardView: View {
    @State private var viewModel = ChessViewModel()
    @State private var showMoveList = false
    @State private var boardAppeared = false

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Atmospheric Background
                atmosphericBackground

                // Main Content
                HStack(spacing: 0) {
                    Spacer()

                    // Chess Arena (Centered)
                    VStack(spacing: 24) {
                        // Opponent indicator (AI or Black)
                        PlayerIndicator(
                            label: viewModel.opponentLabel,
                            isActive: !viewModel.isWhiteTurn,
                            capturedPieces: viewModel.capturedByWhite,
                            isAI: viewModel.aiEnabled,
                            isThinking: viewModel.isAIThinking
                        )

                        // The Board
                        chessBoard
                            .frame(
                                width: min(geometry.size.width * 0.65, geometry.size.height * 0.75),
                                height: min(geometry.size.width * 0.65, geometry.size.height * 0.75)
                            )

                        // Player indicator
                        PlayerIndicator(
                            label: "You",
                            isActive: viewModel.isWhiteTurn,
                            capturedPieces: viewModel.capturedByBlack,
                            isAI: false,
                            isThinking: false
                        )
                    }
                    .padding(.vertical, 32)

                    Spacer()

                    // Minimal Side Panel
                    sidePanel
                        .frame(width: 280)
                        .padding(.trailing, 24)
                }
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8).delay(0.2)) {
                boardAppeared = true
            }
        }
        .overlay {
            // Pawn Promotion Dialog
            if viewModel.showPromotionDialog {
                PromotionDialog(
                    color: viewModel.isWhiteTurn ? .white : .black,
                    onSelect: { pieceType in
                        viewModel.completePromotion(to: pieceType)
                    },
                    onCancel: {
                        viewModel.cancelPromotion()
                    }
                )
            }
        }
        // MARK: - Keyboard Shortcuts
        .onKeyboardShortcut(.newGame) {
            withAnimation(.spring(response: 0.4)) {
                viewModel.resetGame()
            }
        }
        .onKeyboardShortcut(.undo) {
            viewModel.undoMove()
        }
        .onKeyboardShortcut(.refresh) {
            // Refresh AI state if needed
            if viewModel.aiMode == .opta {
                Task {
                    await viewModel.reloadOptaAI()
                }
            }
        }
    }

    // MARK: - Atmospheric Background

    private var atmosphericBackground: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()

            // Radial glow behind board
            RadialGradient(
                colors: [
                    Color.optaNeonPurple.opacity(0.08),
                    Color.optaDeepPurple.opacity(0.04),
                    .clear
                ],
                center: .center,
                startRadius: 100,
                endRadius: 600
            )
            .ignoresSafeArea()

            // Subtle ambient particles effect (simulated with gradient)
            RadialGradient(
                colors: [
                    Color.optaElectricBlue.opacity(0.03),
                    .clear
                ],
                center: .bottomLeading,
                startRadius: 0,
                endRadius: 400
            )
            .ignoresSafeArea()
        }
    }

    // MARK: - Chess Board

    private var chessBoard: some View {
        ZStack {
            // Board Shadow & Glow
            RoundedRectangle(cornerRadius: 16)
                .fill(OptaChessTheme.boardGlow)
                .blur(radius: 40)
                .scaleEffect(1.1)
                .opacity(boardAppeared ? 1 : 0)

            // Board Container
            VStack(spacing: 0) {
                // Rank labels top (8-1 from black's perspective, but we show white's view)
                // Integrated into the board

                ForEach(0..<8, id: \.self) { row in
                    HStack(spacing: 0) {
                        ForEach(0..<8, id: \.self) { col in
                            let rank = 7 - row
                            let file = col
                            let pos = Position(rank: rank, file: file)

                            ChessSquareView(
                                position: pos,
                                piece: viewModel.state.board.piece(at: pos),
                                isSelected: viewModel.selectedSquare == pos,
                                isLegalDestination: viewModel.legalDestinations.contains(pos),
                                isLastMove: viewModel.lastMove?.from == pos || viewModel.lastMove?.to == pos,
                                onTap: { viewModel.selectSquare(pos) }
                            )
                        }
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(
                        LinearGradient(
                            colors: [
                                OptaChessTheme.boardBorder,
                                OptaChessTheme.boardBorder.opacity(0.1)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 2
                    )
            )
            .shadow(color: .black.opacity(0.5), radius: 30, x: 0, y: 15)
            .scaleEffect(boardAppeared ? 1.0 : 0.95)
            .opacity(boardAppeared ? 1 : 0)
        }
    }

    // MARK: - Side Panel (Minimal)

    private var sidePanel: some View {
        VStack(spacing: 20) {
            // Game Status
            VStack(spacing: 8) {
                Text(viewModel.gameStatus)
                    .font(.optaSectionHeader(size: 16))
                    .foregroundStyle(Color.optaTextPrimary)

                // Turn indicator dot
                Circle()
                    .fill(viewModel.isWhiteTurn ? Color.white : Color.black)
                    .frame(width: 12, height: 12)
                    .overlay(
                        Circle()
                            .strokeBorder(Color.optaNeonPurple, lineWidth: 2)
                    )
                    .shadow(color: Color.optaNeonPurple.opacity(0.5), radius: 8)
            }
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.optaSurface.opacity(0.5))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color.optaGlassBorder, lineWidth: 1)
                    )
            )

            // Move List (Collapsible)
            VStack(spacing: 12) {
                Button(action: { withAnimation(.spring(response: 0.3)) { showMoveList.toggle() } }) {
                    HStack {
                        Image(systemName: "list.number")
                            .foregroundStyle(Color.optaTextMuted)
                        Text("Moves")
                            .font(.optaSubtitle(size: 12))
                            .foregroundStyle(Color.optaTextSecondary)
                        Spacer()
                        Image(systemName: showMoveList ? "chevron.up" : "chevron.down")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .buttonStyle(.plain)

                if showMoveList {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 4) {
                            ForEach(Array(viewModel.moveHistory.enumerated()), id: \.offset) { index, move in
                                HStack(spacing: 8) {
                                    Text("\(index / 2 + 1).")
                                        .font(.optaMono)
                                        .foregroundStyle(Color.optaTextMuted)
                                        .frame(width: 24, alignment: .trailing)

                                    Text(move)
                                        .font(.optaMono)
                                        .foregroundStyle(index % 2 == 0 ? Color.optaTextPrimary : Color.optaTextSecondary)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                    .frame(maxHeight: 200)
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.optaSurface.opacity(0.3))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color.optaGlassBorder, lineWidth: 1)
                    )
            )

            // AI Mode Selector
            VStack(spacing: 12) {
                HStack {
                    Image(systemName: "brain")
                        .foregroundStyle(Color.optaNeonPurple)
                    Text("AI Mode")
                        .font(.optaSubtitle(size: 12))
                        .foregroundStyle(Color.optaTextSecondary)
                    Spacer()

                    if viewModel.aiMode == .opta && !viewModel.optaAILoaded {
                        ProgressView()
                            .scaleEffect(0.7)
                            .tint(Color.optaNeonPurple)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)

                Picker("AI Mode", selection: $viewModel.aiMode) {
                    ForEach(AIMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.bottom, 12)

                // Description
                Text(viewModel.aiMode.description)
                    .font(.optaSubtitle(size: 10))
                    .foregroundStyle(Color.optaTextMuted)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
            }
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.optaSurface.opacity(0.3))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(
                                viewModel.aiMode == .opta
                                    ? Color.optaNeonPurple.opacity(0.5)
                                    : Color.optaGlassBorder,
                                lineWidth: 1
                            )
                    )
            )

            Spacer()

            // Action Buttons
            VStack(spacing: 12) {
                // New Game Button
                Button(action: {
                    withAnimation(.spring(response: 0.4)) {
                        viewModel.resetGame()
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.counterclockwise")
                        Text("New Game")
                    }
                    .font(.opta(size: 14, weight: .semibold))
                    .foregroundStyle(Color.optaTextPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.optaSurface.opacity(0.6))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .strokeBorder(Color.optaNeonPurple.opacity(0.3), lineWidth: 1)
                            )
                    )
                }
                .buttonStyle(.plain)

                // Undo Button
                Button(action: { viewModel.undoMove() }) {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.uturn.backward")
                        Text("Undo")
                    }
                    .font(.opta(size: 14, weight: .medium))
                    .foregroundStyle(Color.optaTextSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.optaSurface.opacity(0.3))
                    )
                }
                .buttonStyle(.plain)
                .disabled(viewModel.moveHistory.isEmpty)
                .opacity(viewModel.moveHistory.isEmpty ? 0.5 : 1)
            }

            // Untimed indicator
            HStack(spacing: 6) {
                Image(systemName: "infinity")
                    .font(.system(size: 12))
                Text("Untimed")
                    .font(.optaSubtitle(size: 11))
            }
            .foregroundStyle(Color.optaTextMuted)
            .padding(.top, 8)

            Divider()
                .background(Color.optaGlassBorder)
                .padding(.vertical, 8)

            // Quick Actions
            VStack(spacing: 10) {
                // Puzzle Mode
                NavigationLink(destination: PuzzleModeView()) {
                    HStack(spacing: 8) {
                        Image(systemName: "puzzlepiece.fill")
                            .foregroundStyle(Color.optaElectricBlue)
                        Text("Puzzle Mode")
                            .font(.opta(size: 13, weight: .medium))
                            .foregroundStyle(Color.optaTextSecondary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.optaSurface.opacity(0.3))
                    )
                }
                .buttonStyle(.plain)

                // Import/Export
                HStack(spacing: 8) {
                    Button(action: { viewModel.importPGN() }) {
                        HStack(spacing: 4) {
                            Image(systemName: "square.and.arrow.down")
                            Text("Import")
                        }
                        .font(.optaSubtitle(size: 11))
                        .foregroundStyle(Color.optaTextSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.optaSurface.opacity(0.2))
                        )
                    }
                    .buttonStyle(.plain)

                    Button(action: { viewModel.exportPGN() }) {
                        HStack(spacing: 4) {
                            Image(systemName: "square.and.arrow.up")
                            Text("Export")
                        }
                        .font(.optaSubtitle(size: 11))
                        .foregroundStyle(Color.optaTextSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.optaSurface.opacity(0.2))
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(viewModel.moveHistory.isEmpty)
                    .opacity(viewModel.moveHistory.isEmpty ? 0.5 : 1)
                }
            }
        }
        .padding(.vertical, 24)
    }
}

// MARK: - Chess Square View

struct ChessSquareView: View {
    let position: Position
    let piece: ChessPiece?
    let isSelected: Bool
    let isLegalDestination: Bool
    let isLastMove: Bool
    let onTap: () -> Void

    private var isLightSquare: Bool {
        (position.rank + position.file) % 2 != 0
    }

    var body: some View {
        ZStack {
            // Square Background
            Rectangle()
                .fill(squareColor)

            // Last move highlight
            if isLastMove {
                Rectangle()
                    .fill(OptaChessTheme.lastMove)
            }

            // Selection highlight
            if isSelected {
                Rectangle()
                    .fill(OptaChessTheme.selected.opacity(0.5))

                // Pulsing border for selected
                Rectangle()
                    .strokeBorder(OptaChessTheme.selected, lineWidth: 3)
            }

            // Legal move indicator
            if isLegalDestination {
                if piece != nil {
                    // Capture indicator - corner triangles
                    CaptureIndicator()
                } else {
                    // Move indicator - center dot
                    Circle()
                        .fill(OptaChessTheme.legalMove)
                        .frame(width: 16, height: 16)
                        .shadow(color: OptaChessTheme.selected.opacity(0.5), radius: 4)
                }
            }

            // Coordinates (subtle, on edges only)
            coordinateLabels

            // Piece
            if let piece = piece {
                OptaChessPieceView(piece: piece, isSelected: isSelected)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }

    private var squareColor: Color {
        isLightSquare ? OptaChessTheme.lightSquare : OptaChessTheme.darkSquare
    }

    @ViewBuilder
    private var coordinateLabels: some View {
        // File labels on rank 1 (bottom)
        if position.rank == 0 {
            Text(["a","b","c","d","e","f","g","h"][position.file])
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(isLightSquare ? OptaChessTheme.darkSquare : OptaChessTheme.lightSquare.opacity(0.6))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                .padding(3)
        }

        // Rank labels on file a (left)
        if position.file == 0 {
            Text("\(position.rank + 1)")
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(isLightSquare ? OptaChessTheme.darkSquare : OptaChessTheme.lightSquare.opacity(0.6))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(3)
        }
    }
}

// MARK: - Capture Indicator (Corner Triangles)

struct CaptureIndicator: View {
    var body: some View {
        GeometryReader { geometry in
            let size = geometry.size.width * 0.25

            ZStack {
                // Top-left
                Triangle()
                    .fill(OptaChessTheme.legalMove)
                    .frame(width: size, height: size)
                    .position(x: size/2, y: size/2)

                // Top-right
                Triangle()
                    .fill(OptaChessTheme.legalMove)
                    .frame(width: size, height: size)
                    .rotationEffect(.degrees(90))
                    .position(x: geometry.size.width - size/2, y: size/2)

                // Bottom-left
                Triangle()
                    .fill(OptaChessTheme.legalMove)
                    .frame(width: size, height: size)
                    .rotationEffect(.degrees(-90))
                    .position(x: size/2, y: geometry.size.height - size/2)

                // Bottom-right
                Triangle()
                    .fill(OptaChessTheme.legalMove)
                    .frame(width: size, height: size)
                    .rotationEffect(.degrees(180))
                    .position(x: geometry.size.width - size/2, y: geometry.size.height - size/2)
            }
        }
    }
}

struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

// MARK: - Opta Chess Piece View (Custom Smooth Design)

struct OptaChessPieceView: View {
    let piece: ChessPiece
    let isSelected: Bool

    var body: some View {
        GeometryReader { geometry in
            let size = min(geometry.size.width, geometry.size.height) * 0.85

            ZStack {
                // Piece shape
                pieceShape(for: piece.type)
                    .fill(pieceFill)
                    .frame(width: size, height: size)
                    .overlay(
                        pieceShape(for: piece.type)
                            .stroke(pieceStroke, lineWidth: 1.5)
                            .frame(width: size, height: size)
                    )
                    // Inner highlight for depth
                    .overlay(
                        pieceShape(for: piece.type)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(piece.color == .white ? 0.4 : 0.15),
                                        .clear
                                    ],
                                    startPoint: .top,
                                    endPoint: .center
                                )
                            )
                            .frame(width: size * 0.9, height: size * 0.9)
                    )
                    // Drop shadow
                    .shadow(
                        color: Color.black.opacity(0.5),
                        radius: 4, x: 0, y: 3
                    )
                    // Selection glow
                    .shadow(
                        color: isSelected ? OptaChessTheme.selected.opacity(0.9) : .clear,
                        radius: isSelected ? 15 : 0
                    )
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .scaleEffect(isSelected ? 1.08 : 1.0)
        .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)
    }

    private var pieceFill: some ShapeStyle {
        if piece.color == .white {
            return AnyShapeStyle(
                LinearGradient(
                    colors: [
                        Color.optaTextPrimary,           // #fafafa
                        Color.optaTextSecondary,         // #a1a1aa
                        Color.optaTextMuted              // #71717a
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        } else {
            return AnyShapeStyle(
                LinearGradient(
                    colors: [
                        Color.optaBorder,                // #3f3f46
                        Color.optaMuted,                 // #27272a
                        Color.optaSurface                // #18181b
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
    }

    private var pieceStroke: some ShapeStyle {
        if piece.color == .white {
            return AnyShapeStyle(Color.optaTextMuted)     // #71717a
        } else {
            return AnyShapeStyle(Color.optaBorder)        // #3f3f46
        }
    }

    private func pieceShape(for type: ChessPieceType) -> AnyShape {
        chessPieceShape(for: type)
    }
}

// Note: AnyShape and piece shapes are defined in ChessPieceShapes.swift

// MARK: - Player Indicator

struct PlayerIndicator: View {
    let label: String
    let isActive: Bool
    let capturedPieces: [ChessPiece]
    var isAI: Bool = false
    var isThinking: Bool = false

    @State private var thinkingRotation: Double = 0

    var body: some View {
        HStack(spacing: 16) {
            // Active indicator
            ZStack {
                if isAI {
                    // AI indicator - Opta ring style
                    Circle()
                        .strokeBorder(
                            AngularGradient(
                                colors: [
                                    Color.optaNeonPurple,
                                    Color.optaDeepPurple,
                                    Color.optaNeonPurple
                                ],
                                center: .center
                            ),
                            lineWidth: 2
                        )
                        .frame(width: 14, height: 14)
                        .rotationEffect(.degrees(isThinking ? thinkingRotation : 0))

                    Circle()
                        .fill(Color.optaNeonPurple.opacity(0.3))
                        .frame(width: 8, height: 8)
                } else {
                    Circle()
                        .fill(Color.white)
                        .frame(width: 10, height: 10)
                }
            }
            .overlay(
                Circle()
                    .strokeBorder(
                        isActive ? Color.optaNeonPurple : Color.clear,
                        lineWidth: isAI ? 0 : 2
                    )
                    .frame(width: 14, height: 14)
            )
            .shadow(
                color: isActive ? Color.optaNeonPurple.opacity(0.6) : .clear,
                radius: isActive ? 6 : 0
            )
            .animation(.easeInOut(duration: 0.3), value: isActive)
            .onAppear {
                if isAI {
                    withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                        thinkingRotation = 360
                    }
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.optaSubtitle(size: 12))
                    .foregroundStyle(isActive ? Color.optaTextPrimary : Color.optaTextMuted)

                if isThinking {
                    Text("Thinking...")
                        .font(.optaMono.weight(.regular))
                        .foregroundStyle(Color.optaNeonPurple)
                        .opacity(0.8)
                }
            }

            // Captured pieces
            if !capturedPieces.isEmpty {
                HStack(spacing: 2) {
                    ForEach(capturedPieces.prefix(8)) { piece in
                        CapturedPieceView(piece: piece)
                            .frame(width: 18, height: 18)
                    }
                    if capturedPieces.count > 8 {
                        Text("+\(capturedPieces.count - 8)")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                }
            }

            Spacer()
        }
        .padding(.horizontal, 16)
    }
}

// Small captured piece display
struct CapturedPieceView: View {
    let piece: ChessPiece

    var body: some View {
        chessPieceShape(for: piece.type)
            .fill(piece.color == .white ? Color.white.opacity(0.5) : Color.black.opacity(0.8))
            .overlay(
                chessPieceShape(for: piece.type)
                    .stroke(piece.color == .white ? Color.gray.opacity(0.3) : Color.gray.opacity(0.5), lineWidth: 0.5)
            )
    }
}

// MARK: - Pawn Promotion Dialog

struct PromotionDialog: View {
    let color: ChessColor
    let onSelect: (ChessPieceType) -> Void
    let onCancel: () -> Void

    private let promotionPieces: [ChessPieceType] = [.queen, .rook, .bishop, .knight]

    var body: some View {
        ZStack {
            // Dimmed background
            Color.black.opacity(0.7)
                .ignoresSafeArea()
                .onTapGesture { onCancel() }

            // Promotion panel
            VStack(spacing: 20) {
                Text("Promote Pawn")
                    .font(.optaSectionHeader(size: 18))
                    .foregroundStyle(Color.optaTextPrimary)

                HStack(spacing: 16) {
                    ForEach(promotionPieces, id: \.self) { pieceType in
                        Button(action: { onSelect(pieceType) }) {
                            PromotionPieceButton(type: pieceType, color: color)
                        }
                        .buttonStyle(.plain)
                    }
                }

                Button("Cancel") { onCancel() }
                    .font(.optaSubtitle(size: 12))
                    .foregroundStyle(Color.optaTextMuted)
            }
            .padding(32)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.optaSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(Color.optaNeonPurple.opacity(0.3), lineWidth: 1)
                    )
                    .shadow(color: Color.optaNeonPurple.opacity(0.3), radius: 30)
            )
        }
    }
}

struct PromotionPieceButton: View {
    let type: ChessPieceType
    let color: ChessColor

    @State private var isHovered = false

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12)
                .fill(isHovered ? Color.optaNeonPurple.opacity(0.2) : Color.optaSurface.opacity(0.5))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(
                            isHovered ? Color.optaNeonPurple : Color.optaGlassBorder,
                            lineWidth: isHovered ? 2 : 1
                        )
                )
                .frame(width: 70, height: 70)

            chessPieceShape(for: type)
                .fill(color == .white ? Color.white : Color.black)
                .overlay(
                    chessPieceShape(for: type)
                        .stroke(color == .white ? Color.gray.opacity(0.3) : Color.gray.opacity(0.6), lineWidth: 1)
                )
                .frame(width: 50, height: 50)
                .shadow(color: isHovered ? Color.optaNeonPurple.opacity(0.5) : .clear, radius: 8)
        }
        .scaleEffect(isHovered ? 1.05 : 1.0)
        .animation(.spring(response: 0.25), value: isHovered)
        .onHover { isHovered = $0 }
    }
}

// MARK: - Preview

#Preview {
    ChessBoardView()
        .frame(width: 1200, height: 800)
}
