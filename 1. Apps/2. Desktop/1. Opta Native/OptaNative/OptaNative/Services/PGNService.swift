//
//  PGNService.swift
//  OptaNative
//
//  Service for parsing and exporting chess games in PGN (Portable Game Notation) format.
//  Supports import from Chess.com, Lichess, and standard PGN files.
//  Created for Opta Native macOS - Phase 100
//

import Foundation

// MARK: - PGN Metadata

struct PGNMetadata: Sendable, Codable {
    var event: String = "Opta Chess"
    var site: String = "Opta App"
    var date: String = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy.MM.dd"
        return formatter.string(from: Date())
    }()
    var round: String = "-"
    var white: String = "Player"
    var black: String = "Opta AI"
    var result: String = "*"
    var eco: String?
    var whiteElo: Int?
    var blackElo: Int?
    var timeControl: String?
    var termination: String?
}

// MARK: - Imported Game

struct ImportedGame: Sendable {
    let metadata: PGNMetadata
    let moves: [String]  // SAN notation
    let fenStart: String?
    let comments: [Int: String]  // Move index to comment
}

// MARK: - PGN Parse Error

enum PGNParseError: Error, LocalizedError {
    case invalidFormat
    case invalidMove(String)
    case emptyFile
    case missingMoves

    var errorDescription: String? {
        switch self {
        case .invalidFormat:
            return "Invalid PGN format"
        case .invalidMove(let move):
            return "Invalid move: \(move)"
        case .emptyFile:
            return "PGN file is empty"
        case .missingMoves:
            return "No moves found in PGN"
        }
    }
}

// MARK: - PGN Service

actor PGNService {
    static let shared = PGNService()

    private init() {}

    // MARK: - Parse PGN

    /// Parse a PGN string into an ImportedGame
    func parsePGN(_ pgn: String) async throws -> ImportedGame {
        let trimmed = pgn.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw PGNParseError.emptyFile
        }

        // Split into header and moves sections
        let lines = trimmed.components(separatedBy: .newlines)
        var metadata = PGNMetadata()
        var movesSection = ""
        var inMoves = false
        var fenStart: String?

        for line in lines {
            let trimmedLine = line.trimmingCharacters(in: .whitespaces)

            if trimmedLine.hasPrefix("[") && trimmedLine.hasSuffix("]") {
                // Header tag
                let (tag, value) = parseHeaderTag(trimmedLine)
                switch tag.lowercased() {
                case "event": metadata.event = value
                case "site": metadata.site = value
                case "date": metadata.date = value
                case "round": metadata.round = value
                case "white": metadata.white = value
                case "black": metadata.black = value
                case "result": metadata.result = value
                case "eco": metadata.eco = value
                case "whiteelo": metadata.whiteElo = Int(value)
                case "blackelo": metadata.blackElo = Int(value)
                case "timecontrol": metadata.timeControl = value
                case "termination": metadata.termination = value
                case "fen", "setup": fenStart = value
                default: break
                }
            } else if !trimmedLine.isEmpty {
                inMoves = true
                movesSection += " " + trimmedLine
            }
        }

        guard inMoves else {
            throw PGNParseError.missingMoves
        }

        // Parse moves section
        let (moves, comments) = parseMoveText(movesSection)

        guard !moves.isEmpty else {
            throw PGNParseError.missingMoves
        }

        return ImportedGame(
            metadata: metadata,
            moves: moves,
            fenStart: fenStart,
            comments: comments
        )
    }

    /// Parse a header tag line like [Event "Casual Game"]
    private func parseHeaderTag(_ line: String) -> (tag: String, value: String) {
        // Remove brackets
        var content = line
        content.removeFirst() // [
        content.removeLast()  // ]

        // Split by first space
        let parts = content.split(separator: " ", maxSplits: 1)
        guard parts.count >= 2 else {
            return (String(parts.first ?? ""), "")
        }

        let tag = String(parts[0])
        var value = String(parts[1])

        // Remove quotes
        if value.hasPrefix("\"") { value.removeFirst() }
        if value.hasSuffix("\"") { value.removeLast() }

        return (tag, value)
    }

    /// Parse the move text section, extracting moves and comments
    private func parseMoveText(_ text: String) -> (moves: [String], comments: [Int: String]) {
        var moves: [String] = []
        var comments: [Int: String] = [:]
        var currentComment = ""
        var inComment = false
        var depth = 0  // For nested variations

        // Tokenize
        var tokens: [String] = []
        var currentToken = ""

        for char in text {
            if char == "{" {
                if !currentToken.isEmpty {
                    tokens.append(currentToken)
                    currentToken = ""
                }
                inComment = true
                currentComment = ""
            } else if char == "}" {
                inComment = false
                if !currentComment.isEmpty {
                    comments[moves.count] = currentComment.trimmingCharacters(in: .whitespaces)
                }
            } else if inComment {
                currentComment.append(char)
            } else if char == "(" {
                depth += 1
                if !currentToken.isEmpty {
                    tokens.append(currentToken)
                    currentToken = ""
                }
            } else if char == ")" {
                depth -= 1
            } else if depth == 0 {
                if char.isWhitespace {
                    if !currentToken.isEmpty {
                        tokens.append(currentToken)
                        currentToken = ""
                    }
                } else {
                    currentToken.append(char)
                }
            }
        }

        if !currentToken.isEmpty {
            tokens.append(currentToken)
        }

        // Filter tokens to extract only moves
        for token in tokens {
            // Skip move numbers (1. 1... etc)
            if token.first?.isNumber == true && (token.contains(".") || token.allSatisfy({ $0.isNumber })) {
                continue
            }

            // Skip results
            if token == "1-0" || token == "0-1" || token == "1/2-1/2" || token == "*" {
                continue
            }

            // Skip NAGs ($1, $2, etc)
            if token.hasPrefix("$") {
                continue
            }

            // This should be a move
            if isValidMoveToken(token) {
                moves.append(token)
            }
        }

        return (moves, comments)
    }

    /// Check if a token looks like a valid chess move
    private func isValidMoveToken(_ token: String) -> Bool {
        // Castling
        if token == "O-O" || token == "O-O-O" || token == "0-0" || token == "0-0-0" {
            return true
        }

        // Standard move pattern: piece + destination, possibly with capture, check, etc
        let movePattern = #"^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?$"#
        if let regex = try? NSRegularExpression(pattern: movePattern, options: []) {
            let range = NSRange(token.startIndex..., in: token)
            return regex.firstMatch(in: token, options: [], range: range) != nil
        }

        return false
    }

    // MARK: - Export to PGN

    /// Export a game to PGN format
    func exportToPGN(moves: [String], metadata: PGNMetadata = PGNMetadata()) async -> String {
        var pgn = ""

        // Header tags
        pgn += "[Event \"\(metadata.event)\"]\n"
        pgn += "[Site \"\(metadata.site)\"]\n"
        pgn += "[Date \"\(metadata.date)\"]\n"
        pgn += "[Round \"\(metadata.round)\"]\n"
        pgn += "[White \"\(metadata.white)\"]\n"
        pgn += "[Black \"\(metadata.black)\"]\n"
        pgn += "[Result \"\(metadata.result)\"]\n"

        if let eco = metadata.eco {
            pgn += "[ECO \"\(eco)\"]\n"
        }
        if let whiteElo = metadata.whiteElo {
            pgn += "[WhiteElo \"\(whiteElo)\"]\n"
        }
        if let blackElo = metadata.blackElo {
            pgn += "[BlackElo \"\(blackElo)\"]\n"
        }
        if let timeControl = metadata.timeControl {
            pgn += "[TimeControl \"\(timeControl)\"]\n"
        }

        pgn += "\n"

        // Moves
        var moveText = ""
        for (index, move) in moves.enumerated() {
            if index % 2 == 0 {
                // White's move
                moveText += "\(index / 2 + 1). "
            }
            moveText += move + " "
        }

        // Add result
        moveText += metadata.result

        // Word wrap at 80 characters
        let wrapped = wordWrap(moveText, lineLength: 80)
        pgn += wrapped

        return pgn
    }

    /// Word wrap text at specified line length
    private func wordWrap(_ text: String, lineLength: Int) -> String {
        let words = text.split(separator: " ")
        var lines: [String] = []
        var currentLine = ""

        for word in words {
            if currentLine.isEmpty {
                currentLine = String(word)
            } else if currentLine.count + 1 + word.count <= lineLength {
                currentLine += " " + word
            } else {
                lines.append(currentLine)
                currentLine = String(word)
            }
        }

        if !currentLine.isEmpty {
            lines.append(currentLine)
        }

        return lines.joined(separator: "\n")
    }

    // MARK: - File Operations

    /// Import PGN from file URL
    func importFromFile(_ url: URL) async throws -> ImportedGame {
        let content = try String(contentsOf: url, encoding: .utf8)
        return try await parsePGN(content)
    }

    /// Save PGN to file
    func saveToFile(_ pgn: String, at url: URL) async throws {
        try pgn.write(to: url, atomically: true, encoding: .utf8)
    }

    // MARK: - Multiple Games

    /// Parse multiple games from a PGN file
    func parseMultipleGames(_ pgn: String) async throws -> [ImportedGame] {
        var games: [ImportedGame] = []

        // Split by [Event tags
        let pattern = #"(?=\[Event\s)"#
        let regex = try NSRegularExpression(pattern: pattern, options: [])
        let range = NSRange(pgn.startIndex..., in: pgn)

        var ranges: [Range<String.Index>] = []
        var lastEnd = pgn.startIndex

        regex.enumerateMatches(in: pgn, options: [], range: range) { match, _, _ in
            if let matchRange = match?.range, let swiftRange = Range(matchRange, in: pgn) {
                if lastEnd < swiftRange.lowerBound {
                    ranges.append(lastEnd..<swiftRange.lowerBound)
                }
                lastEnd = swiftRange.lowerBound
            }
        }

        if lastEnd < pgn.endIndex {
            ranges.append(lastEnd..<pgn.endIndex)
        }

        // If no splits found, try parsing as single game
        if ranges.isEmpty {
            let game = try await parsePGN(pgn)
            return [game]
        }

        // Parse each game section
        for i in 0..<ranges.count {
            let start = i == 0 ? ranges[i].lowerBound : ranges[i].lowerBound
            let end = i == ranges.count - 1 ? pgn.endIndex : ranges[i + 1].lowerBound
            let gameText = String(pgn[start..<end])

            if !gameText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                do {
                    let game = try await parsePGN(gameText)
                    games.append(game)
                } catch {
                    // Skip invalid games
                    continue
                }
            }
        }

        return games
    }

    // MARK: - SAN to ChessMove Conversion

    /// Convert SAN notation to ChessMove (requires current board state)
    func sanToMove(_ san: String, in state: ChessState) async -> ChessMove? {
        let cleaned = san
            .replacingOccurrences(of: "+", with: "")
            .replacingOccurrences(of: "#", with: "")
            .replacingOccurrences(of: "!", with: "")
            .replacingOccurrences(of: "?", with: "")

        // Castling
        if cleaned == "O-O" || cleaned == "0-0" {
            let rank = state.turn == .white ? 0 : 7
            return ChessMove(
                from: Position(rank: rank, file: 4),
                to: Position(rank: rank, file: 6),
                promotion: nil,
                isCastling: true,
                isEnPassant: false
            )
        }
        if cleaned == "O-O-O" || cleaned == "0-0-0" {
            let rank = state.turn == .white ? 0 : 7
            return ChessMove(
                from: Position(rank: rank, file: 4),
                to: Position(rank: rank, file: 2),
                promotion: nil,
                isCastling: true,
                isEnPassant: false
            )
        }

        // Parse move components
        var moveText = cleaned
        var promotion: ChessPieceType?

        // Check for promotion
        if moveText.contains("=") {
            let parts = moveText.split(separator: "=")
            moveText = String(parts[0])
            if let promoChar = parts.last?.first {
                promotion = pieceType(from: promoChar)
            }
        }

        // Determine piece type
        var pieceType: ChessPieceType = .pawn
        if let first = moveText.first, first.isUppercase {
            pieceType = self.pieceType(from: first) ?? .pawn
            moveText.removeFirst()
        }

        // Remove capture indicator
        let isCapture = moveText.contains("x")
        moveText = moveText.replacingOccurrences(of: "x", with: "")

        // Get destination (last two characters)
        guard moveText.count >= 2 else { return nil }

        let destFile = fileIndex(from: moveText[moveText.index(moveText.endIndex, offsetBy: -2)])
        let destRank = Int(String(moveText[moveText.index(moveText.endIndex, offsetBy: -1)])) ?? 0
        let destination = Position(rank: destRank - 1, file: destFile ?? 0)

        guard destFile != nil, destination.rank >= 0, destination.rank < 8 else { return nil }

        // Disambiguation
        moveText = String(moveText.dropLast(2))
        var sourceFile: Int?
        var sourceRank: Int?

        for char in moveText {
            if char.isLetter, let file = fileIndex(from: char) {
                sourceFile = file
            } else if char.isNumber, let rank = Int(String(char)) {
                sourceRank = rank - 1
            }
        }

        // Find the piece that can make this move
        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)

                // Check disambiguation constraints
                if let sf = sourceFile, file != sf { continue }
                if let sr = sourceRank, rank != sr { continue }

                if let piece = state.board.piece(at: pos),
                   piece.type == pieceType,
                   piece.color == state.turn {
                    // Check if this piece can reach destination
                    if canPieceMove(from: pos, to: destination, piece: piece, state: state, isCapture: isCapture) {
                        let isEnPassant = pieceType == .pawn && isCapture && state.board.piece(at: destination) == nil
                        return ChessMove(
                            from: pos,
                            to: destination,
                            promotion: promotion,
                            isCastling: false,
                            isEnPassant: isEnPassant
                        )
                    }
                }
            }
        }

        return nil
    }

    private func pieceType(from char: Character) -> ChessPieceType? {
        switch char {
        case "K": return .king
        case "Q": return .queen
        case "R": return .rook
        case "B": return .bishop
        case "N": return .knight
        case "P": return .pawn
        default: return nil
        }
    }

    private func fileIndex(from char: Character) -> Int? {
        guard let asciiValue = char.asciiValue else { return nil }
        let index = Int(asciiValue) - Int(Character("a").asciiValue!)
        return index >= 0 && index < 8 ? index : nil
    }

    /// Simple check if piece can move (doesn't validate full legality)
    private func canPieceMove(from: Position, to: Position, piece: ChessPiece, state: ChessState, isCapture: Bool) -> Bool {
        let dr = to.rank - from.rank
        let df = to.file - from.file

        switch piece.type {
        case .pawn:
            let direction = piece.color == .white ? 1 : -1
            if isCapture {
                return dr == direction && abs(df) == 1
            } else {
                if df != 0 { return false }
                if dr == direction { return true }
                if dr == direction * 2 {
                    let startRank = piece.color == .white ? 1 : 6
                    return from.rank == startRank
                }
                return false
            }

        case .knight:
            return (abs(dr) == 2 && abs(df) == 1) || (abs(dr) == 1 && abs(df) == 2)

        case .bishop:
            return abs(dr) == abs(df) && dr != 0

        case .rook:
            return (dr == 0 || df == 0) && (dr != 0 || df != 0)

        case .queen:
            return (dr == 0 || df == 0 || abs(dr) == abs(df)) && (dr != 0 || df != 0)

        case .king:
            return abs(dr) <= 1 && abs(df) <= 1
        }
    }
}
