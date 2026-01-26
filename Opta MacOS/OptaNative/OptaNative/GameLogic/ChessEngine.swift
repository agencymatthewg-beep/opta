//
//  ChessEngine.swift
//  OptaNative
//
//  Native Swift Chess Engine.
//  Handles board state, FEN parsing, and move validation.
//  Created for Opta Native macOS - Plan 100-01 (v12.0)
//

import Foundation

// MARK: - Models

enum ChessColor: String, Sendable {
    case white
    case black
    
    var opposite: ChessColor { self == .white ? .black : .white }
}

enum ChessPieceType: String, Sendable {
    case pawn, knight, bishop, rook, queen, king
}

struct ChessPiece: Identifiable, Equatable, Hashable, Sendable {
    // Stable ID based on color and type (position-independent for state tracking)
    let id: String
    let color: ChessColor
    let type: ChessPieceType

    init(color: ChessColor, type: ChessPieceType) {
        self.color = color
        self.type = type
        // Generate stable ID combining color and type with UUID for uniqueness
        self.id = "\(color.rawValue)_\(type.rawValue)_\(UUID().uuidString.prefix(8))"
    }

    var symbol: String {
        switch (color, type) {
        case (.white, .king): return "♔"
        case (.white, .queen): return "♕"
        case (.white, .rook): return "♖"
        case (.white, .bishop): return "♗"
        case (.white, .knight): return "♘"
        case (.white, .pawn): return "♙"
        
        case (.black, .king): return "♚"
        case (.black, .queen): return "♛"
        case (.black, .rook): return "♜"
        case (.black, .bishop): return "♝"
        case (.black, .knight): return "♞"
        case (.black, .pawn): return "♟"
        }
    }
}

struct ChessMove: Equatable, Hashable, Sendable {
    let from: Position
    let to: Position
    let promotion: ChessPieceType?
    var isCastling: Bool = false
    var isEnPassant: Bool = false

    func hash(into hasher: inout Hasher) {
        hasher.combine(from)
        hasher.combine(to)
        hasher.combine(promotion)
        hasher.combine(isCastling)
        hasher.combine(isEnPassant)
    }
}

struct Position: Equatable, Hashable, Sendable {
    let rank: Int // 0-7 (0 is rank 1, 7 is rank 8)
    let file: Int // 0-7 (0 is a, 7 is h)

    // Static file notation array (avoids allocation per call)
    private static let fileNotation = ["a", "b", "c", "d", "e", "f", "g", "h"]

    static func from(index: Int) -> Position {
        return Position(rank: 7 - (index / 8), file: index % 8)
    }

    static func from(notation: String) -> Position? {
        guard notation.count == 2 else { return nil }
        let chars = Array(notation.lowercased())
        guard let fileIndex = fileNotation.firstIndex(of: String(chars[0])),
              let rankNumber = Int(String(chars[1])),
              rankNumber >= 1 && rankNumber <= 8 else {
            return nil
        }
        return Position(rank: rankNumber - 1, file: fileIndex)
    }

    func toIndex() -> Int {
        return (7 - rank) * 8 + file
    }

    /// Returns algebraic notation (e.g. "e4")
    var notation: String {
        "\(Position.fileNotation[file])\(rank + 1)"
    }
}

// MARK: - Engine

struct ChessBoard: Sendable {
    private var squares: [ChessPiece?] // 64 squares, row-major from top-left (a8...h8, a7...h7...)
    
    init() {
        squares = Array(repeating: nil, count: 64)
    }
    
    /// Get piece at position
    func piece(at pos: Position) -> ChessPiece? {
        guard isValid(pos) else { return nil }
        return squares[pos.toIndex()]
    }
    
    func piece(at index: Int) -> ChessPiece? {
        guard index >= 0 && index < 64 else { return nil }
        return squares[index]
    }
    
    /// Check if position is on board
    func isValid(_ pos: Position) -> Bool {
        return pos.rank >= 0 && pos.rank < 8 && pos.file >= 0 && pos.file < 8
    }
    
    // Mutating methods
    mutating func setPiece(_ piece: ChessPiece?, at pos: Position) {
        squares[pos.toIndex()] = piece
    }
    
    mutating func makeMove(_ move: ChessMove) {
        let p = piece(at: move.from)
        setPiece(nil, at: move.from)

        // Handle castling
        if move.isCastling, let p = p, p.type == .king {
            // Move the king
            setPiece(p, at: move.to)

            // Move the rook
            if move.to.file == 6 { // Kingside
                let rookFrom = Position(rank: move.from.rank, file: 7)
                let rookTo = Position(rank: move.from.rank, file: 5)
                let rook = piece(at: rookFrom)
                setPiece(nil, at: rookFrom)
                setPiece(rook, at: rookTo)
            } else if move.to.file == 2 { // Queenside
                let rookFrom = Position(rank: move.from.rank, file: 0)
                let rookTo = Position(rank: move.from.rank, file: 3)
                let rook = piece(at: rookFrom)
                setPiece(nil, at: rookFrom)
                setPiece(rook, at: rookTo)
            }
            return
        }

        // Handle en passant
        if move.isEnPassant, let p = p, p.type == .pawn {
            setPiece(p, at: move.to)
            // Remove the captured pawn
            let capturedPawnPos = Position(rank: move.from.rank, file: move.to.file)
            setPiece(nil, at: capturedPawnPos)
            return
        }

        // Promotion
        if let p = p, p.type == .pawn, (move.to.rank == 0 || move.to.rank == 7) {
            let newType = move.promotion ?? .queen
            setPiece(ChessPiece(color: p.color, type: newType), at: move.to)
        } else {
            setPiece(p, at: move.to)
        }
    }
    
    mutating func loadFEN(_ fen: String) {
        squares = Array(repeating: nil, count: 64)
        
        let parts = fen.split(separator: " ")
        guard let boardPart = parts.first else { return }
        
        var rank = 7
        var file = 0
        
        for char in boardPart {
            if char == "/" {
                rank -= 1
                file = 0
            } else if let digit = char.wholeNumberValue {
                file += digit
            } else {
                let color: ChessColor = char.isUppercase ? .white : .black
                let type: ChessPieceType
                switch char.lowercased() {
                case "p": type = .pawn
                case "n": type = .knight
                case "b": type = .bishop
                case "r": type = .rook
                case "q": type = .queen
                case "k": type = .king
                default: continue
                }
                
                let pos = Position(rank: rank, file: file)
                if isValid(pos) {
                    setPiece(ChessPiece(color: color, type: type), at: pos)
                }
                file += 1
            }
        }
    }
}

// MARK: - Game State

// MARK: - Shared Move Validation (Used by ChessAI and OptaAI)

/// Validates whether a piece can reach a target square
/// - Parameters:
///   - from: Source position
///   - to: Destination position
///   - piece: The piece attempting to move
///   - state: Current game state (for path checking and en passant)
/// - Returns: True if the piece can legally reach the destination
func canPieceReach(from: Position, to: Position, piece: ChessPiece, state: ChessState) -> Bool {
    // Can't move to the same square
    guard from != to else { return false }

    // Validate positions are on board
    guard state.board.isValid(from) && state.board.isValid(to) else { return false }

    let dr = to.rank - from.rank
    let df = to.file - from.file

    switch piece.type {
    case .pawn:
        let direction = piece.color == .white ? 1 : -1
        let startRank = piece.color == .white ? 1 : 6

        // Capture (including en passant)
        if abs(df) == 1 && dr == direction {
            // Regular capture
            if state.board.piece(at: to) != nil { return true }
            // En passant capture
            if let epTarget = state.enPassantTarget, to == epTarget { return true }
        }
        // Forward move
        if df == 0 && dr == direction {
            return state.board.piece(at: to) == nil
        }
        // Double move from start
        if df == 0 && dr == direction * 2 && from.rank == startRank {
            let intermediate = Position(rank: from.rank + direction, file: from.file)
            return state.board.piece(at: intermediate) == nil && state.board.piece(at: to) == nil
        }
        return false

    case .knight:
        return (abs(dr) == 2 && abs(df) == 1) || (abs(dr) == 1 && abs(df) == 2)

    case .bishop:
        if abs(dr) != abs(df) || dr == 0 { return false }
        return isPathClear(from: from, to: to, state: state)

    case .rook:
        if dr != 0 && df != 0 { return false }
        return isPathClear(from: from, to: to, state: state)

    case .queen:
        if dr != 0 && df != 0 && abs(dr) != abs(df) { return false }
        return isPathClear(from: from, to: to, state: state)

    case .king:
        return abs(dr) <= 1 && abs(df) <= 1
    }
}

/// Checks if path between two positions is clear of pieces (for sliding pieces)
func isPathClear(from: Position, to: Position, state: ChessState) -> Bool {
    let dr = to.rank - from.rank
    let df = to.file - from.file

    // Same square - no path to check
    guard dr != 0 || df != 0 else { return true }

    let steps = max(abs(dr), abs(df))
    guard steps >= 1 else { return true }

    let stepR = dr == 0 ? 0 : dr / abs(dr)
    let stepF = df == 0 ? 0 : df / abs(df)

    for i in 1..<steps {
        let newRank = from.rank + stepR * i
        let newFile = from.file + stepF * i

        // Validate bounds
        guard newRank >= 0 && newRank < 8 && newFile >= 0 && newFile < 8 else {
            return false
        }

        let checkPos = Position(rank: newRank, file: newFile)
        if state.board.piece(at: checkPos) != nil {
            return false
        }
    }
    return true
}

// MARK: - Game State

struct ChessState: Sendable {
    var board: ChessBoard
    var turn: ChessColor
    var castlingRights: String // "KQkq", "-"
    var enPassantTarget: Position?
    var halfMoveClock: Int
    var fullMoveNumber: Int

    // Cached king positions for O(1) lookup
    var whiteKingPosition: Position?
    var blackKingPosition: Position?

    static let startingFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

    init(fen: String = ChessState.startingFEN) {
        self.board = ChessBoard()
        self.turn = .white
        self.castlingRights = "KQkq"
        self.halfMoveClock = 0
        self.fullMoveNumber = 1
        self.whiteKingPosition = Position(rank: 0, file: 4)
        self.blackKingPosition = Position(rank: 7, file: 4)

        loadFEN(fen)
    }

    /// Get king position for a color in O(1)
    func kingPosition(for color: ChessColor) -> Position? {
        color == .white ? whiteKingPosition : blackKingPosition
    }

    mutating func loadFEN(_ fen: String) {
        let parts = fen.split(separator: " ")
        board.loadFEN(fen)

        // Part 1: Piece placement (handled by board.loadFEN)

        // Part 2: Active color
        if parts.count >= 2 {
            turn = parts[1] == "w" ? .white : .black
        }

        // Part 3: Castling availability
        if parts.count >= 3 {
            castlingRights = String(parts[2])
        }

        // Part 4: En passant target square
        if parts.count >= 4 {
            let epString = String(parts[3])
            if epString != "-" {
                enPassantTarget = Position.from(notation: epString)
            } else {
                enPassantTarget = nil
            }
        }

        // Part 5: Halfmove clock (for 50-move rule)
        if parts.count >= 5 {
            halfMoveClock = Int(String(parts[4])) ?? 0
        }

        // Part 6: Fullmove number
        if parts.count >= 6 {
            fullMoveNumber = Int(String(parts[5])) ?? 1
        }

        // Update cached king positions
        updateKingPositions()
    }

    mutating func updateKingPositions() {
        whiteKingPosition = nil
        blackKingPosition = nil

        for rank in 0..<8 {
            for file in 0..<8 {
                let pos = Position(rank: rank, file: file)
                if let piece = board.piece(at: pos), piece.type == .king {
                    if piece.color == .white {
                        whiteKingPosition = pos
                    } else {
                        blackKingPosition = pos
                    }
                }
            }
            // Early exit if both found
            if whiteKingPosition != nil && blackKingPosition != nil { break }
        }
    }
}
