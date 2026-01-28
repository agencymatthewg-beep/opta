//
//  OptaAIEngine.swift
//  OptaNative
//
//  OptaAI - A personalized chess AI that learns from your games.
//  Plays in YOUR style using YOUR opening repertoire.
//
//  Created for Opta Native macOS
//

import Foundation

// MARK: - OptaAI Engine

actor OptaAIEngine {

    // MARK: - Constants

    /// Maximum moves to track in opening book (20 full moves = 40 half-moves)
    private static let maxOpeningBookMoves = 40

    /// Default AI thinking time in milliseconds
    private static let defaultFallbackTimeMs = 1500

    /// Default search depth for tactical fallback
    private static let defaultSearchDepth = 4

    // MARK: - Configuration

    /// Opening book built from user's games
    private var openingBook: [String: [WeightedMove]] = [:]

    /// Position frequency map (how often user reached each position)
    private var positionFrequency: [String: Int] = [:]

    /// User's playing color in their games
    private let username: String

    /// Fallback AI for positions not in opening book (injectable for testing)
    private let fallbackAI: ChessAI

    /// Whether the opening book has been loaded
    private var isLoaded = false

    // MARK: - Types

    struct WeightedMove: Sendable {
        let move: String          // e.g., "d4", "Nf3"
        let count: Int            // Times played
        let winRate: Double       // Win rate with this move
        let from: Position
        let to: Position
        let promotion: ChessPieceType?
    }

    struct GameRecord: Sendable {
        let white: String
        let black: String
        let result: GameResult
        let moves: [String]

        enum GameResult: Sendable {
            case whiteWins
            case blackWins
            case draw
        }
    }

    // MARK: - Initialization

    /// Initialize OptaAI with configurable username and fallback AI
    /// - Parameters:
    ///   - username: The chess.com/lichess username to learn from
    ///   - fallbackAI: Optional custom AI instance for dependency injection (defaults to ChessAI)
    init(username: String, fallbackAI: ChessAI? = nil) {
        self.username = username
        self.fallbackAI = fallbackAI ?? ChessAI(maxTimeMs: Self.defaultFallbackTimeMs)
    }

    // MARK: - Public API

    /// Load opening book from PGN file
    func loadOpeningBook(from pgnContent: String) async {
        let games = parsePGN(pgnContent)
        buildOpeningBook(from: games)
        isLoaded = true
        #if DEBUG
        print("OptaAI: Loaded \(games.count) games, \(openingBook.count) positions")
        #endif
    }

    /// Get the best move in user's style
    func getBestMove(state: ChessState, playingAs color: ChessColor) async -> ChessMove? {
        // Generate position key
        let positionKey = generatePositionKey(state: state)

        // Check opening book first
        if let bookMoves = openingBook[positionKey], !bookMoves.isEmpty {
            // Select move based on user's historical preferences
            if let selectedMove = selectMoveFromBook(bookMoves, state: state) {
                #if DEBUG
                print("OptaAI: Playing book move")
                #endif
                return selectedMove
            }
        }

        // Fall back to tactical AI for unknown positions
        #if DEBUG
        print("OptaAI: Position not in book, using tactical engine")
        #endif
        return await fallbackAI.calculateBestMove(
            state: state,
            color: color,
            targetDepth: Self.defaultSearchDepth
        )
    }

    /// Check if a position is in the opening book
    func isInOpeningBook(state: ChessState) -> Bool {
        let key = generatePositionKey(state: state)
        return openingBook[key] != nil
    }

    // MARK: - PGN Parsing

    private func parsePGN(_ content: String) -> [GameRecord] {
        var games: [GameRecord] = []

        // Split into individual games
        let gameBlocks = content.components(separatedBy: "\n[Event")

        for (index, block) in gameBlocks.enumerated() {
            let gameText = index == 0 ? block : "[Event" + block

            // Extract headers
            guard let white = extractHeader(gameText, header: "White"),
                  let black = extractHeader(gameText, header: "Black"),
                  let resultStr = extractHeader(gameText, header: "Result") else {
                continue
            }

            // Parse result
            let result: GameRecord.GameResult
            switch resultStr {
            case "1-0": result = .whiteWins
            case "0-1": result = .blackWins
            default: result = .draw
            }

            // Extract moves
            let moves = extractMoves(from: gameText)

            // Only include games where user played
            if white == username || black == username {
                games.append(GameRecord(white: white, black: black, result: result, moves: moves))
            }
        }

        return games
    }

    private func extractHeader(_ text: String, header: String) -> String? {
        let pattern = "\\[\(header) \"([^\"]+)\"\\]"
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text) else {
            return nil
        }
        return String(text[range])
    }

    private func extractMoves(from gameText: String) -> [String] {
        // Find the moves section (after the last header)
        guard let movesStart = gameText.range(of: "]\n\n")?.upperBound ??
                               gameText.range(of: "]\n1.")?.lowerBound else {
            return []
        }

        let movesText = String(gameText[movesStart...])

        // Extract individual moves using regex
        let pattern = "([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O-O|O-O)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return []
        }

        let matches = regex.matches(in: movesText, range: NSRange(movesText.startIndex..., in: movesText))
        return matches.compactMap { match in
            guard let range = Range(match.range, in: movesText) else { return nil }
            return String(movesText[range])
        }
    }

    // MARK: - Opening Book Construction

    private func buildOpeningBook(from games: [GameRecord]) {
        for game in games {
            let userIsWhite = game.white == username
            var state = ChessState()

            for (moveIndex, moveNotation) in game.moves.enumerated() {
                let isUserMove = (moveIndex % 2 == 0) == userIsWhite
                let positionKey = generatePositionKey(state: state)

                // Track position frequency
                positionFrequency[positionKey, default: 0] += 1

                // If it's the user's move, record it in opening book
                if isUserMove {
                    if let move = parseAlgebraicMove(moveNotation, state: state) {
                        addToOpeningBook(
                            positionKey: positionKey,
                            move: moveNotation,
                            from: move.from,
                            to: move.to,
                            promotion: move.promotion,
                            result: game.result,
                            userIsWhite: userIsWhite
                        )
                    }
                }

                // Apply the move to advance the position
                if let move = parseAlgebraicMove(moveNotation, state: state) {
                    state.board.makeMove(move)
                    state.turn = state.turn.opposite

                    // Update king position if needed
                    if let piece = state.board.piece(at: move.to), piece.type == .king {
                        if piece.color == .white {
                            state.whiteKingPosition = move.to
                        } else {
                            state.blackKingPosition = move.to
                        }
                    }
                }

                // Only track first 20 moves for opening book (40 half-moves)
                if moveIndex >= Self.maxOpeningBookMoves { break }
            }
        }
    }

    private func addToOpeningBook(
        positionKey: String,
        move: String,
        from: Position,
        to: Position,
        promotion: ChessPieceType?,
        result: GameRecord.GameResult,
        userIsWhite: Bool
    ) {
        var moves = openingBook[positionKey] ?? []

        // Check if move already exists
        if let existingIndex = moves.firstIndex(where: { $0.move == move }) {
            let existing = moves[existingIndex]
            let wasWin = (result == .whiteWins && userIsWhite) || (result == .blackWins && !userIsWhite)
            let newCount = existing.count + 1
            let newWinRate = (existing.winRate * Double(existing.count) + (wasWin ? 1.0 : 0.0)) / Double(newCount)

            moves[existingIndex] = WeightedMove(
                move: move,
                count: newCount,
                winRate: newWinRate,
                from: from,
                to: to,
                promotion: promotion
            )
        } else {
            let wasWin = (result == .whiteWins && userIsWhite) || (result == .blackWins && !userIsWhite)
            moves.append(WeightedMove(
                move: move,
                count: 1,
                winRate: wasWin ? 1.0 : 0.0,
                from: from,
                to: to,
                promotion: promotion
            ))
        }

        openingBook[positionKey] = moves
    }

    // MARK: - Move Selection

    private func selectMoveFromBook(_ bookMoves: [WeightedMove], state: ChessState) -> ChessMove? {
        // Weight moves by frequency (how often user played them)
        let totalCount = bookMoves.reduce(0) { $0 + $1.count }

        // Random selection weighted by frequency
        let random = Int.random(in: 0..<totalCount)
        var cumulative = 0

        for weightedMove in bookMoves {
            cumulative += weightedMove.count
            if random < cumulative {
                // Verify the move is legal in current position
                let move = ChessMove(
                    from: weightedMove.from,
                    to: weightedMove.to,
                    promotion: weightedMove.promotion
                )

                // Validate move is legal
                if isMoveLegal(move, in: state) {
                    return move
                }
            }
        }

        // Fallback to most frequent move
        if let mostFrequent = bookMoves.max(by: { $0.count < $1.count }) {
            let move = ChessMove(
                from: mostFrequent.from,
                to: mostFrequent.to,
                promotion: mostFrequent.promotion
            )
            if isMoveLegal(move, in: state) {
                return move
            }
        }

        return nil
    }

    private func isMoveLegal(_ move: ChessMove, in state: ChessState) -> Bool {
        guard let piece = state.board.piece(at: move.from) else { return false }
        guard piece.color == state.turn else { return false }

        // Target must be empty or enemy piece
        if let targetPiece = state.board.piece(at: move.to) {
            if targetPiece.color == piece.color { return false }
        }

        // Validate the piece can actually make this move
        return canPieceReach(from: move.from, to: move.to, piece: piece, state: state)
    }

    // MARK: - Position Key Generation

    private func generatePositionKey(state: ChessState) -> String {
        // Generate a unique key for the position (simplified FEN-like)
        var key = ""

        for rank in (0..<8).reversed() {
            var emptyCount = 0
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                if let piece = state.board.piece(at: pos) {
                    if emptyCount > 0 {
                        key += String(emptyCount)
                        emptyCount = 0
                    }
                    key += pieceToChar(piece)
                } else {
                    emptyCount += 1
                }
            }
            if emptyCount > 0 {
                key += String(emptyCount)
            }
            if rank > 0 { key += "/" }
        }

        key += state.turn == .white ? " w" : " b"
        return key
    }

    private func pieceToChar(_ piece: ChessPiece) -> String {
        let char: String
        switch piece.type {
        case .pawn: char = "p"
        case .knight: char = "n"
        case .bishop: char = "b"
        case .rook: char = "r"
        case .queen: char = "q"
        case .king: char = "k"
        }
        return piece.color == .white ? char.uppercased() : char
    }

    // MARK: - Algebraic Move Parsing

    private func parseAlgebraicMove(_ notation: String, state: ChessState) -> ChessMove? {
        let clean = notation.replacingOccurrences(of: "+", with: "")
                           .replacingOccurrences(of: "#", with: "")

        // Handle castling
        if clean == "O-O" {
            let rank = state.turn == .white ? 0 : 7
            return ChessMove(
                from: Position(rank: rank, file: 4),
                to: Position(rank: rank, file: 6),
                promotion: nil,
                isCastling: true
            )
        }
        if clean == "O-O-O" {
            let rank = state.turn == .white ? 0 : 7
            return ChessMove(
                from: Position(rank: rank, file: 4),
                to: Position(rank: rank, file: 2),
                promotion: nil,
                isCastling: true
            )
        }

        // Parse destination square (last 2 characters before promotion)
        var moveStr = clean
        var promotion: ChessPieceType? = nil

        // Check for promotion
        if moveStr.contains("=") {
            let parts = moveStr.split(separator: "=")
            if parts.count == 2 {
                moveStr = String(parts[0])
                promotion = parsePromotion(String(parts[1]))
            }
        }

        // Get destination
        guard moveStr.count >= 2 else { return nil }
        let destStr = String(moveStr.suffix(2))
        guard let destination = Position.from(notation: destStr) else { return nil }

        // Determine piece type
        let pieceType: ChessPieceType
        let firstChar = moveStr.first!

        if firstChar.isUppercase {
            switch firstChar {
            case "K": pieceType = .king
            case "Q": pieceType = .queen
            case "R": pieceType = .rook
            case "B": pieceType = .bishop
            case "N": pieceType = .knight
            default: return nil
            }
        } else {
            pieceType = .pawn
        }

        // Find the piece that can make this move
        let disambig = moveStr.dropLast(2).filter { !$0.isUppercase && $0 != "x" }

        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                guard let piece = state.board.piece(at: pos),
                      piece.color == state.turn,
                      piece.type == pieceType else { continue }

                // Check disambiguation
                if !disambig.isEmpty {
                    let posNotation = pos.notation
                    if !disambig.allSatisfy({ posNotation.contains($0) }) {
                        continue
                    }
                }

                // Check if this piece can reach the destination
                if canPieceReach(from: pos, to: destination, piece: piece, state: state) {
                    return ChessMove(from: pos, to: destination, promotion: promotion)
                }
            }
        }

        return nil
    }

    private func parsePromotion(_ char: String) -> ChessPieceType? {
        switch char.uppercased() {
        case "Q": return .queen
        case "R": return .rook
        case "B": return .bishop
        case "N": return .knight
        default: return nil
        }
    }

    // Note: canPieceReach() and isPathClear() are now shared functions in ChessEngine.swift
}
