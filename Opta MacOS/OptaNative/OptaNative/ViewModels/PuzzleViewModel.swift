//
//  PuzzleViewModel.swift
//  OptaNative
//
//  ViewModel for chess puzzle mode.
//  Manages puzzle state, move validation, and progress tracking.
//  Created for Opta Native macOS - Phase 100
//

import SwiftUI

// MARK: - Puzzle State

enum PuzzleState: Equatable {
    case loading
    case ready
    case showingOpponentMove
    case waitingForPlayerMove
    case evaluatingMove
    case correct
    case incorrect
    case solved
    case failed
}

@Observable
@MainActor
class PuzzleViewModel {

    // MARK: - Puzzle State

    var currentPuzzle: ChessPuzzle?
    var puzzleState: PuzzleState = .loading
    var boardState: ChessState = ChessState()

    // MARK: - Move Tracking

    var currentMoveIndex: Int = 0  // Index in puzzle.moves array
    var expectedMove: String?  // The move we're waiting for (UCI)
    var playerColor: ChessColor = .white

    // MARK: - Selection State

    var selectedSquare: Position?
    var legalDestinations: [Position] = []
    var lastMove: ChessMove?

    // MARK: - Stats

    var streak: Int = 0
    var userRating: Int = 1500
    var puzzleStartTime: Date?
    var hintsUsed: Int = 0
    var movesPlayed: Int = 0

    // MARK: - UI State

    var showHint: Bool = false
    var hintText: String = ""
    var feedbackText: String = ""
    var showFeedback: Bool = false

    // MARK: - Filters

    var selectedThemes: Set<String> = []
    var ratingRange: ClosedRange<Int> = 1000...2000

    // MARK: - Service

    private let puzzleService = PuzzleService.shared

    // MARK: - Initialization

    init() {
        Task {
            await loadInitialData()
        }
    }

    private func loadInitialData() async {
        do {
            try await puzzleService.loadPuzzles()
            await puzzleService.loadSavedProgress()
            let stats = await puzzleService.getStats()
            userRating = stats.rating
            streak = stats.currentStreak
            await loadNextPuzzle()
        } catch {
            print("Failed to load puzzles: \(error)")
        }
    }

    // MARK: - Puzzle Loading

    func loadNextPuzzle() async {
        puzzleState = .loading
        selectedSquare = nil
        legalDestinations = []
        lastMove = nil
        currentMoveIndex = 0
        hintsUsed = 0
        movesPlayed = 0
        showHint = false
        showFeedback = false

        // Get next puzzle
        if let puzzle = await puzzleService.getNextPuzzle() {
            currentPuzzle = puzzle
            setupPuzzle(puzzle)
        }
    }

    func loadPuzzle(_ puzzle: ChessPuzzle) async {
        puzzleState = .loading
        currentPuzzle = puzzle
        selectedSquare = nil
        legalDestinations = []
        lastMove = nil
        currentMoveIndex = 0
        hintsUsed = 0
        movesPlayed = 0
        showHint = false
        showFeedback = false

        setupPuzzle(puzzle)
    }

    private func setupPuzzle(_ puzzle: ChessPuzzle) {
        // Parse FEN to set up board
        boardState = ChessState(fen: puzzle.fen)

        // Determine player color - in Lichess puzzles, the first move is the opponent's
        // So the player plays as the color to move AFTER the first move
        playerColor = boardState.turn.opposite

        // Show opponent's first move
        puzzleState = .showingOpponentMove

        // After a delay, play the opponent's first move
        Task {
            try? await Task.sleep(nanoseconds: 800_000_000)  // 0.8 seconds

            // Play opponent's first move
            if let firstMoveUCI = puzzle.moves.first,
               let firstMove = await puzzleService.uciToMove(firstMoveUCI, in: boardState) {
                await MainActor.run {
                    executeMove(firstMove, animated: true)
                    currentMoveIndex = 1

                    // Set expected move (player's response)
                    if puzzle.moves.count > 1 {
                        expectedMove = puzzle.moves[1]
                    }

                    puzzleState = .waitingForPlayerMove
                    puzzleStartTime = Date()
                }
            }
        }
    }

    // MARK: - User Interaction

    func selectSquare(_ pos: Position) {
        guard puzzleState == .waitingForPlayerMove else { return }

        // If selecting same square, deselect
        if selectedSquare == pos {
            deselect()
            return
        }

        // If selecting piece of player's color, select it
        if let piece = boardState.board.piece(at: pos), piece.color == boardState.turn {
            selectedSquare = pos
            legalDestinations = calculateLegalDestinations(from: pos)
            return
        }

        // If we have a selection and clicked a legal destination, make the move
        if let from = selectedSquare, legalDestinations.contains(pos) {
            let move = ChessMove(from: from, to: pos, promotion: nil)
            submitMove(move)
            return
        }

        // Otherwise deselect
        deselect()
    }

    func submitMove(_ move: ChessMove) {
        puzzleState = .evaluatingMove
        movesPlayed += 1

        // Convert move to UCI
        let moveUCI = moveToUCI(move)

        // Check if correct
        if moveUCI == expectedMove {
            // Correct move!
            executeMove(move, animated: true)
            currentMoveIndex += 1

            // Check if puzzle complete
            if currentMoveIndex >= currentPuzzle?.moves.count ?? 0 {
                puzzleComplete(solved: true)
            } else {
                // Show feedback
                showCorrectFeedback()

                // Play opponent's response after delay
                Task {
                    try? await Task.sleep(nanoseconds: 500_000_000)  // 0.5 seconds
                    await playOpponentMove()
                }
            }
        } else {
            // Incorrect
            showIncorrectFeedback()
            puzzleState = .incorrect

            // Allow retry or fail
            Task {
                try? await Task.sleep(nanoseconds: 1_500_000_000)  // 1.5 seconds
                await MainActor.run {
                    // For now, mark as failed after one wrong attempt
                    puzzleComplete(solved: false)
                }
            }
        }

        deselect()
    }

    private func playOpponentMove() async {
        guard let puzzle = currentPuzzle,
              currentMoveIndex < puzzle.moves.count else { return }

        let opponentMoveUCI = puzzle.moves[currentMoveIndex]

        if let opponentMove = await puzzleService.uciToMove(opponentMoveUCI, in: boardState) {
            await MainActor.run {
                executeMove(opponentMove, animated: true)
                currentMoveIndex += 1

                // Set next expected move
                if currentMoveIndex < puzzle.moves.count {
                    expectedMove = puzzle.moves[currentMoveIndex]
                    puzzleState = .waitingForPlayerMove
                } else {
                    puzzleComplete(solved: true)
                }
            }
        }
    }

    private func puzzleComplete(solved: Bool) {
        puzzleState = solved ? .solved : .failed

        // Calculate time spent
        let timeSpent = puzzleStartTime.map { Date().timeIntervalSince($0) } ?? 0

        // Record attempt
        if let puzzle = currentPuzzle {
            let attempt = PuzzleAttempt(
                puzzleId: puzzle.id,
                date: Date(),
                solved: solved,
                timeSpent: timeSpent,
                movesPlayed: movesPlayed,
                hintsUsed: hintsUsed
            )

            Task {
                await puzzleService.recordAttempt(attempt)
                let stats = await puzzleService.getStats()
                await MainActor.run {
                    userRating = stats.rating
                    streak = stats.currentStreak
                }
            }
        }

        // Show celebration for solved puzzles
        if solved {
            CelebrationService.shared.celebrate(.achievement("Puzzle Solved!"))
        }
    }

    // MARK: - Move Execution

    private func executeMove(_ move: ChessMove, animated: Bool) {
        lastMove = move
        boardState.board.makeMove(move)
        boardState.turn = boardState.turn.opposite

        // Update king position if king moved
        if let piece = boardState.board.piece(at: move.to), piece.type == .king {
            if piece.color == .white {
                boardState.whiteKingPosition = move.to
            } else {
                boardState.blackKingPosition = move.to
            }
        }
    }

    // MARK: - Hints

    func showHintAction() {
        guard let puzzle = currentPuzzle,
              currentMoveIndex < puzzle.moves.count else { return }

        hintsUsed += 1

        let expectedUCI = puzzle.moves[currentMoveIndex]

        // Parse the expected move to give a hint
        if expectedUCI.count >= 4 {
            let fromFile = String(expectedUCI[expectedUCI.startIndex])
            let fromRank = String(expectedUCI[expectedUCI.index(expectedUCI.startIndex, offsetBy: 1)])

            hintText = "Try moving the piece on \(fromFile)\(fromRank)"
            showHint = true
        }
    }

    func dismissHint() {
        showHint = false
        hintText = ""
    }

    // MARK: - Feedback

    private func showCorrectFeedback() {
        feedbackText = "Correct!"
        showFeedback = true
        puzzleState = .correct

        Task {
            try? await Task.sleep(nanoseconds: 500_000_000)
            await MainActor.run {
                showFeedback = false
            }
        }
    }

    private func showIncorrectFeedback() {
        feedbackText = "That's not the best move"
        showFeedback = true
    }

    // MARK: - Helpers

    private func deselect() {
        selectedSquare = nil
        legalDestinations = []
    }

    private func calculateLegalDestinations(from pos: Position) -> [Position] {
        guard let piece = boardState.board.piece(at: pos),
              piece.color == boardState.turn else { return [] }

        var destinations: [Position] = []

        // Generate pseudo-legal moves
        for rank in 0..<8 {
            for file in 0..<8 {
                let to = Position(rank: rank, file: file)
                if canMove(from: pos, to: to, piece: piece) {
                    destinations.append(to)
                }
            }
        }

        return destinations
    }

    private func canMove(from: Position, to: Position, piece: ChessPiece) -> Bool {
        // Basic move validation (simplified)
        if let targetPiece = boardState.board.piece(at: to), targetPiece.color == piece.color {
            return false
        }

        let dr = to.rank - from.rank
        let df = to.file - from.file

        switch piece.type {
        case .pawn:
            let direction = piece.color == .white ? 1 : -1
            let startRank = piece.color == .white ? 1 : 6

            // Capture
            if abs(df) == 1 && dr == direction {
                return boardState.board.piece(at: to) != nil || to == boardState.enPassantTarget
            }
            // Move forward
            if df == 0 && boardState.board.piece(at: to) == nil {
                if dr == direction { return true }
                if dr == direction * 2 && from.rank == startRank {
                    let intermediate = Position(rank: from.rank + direction, file: from.file)
                    return boardState.board.piece(at: intermediate) == nil
                }
            }
            return false

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
            // Regular king move
            if abs(dr) <= 1 && abs(df) <= 1 { return true }
            // Castling handled separately
            return false
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
            if boardState.board.piece(at: checkPos) != nil {
                return false
            }
        }
        return true
    }

    private func moveToUCI(_ move: ChessMove) -> String {
        let files = ["a", "b", "c", "d", "e", "f", "g", "h"]
        var uci = files[move.from.file] + "\(move.from.rank + 1)" +
                  files[move.to.file] + "\(move.to.rank + 1)"

        if let promo = move.promotion {
            switch promo {
            case .queen: uci += "q"
            case .rook: uci += "r"
            case .bishop: uci += "b"
            case .knight: uci += "n"
            default: break
            }
        }

        return uci
    }

    // MARK: - Computed Properties

    var puzzleRating: Int {
        currentPuzzle?.rating ?? 0
    }

    var puzzleThemes: [String] {
        currentPuzzle?.themes ?? []
    }

    var isPlayerTurn: Bool {
        puzzleState == .waitingForPlayerMove
    }

    var statusText: String {
        switch puzzleState {
        case .loading:
            return "Loading puzzle..."
        case .ready:
            return "Puzzle ready"
        case .showingOpponentMove:
            return "Watch the opponent's move"
        case .waitingForPlayerMove:
            return "\(playerColor == .white ? "White" : "Black") to play"
        case .evaluatingMove:
            return "Checking..."
        case .correct:
            return "Correct!"
        case .incorrect:
            return "Incorrect"
        case .solved:
            return "Puzzle Solved! +\(ratingChange)"
        case .failed:
            return "Puzzle Failed"
        }
    }

    var ratingChange: Int {
        guard let puzzle = currentPuzzle else { return 0 }
        let expected = 1.0 / (1.0 + pow(10.0, Double(puzzle.rating - userRating) / 400.0))
        return Int(20 * (1.0 - expected))
    }
}
