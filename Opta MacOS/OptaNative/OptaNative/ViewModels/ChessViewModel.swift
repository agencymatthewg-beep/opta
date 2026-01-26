//
//  ChessViewModel.swift
//  OptaNative
//
//  ViewModel for the Opta Chess Arena.
//  Manages game state, move validation, AI opponent, and history.
//
//  Design Goals:
//  - Instant Play: Game is ready immediately
//  - 3-Click Moves: Select piece → Select destination
//  - Full Move History with Undo support
//  - Adaptable AI Opponent (default)
//
//  Created for Opta Native macOS - Redesign v2.0
//

import SwiftUI

// MARK: - AI Mode

enum AIMode: String, CaseIterable {
    case standard = "Standard"
    case opta = "OptaAI"

    var description: String {
        switch self {
        case .standard: return "Traditional chess AI"
        case .opta: return "Plays like you"
        }
    }
}

// MARK: - AI Difficulty

enum AIDifficulty: String, CaseIterable {
    case beginner = "Beginner"
    case intermediate = "Intermediate"
    case advanced = "Advanced"
    case adaptive = "Adaptive"

    var searchDepth: Int {
        switch self {
        case .beginner: return 1
        case .intermediate: return 2
        case .advanced: return 3
        case .adaptive: return 2 // Adjusts based on performance
        }
    }
}

// MARK: - Game End State

enum GameEndState: Equatable {
    case ongoing
    case checkmate(winner: ChessColor)
    case stalemate
    case draw(reason: String)
}

// MARK: - Move Record (for proper undo)

struct MoveRecord: Sendable {
    let move: ChessMove
    let capturedPiece: ChessPiece?
    let previousCastlingRights: String
    let previousEnPassant: Position?
}

@Observable
@MainActor
class ChessViewModel {

    // MARK: - Game State

    var state: ChessState
    var selectedSquare: Position?
    var legalMoves: [ChessMove] = []  // Full move objects for special moves
    var legalDestinations: [Position] = []
    var lastMove: ChessMove?
    var gameEndState: GameEndState = .ongoing

    // MARK: - Pawn Promotion

    var pendingPromotion: (from: Position, to: Position)?
    var showPromotionDialog: Bool = false

    // MARK: - AI Settings

    var aiEnabled: Bool = true
    var aiColor: ChessColor = .black
    var aiDifficulty: AIDifficulty = .adaptive
    var aiMode: AIMode = .standard
    var isAIThinking: Bool = false
    var optaAILoaded: Bool = false

    // AI Actors (background computation)
    private let chessAI = ChessAI(maxTimeMs: 2000)
    private let optaAI = OptaAIEngine(username: "Serppy")

    // Adaptive AI tracking
    private var playerWins: Int = 0
    private var playerLosses: Int = 0
    private var currentAdaptiveDepth: Int = 2

    // MARK: - History & Tracking

    var moveHistory: [String] = []
    var moveRecords: [MoveRecord] = []  // Proper undo tracking with captured pieces
    var stateHistory: [ChessState] = []
    var capturedByWhite: [ChessPiece] = []  // Pieces white has captured (black pieces)
    var capturedByBlack: [ChessPiece] = []  // Pieces black has captured (white pieces)

    // MARK: - Computed Properties

    var isWhiteTurn: Bool { state.turn == .white }
    var isPlayerTurn: Bool { !aiEnabled || state.turn != aiColor }
    var isGameOver: Bool { gameEndState != .ongoing }

    var gameStatus: String {
        switch gameEndState {
        case .checkmate(let winner):
            let winnerName = winner == aiColor ? "Opta" : "You"
            return aiEnabled ? "\(winnerName) won by checkmate!" : "\(winner == .white ? "White" : "Black") wins!"
        case .stalemate:
            return "Stalemate - Draw!"
        case .draw(let reason):
            return "Draw: \(reason)"
        case .ongoing:
            break
        }

        if isAIThinking {
            return "Opta is thinking..."
        }
        if isInCheck(state.turn) {
            return "\(state.turn == .white ? "White" : "Black") in Check!"
        }
        if !aiEnabled {
            return "\(state.turn == .white ? "White" : "Black") to move"
        }
        return state.turn == aiColor ? "Opta's turn" : "Your move"
    }

    var opponentLabel: String {
        guard aiEnabled else { return "Black" }
        switch aiMode {
        case .standard:
            return "Opta AI (\(aiDifficulty.rawValue))"
        case .opta:
            return "OptaAI (Your Style)"
        }
    }

    // MARK: - Initialization

    init() {
        self.state = ChessState()
        // Load OptaAI opening book on init
        Task {
            await loadOptaAI()
        }
    }

    // MARK: - OptaAI Loading

    private func loadOptaAI() async {
        // Load PGN file from bundle
        if let pgnURL = Bundle.main.url(forResource: "user_games", withExtension: "pgn"),
           let pgnContent = try? String(contentsOf: pgnURL) {
            await optaAI.loadOpeningBook(from: pgnContent)
            await MainActor.run {
                optaAILoaded = true
                print("OptaAI: Opening book loaded successfully")
            }
        } else {
            // Try loading from documents directory as fallback
            let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            if let pgnPath = documentsPath?.appendingPathComponent("user_games.pgn"),
               let pgnContent = try? String(contentsOf: pgnPath) {
                await optaAI.loadOpeningBook(from: pgnContent)
                await MainActor.run {
                    optaAILoaded = true
                    print("OptaAI: Opening book loaded from documents")
                }
            } else {
                print("OptaAI: No PGN file found")
            }
        }
    }

    /// Reload OptaAI (for refresh shortcut)
    func reloadOptaAI() async {
        optaAILoaded = false
        await loadOptaAI()
    }

    /// Reload OptaAI with new PGN content
    func reloadOptaAI(with pgnContent: String) async {
        await optaAI.loadOpeningBook(from: pgnContent)
        optaAILoaded = true
    }

    // MARK: - User Interaction

    func selectSquare(_ pos: Position) {
        guard !isGameOver else { return }

        // If selecting same square, deselect
        if selectedSquare == pos {
            deselect()
            return
        }

        // If there's a piece of the current player's color, select it
        if let piece = state.board.piece(at: pos), piece.color == state.turn {
            selectedSquare = pos
            legalMoves = calculateLegalMoves(from: pos)
            legalDestinations = legalMoves.map { $0.to }
            return
        }

        // If we have a selection and clicked a legal destination, make the move
        if let from = selectedSquare, legalDestinations.contains(pos) {
            // Find the matching move (important for special moves)
            if let move = legalMoves.first(where: { $0.to == pos }) {
                // Check for pawn promotion
                if let piece = state.board.piece(at: from),
                   piece.type == .pawn,
                   (pos.rank == 0 || pos.rank == 7) {
                    pendingPromotion = (from: from, to: pos)
                    showPromotionDialog = true
                    return
                }
                executeMove(move)
            }
            return
        }

        // Otherwise deselect
        deselect()
    }

    func completePromotion(to pieceType: ChessPieceType) {
        guard let promotion = pendingPromotion else { return }
        let move = ChessMove(from: promotion.from, to: promotion.to, promotion: pieceType)
        executeMove(move)
        pendingPromotion = nil
        showPromotionDialog = false
    }

    func cancelPromotion() {
        pendingPromotion = nil
        showPromotionDialog = false
        deselect()
    }

    private func executeMove(_ move: ChessMove) {
        // Save state for undo
        stateHistory.append(state)

        // Check for capture (including en passant)
        var capturedPiece: ChessPiece? = state.board.piece(at: move.to)
        if move.isEnPassant {
            let capturedPawnPos = Position(rank: move.from.rank, file: move.to.file)
            capturedPiece = state.board.piece(at: capturedPawnPos)
        }

        // Record move for proper undo (BEFORE modifying state)
        let record = MoveRecord(
            move: move,
            capturedPiece: capturedPiece,
            previousCastlingRights: state.castlingRights,
            previousEnPassant: state.enPassantTarget
        )
        moveRecords.append(record)

        if let captured = capturedPiece {
            if state.turn == .white {
                capturedByWhite.append(captured)
            } else {
                capturedByBlack.append(captured)
            }
        }

        // Record move notation
        let notation = generateMoveNotation(move: move)
        moveHistory.append(notation)

        // Update en passant target
        if let piece = state.board.piece(at: move.from),
           piece.type == .pawn,
           abs(move.to.rank - move.from.rank) == 2 {
            // Pawn moved two squares - set en passant target
            state.enPassantTarget = Position(
                rank: (move.from.rank + move.to.rank) / 2,
                file: move.from.file
            )
        } else {
            state.enPassantTarget = nil
        }

        // Update castling rights
        updateCastlingRights(move: move)

        // Update king position cache if king moved
        if let piece = state.board.piece(at: move.from), piece.type == .king {
            if piece.color == .white {
                state.whiteKingPosition = move.to
            } else {
                state.blackKingPosition = move.to
            }
        }

        // Execute the move
        state.board.makeMove(move)
        state.turn = state.turn.opposite

        // Track last move for highlighting
        lastMove = move

        deselect()

        // Check for game end
        checkGameEnd()

        // Trigger AI move if enabled and it's AI's turn and game not over
        if !isGameOver && aiEnabled && state.turn == aiColor {
            triggerAIMove()
        }
    }

    private func updateCastlingRights(move: ChessMove) {
        guard let piece = state.board.piece(at: move.from) else { return }

        var rights = state.castlingRights

        // King moved - remove all castling rights for that color
        if piece.type == .king {
            if piece.color == .white {
                rights = rights.replacingOccurrences(of: "K", with: "")
                rights = rights.replacingOccurrences(of: "Q", with: "")
            } else {
                rights = rights.replacingOccurrences(of: "k", with: "")
                rights = rights.replacingOccurrences(of: "q", with: "")
            }
        }

        // Rook moved or captured - remove specific castling right
        if piece.type == .rook {
            if move.from == Position(rank: 0, file: 0) { rights = rights.replacingOccurrences(of: "Q", with: "") }
            if move.from == Position(rank: 0, file: 7) { rights = rights.replacingOccurrences(of: "K", with: "") }
            if move.from == Position(rank: 7, file: 0) { rights = rights.replacingOccurrences(of: "q", with: "") }
            if move.from == Position(rank: 7, file: 7) { rights = rights.replacingOccurrences(of: "k", with: "") }
        }

        // Rook captured
        if move.to == Position(rank: 0, file: 0) { rights = rights.replacingOccurrences(of: "Q", with: "") }
        if move.to == Position(rank: 0, file: 7) { rights = rights.replacingOccurrences(of: "K", with: "") }
        if move.to == Position(rank: 7, file: 0) { rights = rights.replacingOccurrences(of: "q", with: "") }
        if move.to == Position(rank: 7, file: 7) { rights = rights.replacingOccurrences(of: "k", with: "") }

        state.castlingRights = rights.isEmpty ? "-" : rights
    }

    private func checkGameEnd() {
        let currentColor = state.turn
        let allMoves = getAllLegalMoves(for: currentColor)

        if allMoves.isEmpty {
            if isInCheck(currentColor) {
                gameEndState = .checkmate(winner: currentColor.opposite)
            } else {
                gameEndState = .stalemate
            }
        }

        // Check for insufficient material
        if isInsufficientMaterial() {
            gameEndState = .draw(reason: "Insufficient material")
        }
    }

    private func isInsufficientMaterial() -> Bool {
        var whitePieces: [ChessPieceType] = []
        var blackPieces: [ChessPieceType] = []

        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                if let piece = state.board.piece(at: pos) {
                    if piece.color == .white {
                        whitePieces.append(piece.type)
                    } else {
                        blackPieces.append(piece.type)
                    }
                }
            }
        }

        // King vs King
        if whitePieces == [.king] && blackPieces == [.king] { return true }

        // King vs King + Bishop
        if whitePieces == [.king] && blackPieces.sorted(by: { $0.rawValue < $1.rawValue }) == [.bishop, .king].sorted(by: { $0.rawValue < $1.rawValue }) { return true }
        if blackPieces == [.king] && whitePieces.sorted(by: { $0.rawValue < $1.rawValue }) == [.bishop, .king].sorted(by: { $0.rawValue < $1.rawValue }) { return true }

        // King vs King + Knight
        if whitePieces == [.king] && blackPieces.sorted(by: { $0.rawValue < $1.rawValue }) == [.king, .knight].sorted(by: { $0.rawValue < $1.rawValue }) { return true }
        if blackPieces == [.king] && whitePieces.sorted(by: { $0.rawValue < $1.rawValue }) == [.king, .knight].sorted(by: { $0.rawValue < $1.rawValue }) { return true }

        return false
    }

    // MARK: - AI System

    private func triggerAIMove() {
        isAIThinking = true

        // Run AI computation on background actor
        Task {
            // Small delay to show thinking state and make it feel natural
            try? await Task.sleep(nanoseconds: 300_000_000) // 0.3 seconds

            // Use OptaAI or Standard AI based on mode
            if aiMode == .opta && optaAILoaded {
                await triggerOptaAIMove()
            } else {
                await triggerStandardAIMove()
            }
        }
    }

    private func triggerOptaAIMove() async {
        // OptaAI - plays like the user based on their game history
        if let aiMove = await optaAI.getBestMove(state: state, playingAs: aiColor) {
            await MainActor.run {
                executeMove(aiMove)
                isAIThinking = false
            }
        } else {
            // Fallback to standard AI if OptaAI can't find a move
            await triggerStandardAIMove()
        }
    }

    private func triggerStandardAIMove() async {
        let depth = aiDifficulty == .adaptive ? currentAdaptiveDepth : aiDifficulty.searchDepth

        // For beginner, add randomness
        if aiDifficulty == .beginner || (aiDifficulty == .adaptive && currentAdaptiveDepth == 1) {
            if Double.random(in: 0...1) < 0.4 {
                let allMoves = await chessAI.generateAllLegalMoves(for: aiColor, in: state)
                if let randomMove = allMoves.randomElement() {
                    await MainActor.run {
                        executeMove(randomMove)
                        isAIThinking = false
                    }
                    return
                }
            }
        }

        // Use iterative deepening with time cutoff
        if let aiMove = await chessAI.calculateBestMove(
            state: state,
            color: aiColor,
            targetDepth: depth
        ) {
            await MainActor.run {
                executeMove(aiMove)
                isAIThinking = false
            }
        } else {
            await MainActor.run {
                isAIThinking = false
            }
        }
    }

    // Note: Minimax and evaluation logic moved to ChessAI actor for background computation

    // MARK: - Adaptive AI

    func recordPlayerWin() {
        playerWins += 1
        adjustAdaptiveDifficulty()
    }

    func recordPlayerLoss() {
        playerLosses += 1
        adjustAdaptiveDifficulty()
    }

    private func adjustAdaptiveDifficulty() {
        guard aiDifficulty == .adaptive else { return }

        let winRate = Double(playerWins) / Double(max(1, playerWins + playerLosses))

        if winRate > 0.6 && playerWins >= 2 {
            // Player winning too much, increase difficulty
            currentAdaptiveDepth = min(4, currentAdaptiveDepth + 1)
            playerWins = 0
            playerLosses = 0
        } else if winRate < 0.4 && playerLosses >= 2 {
            // Player struggling, decrease difficulty
            currentAdaptiveDepth = max(1, currentAdaptiveDepth - 1)
            playerWins = 0
            playerLosses = 0
        }
    }

    private func deselect() {
        selectedSquare = nil
        legalDestinations = []
    }

    // MARK: - Game Control

    func resetGame() {
        state = ChessState()
        selectedSquare = nil
        legalMoves = []
        legalDestinations = []
        lastMove = nil
        gameEndState = .ongoing
        pendingPromotion = nil
        showPromotionDialog = false
        moveHistory = []
        moveRecords = []
        stateHistory = []
        capturedByWhite = []
        capturedByBlack = []
        // Note: Adaptive AI state preserved across resets intentionally
    }

    func undoMove() {
        // Undo twice if AI made a move (undo player move + AI move)
        let undoCount = aiEnabled && state.turn == aiColor.opposite ? 2 : 1

        for _ in 0..<undoCount {
            guard let previousState = stateHistory.popLast(),
                  let moveRecord = moveRecords.popLast() else { break }

            state = previousState

            // Remove last move from history
            if !moveHistory.isEmpty {
                moveHistory.removeLast()
            }

            // Remove captured piece using the move record (guaranteed correct piece)
            if moveRecord.capturedPiece != nil {
                // The move record tells us which color made the move that captured
                // previousState.turn is the color that just moved (before we restored)
                if previousState.turn == .white, !capturedByWhite.isEmpty {
                    capturedByWhite.removeLast()
                } else if previousState.turn == .black, !capturedByBlack.isEmpty {
                    capturedByBlack.removeLast()
                }
            }
        }

        // Reset game end state
        gameEndState = .ongoing
        lastMove = nil
        deselect()
    }

    // MARK: - PGN Import/Export

    /// Import game from PGN file
    func importPGN() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.init(filenameExtension: "pgn")!]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.message = "Select a PGN file to import"

        if panel.runModal() == .OK, let url = panel.url {
            Task {
                await importFromURL(url)
            }
        }
    }

    private func importFromURL(_ url: URL) async {
        do {
            let game = try await PGNService.shared.importFromFile(url)

            await MainActor.run {
                // Reset game
                resetGame()

                // Set up from FEN if provided
                if let fen = game.fenStart {
                    state = ChessState(fen: fen)
                }

                // Apply moves one by one
                // For now, just load the move history notation
                moveHistory = game.moves

                print("Imported game: \(game.metadata.white) vs \(game.metadata.black)")
            }
        } catch {
            print("Failed to import PGN: \(error)")
        }
    }

    /// Export current game to PGN file
    func exportPGN() {
        guard !moveHistory.isEmpty else { return }

        let panel = NSSavePanel()
        panel.allowedContentTypes = [.init(filenameExtension: "pgn")!]
        panel.nameFieldStringValue = "opta_game.pgn"
        panel.message = "Save game as PGN"

        if panel.runModal() == .OK, let url = panel.url {
            Task {
                await exportToURL(url)
            }
        }
    }

    private func exportToURL(_ url: URL) async {
        // Create metadata
        var metadata = PGNMetadata()
        metadata.white = aiEnabled ? "Player" : "White"
        metadata.black = aiEnabled ? opponentLabel : "Black"

        // Set result based on game state
        switch gameEndState {
        case .checkmate(let winner):
            metadata.result = winner == .white ? "1-0" : "0-1"
        case .stalemate, .draw:
            metadata.result = "1/2-1/2"
        case .ongoing:
            metadata.result = "*"
        }

        let pgn = await PGNService.shared.exportToPGN(moves: moveHistory, metadata: metadata)

        do {
            try await PGNService.shared.saveToFile(pgn, at: url)
            print("Exported game to: \(url.path)")
        } catch {
            print("Failed to export PGN: \(error)")
        }
    }

    // MARK: - Move Generation (Full Chess Rules)

    private func calculateLegalMoves(from pos: Position) -> [ChessMove] {
        guard let piece = state.board.piece(at: pos) else { return [] }

        var pseudoMoves: [ChessMove] = []

        switch piece.type {
        case .pawn:
            pseudoMoves = pawnMoves(from: pos, color: piece.color)
        case .knight:
            pseudoMoves = knightMoves(from: pos, color: piece.color)
        case .bishop:
            pseudoMoves = slidingMoves(from: pos, color: piece.color, directions: [(1,1), (1,-1), (-1,1), (-1,-1)])
        case .rook:
            pseudoMoves = slidingMoves(from: pos, color: piece.color, directions: [(0,1), (0,-1), (1,0), (-1,0)])
        case .queen:
            pseudoMoves = slidingMoves(from: pos, color: piece.color, directions: [(0,1), (0,-1), (1,0), (-1,0), (1,1), (1,-1), (-1,1), (-1,-1)])
        case .king:
            pseudoMoves = kingMoves(from: pos, color: piece.color)
            pseudoMoves += castlingMoves(from: pos, color: piece.color)
        }

        // Filter out moves that leave king in check
        return pseudoMoves.filter { move in
            !moveLeavesKingInCheck(move, color: piece.color)
        }
    }

    private func moveLeavesKingInCheck(_ move: ChessMove, color: ChessColor) -> Bool {
        // Make a copy and test the move
        var testState = state
        testState.board.makeMove(move)
        return isInCheckState(testState, color: color)
    }

    private func pawnMoves(from pos: Position, color: ChessColor) -> [ChessMove] {
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

    private func knightMoves(from pos: Position, color: ChessColor) -> [ChessMove] {
        let offsets = [
            (2, 1), (2, -1), (-2, 1), (-2, -1),
            (1, 2), (1, -2), (-1, 2), (-1, -2)
        ]

        return offsets.compactMap { offset in
            let newPos = Position(rank: pos.rank + offset.0, file: pos.file + offset.1)
            guard state.board.isValid(newPos) else { return nil }
            if let piece = state.board.piece(at: newPos), piece.color == color {
                return nil
            }
            return ChessMove(from: pos, to: newPos, promotion: nil)
        }
    }

    private func slidingMoves(from pos: Position, color: ChessColor, directions: [(Int, Int)]) -> [ChessMove] {
        var moves: [ChessMove] = []

        for direction in directions {
            var currentPos = pos
            while true {
                currentPos = Position(rank: currentPos.rank + direction.0, file: currentPos.file + direction.1)

                guard state.board.isValid(currentPos) else { break }

                if let piece = state.board.piece(at: currentPos) {
                    if piece.color != color {
                        moves.append(ChessMove(from: pos, to: currentPos, promotion: nil)) // Capture
                    }
                    break // Blocked
                }

                moves.append(ChessMove(from: pos, to: currentPos, promotion: nil))
            }
        }

        return moves
    }

    private func kingMoves(from pos: Position, color: ChessColor) -> [ChessMove] {
        let offsets = [
            (0, 1), (0, -1), (1, 0), (-1, 0),
            (1, 1), (1, -1), (-1, 1), (-1, -1)
        ]

        return offsets.compactMap { offset in
            let newPos = Position(rank: pos.rank + offset.0, file: pos.file + offset.1)
            guard state.board.isValid(newPos) else { return nil }
            if let piece = state.board.piece(at: newPos), piece.color == color {
                return nil
            }
            return ChessMove(from: pos, to: newPos, promotion: nil)
        }
    }

    private func castlingMoves(from pos: Position, color: ChessColor) -> [ChessMove] {
        var moves: [ChessMove] = []
        let rank = color == .white ? 0 : 7

        // Can't castle if in check
        if isInCheck(color) { return [] }

        // Kingside castling
        let kingsideRight = color == .white ? "K" : "k"
        if state.castlingRights.contains(kingsideRight) {
            // Check squares between king and rook are empty
            let f1 = Position(rank: rank, file: 5)
            let g1 = Position(rank: rank, file: 6)

            if state.board.piece(at: f1) == nil && state.board.piece(at: g1) == nil {
                // Check king doesn't pass through check
                if !isSquareAttacked(f1, by: color.opposite) && !isSquareAttacked(g1, by: color.opposite) {
                    moves.append(ChessMove(from: pos, to: g1, promotion: nil, isCastling: true, isEnPassant: false))
                }
            }
        }

        // Queenside castling
        let queensideRight = color == .white ? "Q" : "q"
        if state.castlingRights.contains(queensideRight) {
            let b1 = Position(rank: rank, file: 1)
            let c1 = Position(rank: rank, file: 2)
            let d1 = Position(rank: rank, file: 3)

            if state.board.piece(at: b1) == nil && state.board.piece(at: c1) == nil && state.board.piece(at: d1) == nil {
                if !isSquareAttacked(c1, by: color.opposite) && !isSquareAttacked(d1, by: color.opposite) {
                    moves.append(ChessMove(from: pos, to: c1, promotion: nil, isCastling: true, isEnPassant: false))
                }
            }
        }

        return moves
    }

    private func isSquareAttacked(_ pos: Position, by color: ChessColor) -> Bool {
        // Check if any piece of 'color' attacks this square
        for rank in 0..<8 {
            for file in 0..<8 {
                let attackerPos = Position(rank: rank, file: file)
                if let piece = state.board.piece(at: attackerPos), piece.color == color {
                    if canPieceAttack(from: attackerPos, to: pos, piece: piece) {
                        return true
                    }
                }
            }
        }
        return false
    }

    private func canPieceAttack(from: Position, to: Position, piece: ChessPiece) -> Bool {
        let dr = to.rank - from.rank
        let df = to.file - from.file

        switch piece.type {
        case .pawn:
            let direction = piece.color == .white ? 1 : -1
            return dr == direction && abs(df) == 1

        case .knight:
            return (abs(dr) == 2 && abs(df) == 1) || (abs(dr) == 1 && abs(df) == 2)

        case .bishop:
            if abs(dr) != abs(df) || dr == 0 { return false }
            return isPathClear(from: from, to: to)

        case .rook:
            if dr != 0 && df != 0 { return false }
            return isPathClear(from: from, to: to)

        case .queen:
            if dr != 0 && df != 0 && abs(dr) != abs(df) { return false }
            return isPathClear(from: from, to: to)

        case .king:
            return abs(dr) <= 1 && abs(df) <= 1
        }
    }

    private func isPathClear(from: Position, to: Position) -> Bool {
        let dr = to.rank - from.rank
        let df = to.file - from.file
        let steps = max(abs(dr), abs(df))
        let stepR = dr == 0 ? 0 : dr / abs(dr)
        let stepF = df == 0 ? 0 : df / abs(df)

        for i in 1..<steps {
            let checkPos = Position(rank: from.rank + stepR * i, file: from.file + stepF * i)
            if state.board.piece(at: checkPos) != nil {
                return false
            }
        }
        return true
    }

    // MARK: - Check Detection (Using Cached King Position)

    private func isInCheck(_ color: ChessColor) -> Bool {
        // Use cached king position for O(1) lookup
        guard let king = state.kingPosition(for: color) else {
            // Fallback to search if cache is invalid
            return isInCheckFallback(color)
        }

        // Check if any opponent piece attacks the king
        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                if let piece = state.board.piece(at: pos), piece.color != color {
                    let attacks = calculateAttacks(from: pos, piece: piece)
                    if attacks.contains(king) {
                        return true
                    }
                }
            }
        }

        return false
    }

    private func isInCheckFallback(_ color: ChessColor) -> Bool {
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
                    let attacks = calculateAttacks(from: pos, piece: piece)
                    if attacks.contains(king) {
                        return true
                    }
                }
            }
        }

        return false
    }

    /// Get all legal moves for a color (synchronous for UI)
    private func getAllLegalMoves(for color: ChessColor) -> [ChessMove] {
        var moves: [ChessMove] = []

        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                if let piece = state.board.piece(at: pos), piece.color == color {
                    let pieceMoves = calculateLegalMoves(from: pos)
                    moves.append(contentsOf: pieceMoves)
                }
            }
        }

        return moves
    }

    /// Check if king is in check in a given state (for move testing)
    private func isInCheckState(_ testState: ChessState, color: ChessColor) -> Bool {
        // Use cached king position if available
        guard let king = testState.kingPosition(for: color) else {
            // Fallback to search
            var kingPos: Position?
            for rank in 0..<8 {
                for file in 0..<8 {
                    let pos = Position(rank: rank, file: file)
                    if let piece = testState.board.piece(at: pos),
                       piece.type == .king,
                       piece.color == color {
                        kingPos = pos
                        break
                    }
                }
                if kingPos != nil { break }
            }
            guard let foundKing = kingPos else { return false }
            return isPositionAttackedInState(foundKing, by: color.opposite, in: testState)
        }

        return isPositionAttackedInState(king, by: color.opposite, in: testState)
    }

    /// Check if a position is attacked by a color in a given state
    private func isPositionAttackedInState(_ pos: Position, by attackerColor: ChessColor, in testState: ChessState) -> Bool {
        for rank in 0..<8 {
            for file in 0..<8 {
                let attackerPos = Position(rank: rank, file: file)
                if let piece = testState.board.piece(at: attackerPos), piece.color == attackerColor {
                    if canPieceAttackInState(from: attackerPos, to: pos, piece: piece, in: testState) {
                        return true
                    }
                }
            }
        }
        return false
    }

    /// Check if a piece can attack a position in a given state
    private func canPieceAttackInState(from: Position, to: Position, piece: ChessPiece, in testState: ChessState) -> Bool {
        let dr = to.rank - from.rank
        let df = to.file - from.file

        switch piece.type {
        case .pawn:
            let direction = piece.color == .white ? 1 : -1
            return dr == direction && abs(df) == 1

        case .knight:
            return (abs(dr) == 2 && abs(df) == 1) || (abs(dr) == 1 && abs(df) == 2)

        case .bishop:
            if abs(dr) != abs(df) || dr == 0 { return false }
            return isPathClearInState(from: from, to: to, in: testState)

        case .rook:
            if dr != 0 && df != 0 { return false }
            return isPathClearInState(from: from, to: to, in: testState)

        case .queen:
            if dr != 0 && df != 0 && abs(dr) != abs(df) { return false }
            return isPathClearInState(from: from, to: to, in: testState)

        case .king:
            return abs(dr) <= 1 && abs(df) <= 1
        }
    }

    /// Check if path is clear in a given state
    private func isPathClearInState(from: Position, to: Position, in testState: ChessState) -> Bool {
        let dr = to.rank - from.rank
        let df = to.file - from.file
        let steps = max(abs(dr), abs(df))
        let stepR = dr == 0 ? 0 : dr / abs(dr)
        let stepF = df == 0 ? 0 : df / abs(df)

        for i in 1..<steps {
            let checkPos = Position(rank: from.rank + stepR * i, file: from.file + stepF * i)
            if testState.board.piece(at: checkPos) != nil {
                return false
            }
        }
        return true
    }

    private func calculateAttacks(from pos: Position, piece: ChessPiece) -> [Position] {
        // Simplified attack calculation (same as moves but for pawns, diagonal attacks only)
        switch piece.type {
        case .pawn:
            let direction = piece.color == .white ? 1 : -1
            return [
                Position(rank: pos.rank + direction, file: pos.file - 1),
                Position(rank: pos.rank + direction, file: pos.file + 1)
            ].filter { state.board.isValid($0) }
        default:
            return calculateLegalMovesForAttack(from: pos, piece: piece)
        }
    }

    private func calculateLegalMovesForAttack(from pos: Position, piece: ChessPiece) -> [Position] {
        switch piece.type {
        case .knight:
            return knightMoves(from: pos, color: piece.color.opposite).map { $0.to }
        case .bishop:
            return slidingMoves(from: pos, color: piece.color.opposite, directions: [(1,1), (1,-1), (-1,1), (-1,-1)]).map { $0.to }
        case .rook:
            return slidingMoves(from: pos, color: piece.color.opposite, directions: [(0,1), (0,-1), (1,0), (-1,0)]).map { $0.to }
        case .queen:
            return slidingMoves(from: pos, color: piece.color.opposite, directions: [(0,1), (0,-1), (1,0), (-1,0), (1,1), (1,-1), (-1,1), (-1,-1)]).map { $0.to }
        case .king:
            return kingMoves(from: pos, color: piece.color.opposite).map { $0.to }
        default:
            return []
        }
    }

    // MARK: - Move Notation

    private func generateMoveNotation(move: ChessMove) -> String {
        guard let piece = state.board.piece(at: move.from) else { return "?" }

        // Castling notation
        if move.isCastling {
            return move.to.file == 6 ? "O-O" : "O-O-O"
        }

        var notation = ""

        // Piece letter (pawns have no letter)
        if piece.type != .pawn {
            notation += pieceNotation(piece.type)
        }

        // Capture indicator
        let isCapture = state.board.piece(at: move.to) != nil || move.isEnPassant
        if isCapture {
            if piece.type == .pawn {
                notation += String(move.from.notation.prefix(1)) // File for pawn captures
            }
            notation += "x"
        }

        // Destination
        notation += move.to.notation

        // Promotion
        if let promo = move.promotion {
            notation += "=\(pieceNotation(promo))"
        }

        // En passant indicator
        if move.isEnPassant {
            notation += " e.p."
        }

        // Check/checkmate indicator (after move is made)
        // We'll add this after the move is executed

        return notation
    }

    private func pieceNotation(_ type: ChessPieceType) -> String {
        switch type {
        case .king: return "K"
        case .queen: return "Q"
        case .rook: return "R"
        case .bishop: return "B"
        case .knight: return "N"
        case .pawn: return ""
        }
    }
}
