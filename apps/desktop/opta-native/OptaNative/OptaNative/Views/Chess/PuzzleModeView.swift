//
//  PuzzleModeView.swift
//  OptaNative
//
//  Chess puzzle mode view with Lichess-style puzzle presentation.
//  Follows Opta's obsidian glass design system.
//  Created for Opta Native macOS - Phase 100
//

import SwiftUI

struct PuzzleModeView: View {
    @State private var viewModel = PuzzleViewModel()
    @State private var showStats = false
    @State private var boardAppeared = false

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background
                atmosphericBackground

                HStack(spacing: 0) {
                    Spacer()

                    // Main puzzle area
                    VStack(spacing: 24) {
                        // Puzzle info header
                        puzzleHeader

                        // The Board
                        puzzleBoard
                            .frame(
                                width: min(geometry.size.width * 0.55, geometry.size.height * 0.70),
                                height: min(geometry.size.width * 0.55, geometry.size.height * 0.70)
                            )

                        // Feedback area
                        feedbackArea
                    }
                    .padding(.vertical, 24)

                    Spacer()

                    // Side panel
                    sidePanel
                        .frame(width: 280)
                        .padding(.trailing, 24)
                }

                // Feedback overlay
                if viewModel.showFeedback {
                    feedbackOverlay
                }

                // Hint overlay
                if viewModel.showHint {
                    hintOverlay
                }
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.6).delay(0.2)) {
                boardAppeared = true
            }
        }
    }

    // MARK: - Background

    private var atmosphericBackground: some View {
        ZStack {
            Color.optaVoid.ignoresSafeArea()

            RadialGradient(
                colors: [
                    Color.optaElectricBlue.opacity(0.06),
                    Color.optaNeonPurple.opacity(0.03),
                    .clear
                ],
                center: .center,
                startRadius: 100,
                endRadius: 500
            )
            .ignoresSafeArea()
        }
    }

    // MARK: - Puzzle Header

    private var puzzleHeader: some View {
        HStack(spacing: 16) {
            // Puzzle rating
            VStack(alignment: .leading, spacing: 4) {
                Text("Puzzle Rating")
                    .font(.optaSubtitle(size: 10))
                    .foregroundStyle(Color.optaTextMuted)

                Text("\(viewModel.puzzleRating)")
                    .font(.optaSectionHeader(size: 24))
                    .foregroundStyle(ratingColor)
            }

            Spacer()

            // Status
            Text(viewModel.statusText)
                .font(.optaBodyMedium)
                .foregroundStyle(statusColor)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(statusColor.opacity(0.15))
                        .overlay(
                            Capsule()
                                .strokeBorder(statusColor.opacity(0.3), lineWidth: 1)
                        )
                )

            Spacer()

            // Player color indicator
            VStack(alignment: .trailing, spacing: 4) {
                Text("You play as")
                    .font(.optaSubtitle(size: 10))
                    .foregroundStyle(Color.optaTextMuted)

                HStack(spacing: 6) {
                    Circle()
                        .fill(viewModel.playerColor == .white ? Color.white : Color.black)
                        .frame(width: 16, height: 16)
                        .overlay(
                            Circle()
                                .strokeBorder(Color.optaTextMuted, lineWidth: 1)
                        )

                    Text(viewModel.playerColor == .white ? "White" : "Black")
                        .font(.optaSubtitle(size: 14))
                        .foregroundStyle(Color.optaTextPrimary)
                }
            }
        }
        .padding(.horizontal, 32)
    }

    private var ratingColor: Color {
        let rating = viewModel.puzzleRating
        if rating < 1200 { return Color.optaSuccess }
        if rating < 1600 { return Color.optaElectricBlue }
        if rating < 2000 { return Color.optaNeonPurple }
        return Color.optaWarning
    }

    private var statusColor: Color {
        switch viewModel.puzzleState {
        case .solved, .correct:
            return Color.optaSuccess
        case .failed, .incorrect:
            return Color.optaNeonRed
        case .waitingForPlayerMove:
            return Color.optaElectricBlue
        default:
            return Color.optaTextSecondary
        }
    }

    // MARK: - Puzzle Board

    private var puzzleBoard: some View {
        ZStack {
            // Board glow
            RoundedRectangle(cornerRadius: 16)
                .fill(
                    RadialGradient(
                        colors: [
                            Color.optaElectricBlue.opacity(0.12),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 50,
                        endRadius: 300
                    )
                )
                .blur(radius: 40)
                .scaleEffect(1.15)
                .opacity(boardAppeared ? 1 : 0)

            // Board
            VStack(spacing: 0) {
                ForEach(0..<8, id: \.self) { row in
                    HStack(spacing: 0) {
                        ForEach(0..<8, id: \.self) { col in
                            let rank = viewModel.playerColor == .white ? 7 - row : row
                            let file = viewModel.playerColor == .white ? col : 7 - col
                            let pos = Position(rank: rank, file: file)

                            PuzzleSquareView(
                                position: pos,
                                piece: viewModel.boardState.board.piece(at: pos),
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
                                Color.optaElectricBlue.opacity(0.3),
                                Color.optaNeonPurple.opacity(0.2)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 2
                    )
            )
            .shadow(color: .black.opacity(0.4), radius: 25, x: 0, y: 12)
            .scaleEffect(boardAppeared ? 1.0 : 0.95)
            .opacity(boardAppeared ? 1 : 0)
        }
    }

    // MARK: - Feedback Area

    private var feedbackArea: some View {
        HStack(spacing: 16) {
            // Hint button
            Button(action: { viewModel.showHintAction() }) {
                HStack(spacing: 6) {
                    Image(systemName: "lightbulb.fill")
                    Text("Hint")
                }
                .font(.opta(size: 13, weight: .medium))
                .foregroundStyle(Color.optaTextSecondary)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(
                    Capsule()
                        .fill(Color.optaSurface.opacity(0.5))
                        .overlay(
                            Capsule()
                                .strokeBorder(Color.optaGlassBorder, lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)
            .disabled(viewModel.puzzleState != .waitingForPlayerMove)
            .opacity(viewModel.puzzleState == .waitingForPlayerMove ? 1 : 0.5)

            // Theme tags
            if !viewModel.puzzleThemes.isEmpty {
                HStack(spacing: 8) {
                    ForEach(viewModel.puzzleThemes.prefix(3), id: \.self) { theme in
                        Text(theme.capitalized)
                            .font(.optaSubtitle(size: 10))
                            .foregroundStyle(Color.optaTextMuted)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule()
                                    .fill(Color.optaSurface.opacity(0.3))
                            )
                    }
                }
            }
        }
    }

    // MARK: - Side Panel

    private var sidePanel: some View {
        VStack(spacing: 20) {
            // User stats
            VStack(spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Your Rating")
                            .font(.optaSubtitle(size: 10))
                            .foregroundStyle(Color.optaTextMuted)

                        Text("\(viewModel.userRating)")
                            .font(.optaSectionHeader(size: 28))
                            .foregroundStyle(Color.optaTextPrimary)
                    }

                    Spacer()

                    // Streak
                    if viewModel.streak > 0 {
                        VStack(alignment: .trailing, spacing: 4) {
                            Text("Streak")
                                .font(.optaSubtitle(size: 10))
                                .foregroundStyle(Color.optaTextMuted)

                            HStack(spacing: 4) {
                                Image(systemName: "flame.fill")
                                    .foregroundStyle(Color.optaWarning)
                                Text("\(viewModel.streak)")
                                    .font(.optaSectionHeader(size: 20))
                                    .foregroundStyle(Color.optaWarning)
                            }
                        }
                    }
                }
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.optaSurface.opacity(0.5))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(Color.optaGlassBorder, lineWidth: 1)
                        )
                )
            }

            // Expected rating change
            if viewModel.puzzleState == .waitingForPlayerMove {
                HStack {
                    Text("If you solve:")
                        .font(.optaSubtitle(size: 11))
                        .foregroundStyle(Color.optaTextMuted)

                    Spacer()

                    Text("+\(viewModel.ratingChange)")
                        .font(.optaBodyMedium)
                        .foregroundStyle(Color.optaSuccess)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.optaSuccess.opacity(0.1))
                )
            }

            Spacer()

            // Action buttons
            VStack(spacing: 12) {
                // Next puzzle
                Button(action: {
                    Task {
                        await viewModel.loadNextPuzzle()
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.right.circle.fill")
                        Text(viewModel.puzzleState == .solved || viewModel.puzzleState == .failed ? "Next Puzzle" : "Skip")
                    }
                    .font(.opta(size: 14, weight: .semibold))
                    .foregroundStyle(Color.optaTextPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.optaNeonPurple.opacity(0.2))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .strokeBorder(Color.optaNeonPurple.opacity(0.5), lineWidth: 1)
                            )
                    )
                }
                .buttonStyle(.plain)

                // Stats button
                Button(action: { showStats.toggle() }) {
                    HStack(spacing: 8) {
                        Image(systemName: "chart.bar.fill")
                        Text("Statistics")
                    }
                    .font(.opta(size: 13, weight: .medium))
                    .foregroundStyle(Color.optaTextSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.optaSurface.opacity(0.3))
                    )
                }
                .buttonStyle(.plain)
            }

            // Puzzle mode badge
            HStack(spacing: 6) {
                Image(systemName: "puzzlepiece.fill")
                    .font(.system(size: 12))
                Text("Puzzle Mode")
                    .font(.optaSubtitle(size: 11))
            }
            .foregroundStyle(Color.optaElectricBlue)
            .padding(.top, 8)
        }
        .padding(.vertical, 24)
    }

    // MARK: - Overlays

    private var feedbackOverlay: some View {
        VStack {
            Spacer()

            Text(viewModel.feedbackText)
                .font(.optaSectionHeader(size: 32))
                .foregroundStyle(viewModel.puzzleState == .correct || viewModel.puzzleState == .solved ? Color.optaSuccess : Color.optaNeonRed)
                .padding(.horizontal, 48)
                .padding(.vertical, 24)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.optaSurface.opacity(0.95))
                        .shadow(color: .black.opacity(0.5), radius: 30)
                )
                .transition(.scale.combined(with: .opacity))

            Spacer()
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.7), value: viewModel.showFeedback)
    }

    private var hintOverlay: some View {
        VStack {
            Spacer()

            VStack(spacing: 12) {
                Image(systemName: "lightbulb.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(Color.optaWarning)

                Text(viewModel.hintText)
                    .font(.optaBodyMedium)
                    .foregroundStyle(Color.optaTextPrimary)
                    .multilineTextAlignment(.center)

                Button("Got it") {
                    viewModel.dismissHint()
                }
                .font(.optaSubtitle(size: 12))
                .foregroundStyle(Color.optaTextSecondary)
                .padding(.top, 8)
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.optaSurface.opacity(0.95))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(Color.optaWarning.opacity(0.3), lineWidth: 1)
                    )
                    .shadow(color: .black.opacity(0.5), radius: 30)
            )
            .transition(.scale.combined(with: .opacity))

            Spacer()
        }
        .onTapGesture {
            viewModel.dismissHint()
        }
    }
}

// MARK: - Puzzle Square View

struct PuzzleSquareView: View {
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
            // Square background
            Rectangle()
                .fill(squareColor)

            // Last move highlight
            if isLastMove {
                Rectangle()
                    .fill(Color.optaElectricBlue.opacity(0.25))
            }

            // Selection highlight
            if isSelected {
                Rectangle()
                    .fill(Color.optaNeonPurple.opacity(0.4))

                Rectangle()
                    .strokeBorder(Color.optaNeonPurple, lineWidth: 3)
            }

            // Legal move indicator
            if isLegalDestination {
                if piece != nil {
                    // Capture indicator
                    CaptureIndicator()
                } else {
                    // Move dot
                    Circle()
                        .fill(Color.optaNeonPurple.opacity(0.4))
                        .frame(width: 14, height: 14)
                }
            }

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
        isLightSquare ? Color.optaMuted : Color.optaSurface
    }
}

// MARK: - Preview

#Preview {
    PuzzleModeView()
        .frame(width: 1100, height: 750)
}
