//
//  ChessAI.swift
//  OptaNative
//
//  Background AI computation with time-based cutoff and iterative deepening.
//  Runs on a dedicated actor to avoid blocking the main thread.
//
//  Created for Opta Native macOS - Audit Fix v1.0
//

import Foundation

// MARK: - Chess AI Actor (Thread-Safe Background Computation)

actor ChessAI {

    // MARK: - Configuration

    private let maxTimeMs: Int
    private var searchStartTime: Date?
    private var nodesSearched: Int = 0

    // Piece values for evaluation
    private let pieceValues: [ChessPieceType: Int] = [
        .pawn: 100,
        .knight: 320,
        .bishop: 330,
        .rook: 500,
        .queen: 900,
        .king: 20000
    ]

    init(maxTimeMs: Int = 2000) {
        self.maxTimeMs = maxTimeMs
    }

    // MARK: - Public API

    /// Calculate the best move using iterative deepening with time cutoff
    func calculateBestMove(
        state: ChessState,
        color: ChessColor,
        targetDepth: Int
    ) async -> ChessMove? {
        searchStartTime = Date()
        nodesSearched = 0

        let allMoves = generateAllLegalMoves(for: color, in: state)
        guard !allMoves.isEmpty else { return nil }

        // Iterative deepening - start shallow, go deeper until time runs out
        var bestMove: ChessMove? = allMoves.randomElement()

        for depth in 1...targetDepth {
            // Check time before each depth iteration
            if isTimeUp() { break }

            let result = await searchAtDepth(
                state: state,
                color: color,
                moves: allMoves,
                depth: depth
            )

            if let move = result.move, !isTimeUp() {
                bestMove = move
                // result.score available for future logging/debugging
            }
        }

        return bestMove
    }

    // MARK: - Search Implementation

    private func searchAtDepth(
        state: ChessState,
        color: ChessColor,
        moves: [ChessMove],
        depth: Int
    ) async -> (move: ChessMove?, score: Int) {
        var bestMove: ChessMove?
        var bestScore = Int.min

        for move in moves {
            if isTimeUp() { break }

            var testState = state
            applyMove(move, to: &testState)

            let score = -minimax(
                state: testState,
                depth: depth - 1,
                alpha: Int.min + 1,
                beta: Int.max,
                maximizingColor: color.opposite,
                aiColor: color
            )

            if score > bestScore {
                bestScore = score
                bestMove = move
            }
        }

        return (bestMove, bestScore)
    }

    private func minimax(
        state: ChessState,
        depth: Int,
        alpha: Int,
        beta: Int,
        maximizingColor: ChessColor,
        aiColor: ChessColor
    ) -> Int {
        nodesSearched += 1

        // Time check every 1000 nodes
        if nodesSearched % 1000 == 0 && isTimeUp() {
            return 0
        }

        if depth == 0 {
            return evaluatePosition(state: state, for: aiColor)
        }

        var currentAlpha = alpha
        var currentBeta = beta
        let isMaximizing = maximizingColor == aiColor

        let moves = generateAllLegalMoves(for: maximizingColor, in: state)

        if moves.isEmpty {
            // Checkmate or stalemate
            if isKingInCheck(state: state, color: maximizingColor) {
                return isMaximizing ? -10000 + (10 - depth) * 100 : 10000 - (10 - depth) * 100
            }
            return 0 // Stalemate
        }

        if isMaximizing {
            var maxScore = Int.min
            for move in moves {
                if isTimeUp() { break }

                var testState = state
                applyMove(move, to: &testState)

                let score = minimax(
                    state: testState,
                    depth: depth - 1,
                    alpha: currentAlpha,
                    beta: currentBeta,
                    maximizingColor: maximizingColor.opposite,
                    aiColor: aiColor
                )

                maxScore = max(maxScore, score)
                currentAlpha = max(currentAlpha, score)
                if currentBeta <= currentAlpha { break } // Beta cutoff
            }
            return maxScore
        } else {
            var minScore = Int.max
            for move in moves {
                if isTimeUp() { break }

                var testState = state
                applyMove(move, to: &testState)

                let score = minimax(
                    state: testState,
                    depth: depth - 1,
                    alpha: currentAlpha,
                    beta: currentBeta,
                    maximizingColor: maximizingColor.opposite,
                    aiColor: aiColor
                )

                minScore = min(minScore, score)
                currentBeta = min(currentBeta, score)
                if currentBeta <= currentAlpha { break } // Alpha cutoff
            }
            return minScore
        }
    }

    // MARK: - Time Management

    private func isTimeUp() -> Bool {
        guard let start = searchStartTime else { return false }
        let elapsed = Date().timeIntervalSince(start) * 1000
        return elapsed >= Double(maxTimeMs)
    }

    // MARK: - Unified Move Generation

    func generateAllLegalMoves(for color: ChessColor, in state: ChessState) -> [ChessMove] {
        var moves: [ChessMove] = []

        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                if let piece = state.board.piece(at: pos), piece.color == color {
                    let pieceMoves = generateMoves(from: pos, piece: piece, state: state)
                    // Filter moves that leave king in check
                    let legalMoves = pieceMoves.filter { move in
                        var testState = state
                        applyMove(move, to: &testState)
                        return !isKingInCheck(state: testState, color: color)
                    }
                    moves.append(contentsOf: legalMoves)
                }
            }
        }

        return moves
    }

    private func generateMoves(from pos: Position, piece: ChessPiece, state: ChessState) -> [ChessMove] {
        switch piece.type {
        case .pawn:
            return pawnMoves(from: pos, color: piece.color, state: state)
        case .knight:
            return knightMoves(from: pos, color: piece.color, state: state)
        case .bishop:
            return slidingMoves(from: pos, color: piece.color, state: state, directions: [(1,1), (1,-1), (-1,1), (-1,-1)])
        case .rook:
            return slidingMoves(from: pos, color: piece.color, state: state, directions: [(0,1), (0,-1), (1,0), (-1,0)])
        case .queen:
            return slidingMoves(from: pos, color: piece.color, state: state, directions: [(0,1), (0,-1), (1,0), (-1,0), (1,1), (1,-1), (-1,1), (-1,-1)])
        case .king:
            return kingMoves(from: pos, color: piece.color, state: state)
        }
    }

    private func pawnMoves(from pos: Position, color: ChessColor, state: ChessState) -> [ChessMove] {
        var moves: [ChessMove] = []
        let direction = color == .white ? 1 : -1
        let startRank = color == .white ? 1 : 6

        // Forward one
        let oneForward = Position(rank: pos.rank + direction, file: pos.file)
        if state.board.isValid(oneForward) && state.board.piece(at: oneForward) == nil {
            moves.append(ChessMove(from: pos, to: oneForward, promotion: nil))

            // Forward two from starting position
            if pos.rank == startRank {
                let twoForward = Position(rank: pos.rank + direction * 2, file: pos.file)
                if state.board.piece(at: twoForward) == nil {
                    moves.append(ChessMove(from: pos, to: twoForward, promotion: nil))
                }
            }
        }

        // Captures
        for fileOffset in [-1, 1] {
            let capturePos = Position(rank: pos.rank + direction, file: pos.file + fileOffset)
            if state.board.isValid(capturePos),
               let target = state.board.piece(at: capturePos),
               target.color != color {
                moves.append(ChessMove(from: pos, to: capturePos, promotion: nil))
            }
        }

        // En passant
        if let epTarget = state.enPassantTarget {
            for fileOffset in [-1, 1] {
                let capturePos = Position(rank: pos.rank + direction, file: pos.file + fileOffset)
                if capturePos == epTarget {
                    moves.append(ChessMove(from: pos, to: capturePos, promotion: nil, isCastling: false, isEnPassant: true))
                }
            }
        }

        return moves
    }

    private func knightMoves(from pos: Position, color: ChessColor, state: ChessState) -> [ChessMove] {
        let offsets = [(2, 1), (2, -1), (-2, 1), (-2, -1), (1, 2), (1, -2), (-1, 2), (-1, -2)]
        return offsets.compactMap { offset in
            let newPos = Position(rank: pos.rank + offset.0, file: pos.file + offset.1)
            guard state.board.isValid(newPos) else { return nil }
            if let piece = state.board.piece(at: newPos), piece.color == color { return nil }
            return ChessMove(from: pos, to: newPos, promotion: nil)
        }
    }

    private func slidingMoves(from pos: Position, color: ChessColor, state: ChessState, directions: [(Int, Int)]) -> [ChessMove] {
        var moves: [ChessMove] = []

        for direction in directions {
            var currentPos = pos
            while true {
                currentPos = Position(rank: currentPos.rank + direction.0, file: currentPos.file + direction.1)
                guard state.board.isValid(currentPos) else { break }

                if let piece = state.board.piece(at: currentPos) {
                    if piece.color != color {
                        moves.append(ChessMove(from: pos, to: currentPos, promotion: nil))
                    }
                    break
                }

                moves.append(ChessMove(from: pos, to: currentPos, promotion: nil))
            }
        }

        return moves
    }

    private func kingMoves(from pos: Position, color: ChessColor, state: ChessState) -> [ChessMove] {
        let offsets = [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)]
        return offsets.compactMap { offset in
            let newPos = Position(rank: pos.rank + offset.0, file: pos.file + offset.1)
            guard state.board.isValid(newPos) else { return nil }
            if let piece = state.board.piece(at: newPos), piece.color == color { return nil }
            return ChessMove(from: pos, to: newPos, promotion: nil)
        }
    }

    // MARK: - State Helpers

    private func applyMove(_ move: ChessMove, to state: inout ChessState) {
        // Update king position cache if king moved
        if let piece = state.board.piece(at: move.from), piece.type == .king {
            if piece.color == .white {
                state.whiteKingPosition = move.to
            } else {
                state.blackKingPosition = move.to
            }
        }

        state.board.makeMove(move)
        state.turn = state.turn.opposite
    }

    func isKingInCheck(state: ChessState, color: ChessColor) -> Bool {
        // Use cached king position for O(1) lookup
        guard let kingPos = state.kingPosition(for: color) else {
            // Fallback to search if cache is invalid
            return isKingInCheckFallback(state: state, color: color)
        }

        // Check if any opponent piece attacks the king
        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                if let piece = state.board.piece(at: pos), piece.color != color {
                    if canPieceAttack(from: pos, to: kingPos, piece: piece, state: state) {
                        return true
                    }
                }
            }
        }

        return false
    }

    private func isKingInCheckFallback(state: ChessState, color: ChessColor) -> Bool {
        // Find king position (O(n) fallback)
        var kingPos: Position?
        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                if let piece = state.board.piece(at: pos),
                   piece.type == .king,
                   piece.color == color {
                    kingPos = pos
                    break
                }
            }
            if kingPos != nil { break }
        }

        guard let king = kingPos else { return false }

        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                if let piece = state.board.piece(at: pos), piece.color != color {
                    if canPieceAttack(from: pos, to: king, piece: piece, state: state) {
                        return true
                    }
                }
            }
        }

        return false
    }

    /// Check if a piece can attack a square (uses pawn diagonal attack rules, not forward movement)
    private func canPieceAttack(from: Position, to: Position, piece: ChessPiece, state: ChessState) -> Bool {
        // Pawns attack diagonally (different from movement)
        if piece.type == .pawn {
            let dr = to.rank - from.rank
            let df = to.file - from.file
            let direction = piece.color == .white ? 1 : -1
            return dr == direction && abs(df) == 1
        }

        // All other pieces: use shared canPieceReach (attack pattern = movement pattern)
        return canPieceReach(from: from, to: to, piece: piece, state: state)
    }

    // Note: isPathClear() is now a shared function in ChessEngine.swift

    // MARK: - Position Evaluation

    private func evaluatePosition(state: ChessState, for color: ChessColor) -> Int {
        var score = 0

        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                if let piece = state.board.piece(at: pos) {
                    let value = pieceValues[piece.type] ?? 0
                    let positionBonus = positionalBonus(piece: piece, position: pos)

                    if piece.color == color {
                        score += value + positionBonus
                    } else {
                        score -= value + positionBonus
                    }
                }
            }
        }

        return score
    }

    private func positionalBonus(piece: ChessPiece, position: Position) -> Int {
        // Center control bonus
        let centerBonus = (3 - abs(position.file - 3)) + (3 - abs(position.rank - 3))

        switch piece.type {
        case .pawn:
            let advanceBonus = piece.color == .white ? position.rank : (7 - position.rank)
            return advanceBonus * 10 + centerBonus * 5
        case .knight:
            return centerBonus * 15
        case .bishop:
            return centerBonus * 10
        case .king:
            let backRank = piece.color == .white ? 0 : 7
            return abs(position.rank - backRank) < 2 ? 30 : -20
        default:
            return centerBonus * 5
        }
    }
}
