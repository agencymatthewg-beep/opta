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

struct ChessPiece: Identifiable, Equatable, Sendable {
    let id = UUID()
    let color: ChessColor
    let type: ChessPieceType
    
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

struct ChessMove: Equatable, Sendable {
    let from: Position
    let to: Position
    let promotion: ChessPieceType?
}

struct Position: Equatable, Hashable, Sendable {
    let rank: Int // 0-7 (0 is rank 1, 7 is rank 8)
    let file: Int // 0-7 (0 is a, 7 is h)
    
    static func from(index: Int) -> Position {
        return Position(rank: 7 - (index / 8), file: index % 8)
    }
    
    func toIndex() -> Int {
        return (7 - rank) * 8 + file
    }
    
    /// Returns algebraic notation (e.g. "e4")
    var notation: String {
        let files = ["a", "b", "c", "d", "e", "f", "g", "h"]
        return "\(files[file])\(rank + 1)"
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

struct ChessState: Sendable {
    var board: ChessBoard
    var turn: ChessColor
    var castlingRights: String // "KQkq", "-"
    var enPassantTarget: Position?
    var halfMoveClock: Int
    var fullMoveNumber: Int
    
    static let startingFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    
    init(fen: String = ChessState.startingFEN) {
        self.board = ChessBoard()
        self.turn = .white
        self.castlingRights = "-"
        self.halfMoveClock = 0
        self.fullMoveNumber = 1
        
        loadFEN(fen)
    }
    
    mutating func loadFEN(_ fen: String) {
        let parts = fen.split(separator: " ")
        board.loadFEN(fen)
        
        if parts.count >= 2 {
            turn = parts[1] == "w" ? .white : .black
        }
        if parts.count >= 3 {
            castlingRights = String(parts[2])
        }
    }
}
