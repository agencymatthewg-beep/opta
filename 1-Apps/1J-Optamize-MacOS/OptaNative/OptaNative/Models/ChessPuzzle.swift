//
//  ChessPuzzle.swift
//  OptaNative
//
//  Model for chess puzzles sourced from Lichess database.
//  Created for Opta Native macOS - Phase 100
//

import Foundation

// MARK: - Chess Puzzle

struct ChessPuzzle: Identifiable, Codable, Sendable, Hashable {
    let id: String
    let fen: String
    let moves: [String]  // UCI notation: e2e4, g1f3, etc.
    let rating: Int
    let ratingDeviation: Int
    let popularity: Int
    let nbPlays: Int
    let themes: [String]
    let gameUrl: String?
    let openingTags: [String]?

    enum CodingKeys: String, CodingKey {
        case id = "PuzzleId"
        case fen = "FEN"
        case moves = "Moves"
        case rating = "Rating"
        case ratingDeviation = "RatingDeviation"
        case popularity = "Popularity"
        case nbPlays = "NbPlays"
        case themes = "Themes"
        case gameUrl = "GameUrl"
        case openingTags = "OpeningTags"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        fen = try container.decode(String.self, forKey: .fen)

        // Moves can be a string (space-separated) or array
        if let movesString = try? container.decode(String.self, forKey: .moves) {
            moves = movesString.split(separator: " ").map(String.init)
        } else {
            moves = try container.decode([String].self, forKey: .moves)
        }

        rating = try container.decode(Int.self, forKey: .rating)
        ratingDeviation = try container.decodeIfPresent(Int.self, forKey: .ratingDeviation) ?? 75
        popularity = try container.decodeIfPresent(Int.self, forKey: .popularity) ?? 50
        nbPlays = try container.decodeIfPresent(Int.self, forKey: .nbPlays) ?? 0

        // Themes can be a string (space-separated) or array
        if let themesString = try? container.decode(String.self, forKey: .themes) {
            themes = themesString.split(separator: " ").map(String.init)
        } else {
            themes = try container.decodeIfPresent([String].self, forKey: .themes) ?? []
        }

        gameUrl = try container.decodeIfPresent(String.self, forKey: .gameUrl)

        if let tagsString = try? container.decode(String.self, forKey: .openingTags) {
            openingTags = tagsString.split(separator: " ").map(String.init)
        } else {
            openingTags = try container.decodeIfPresent([String].self, forKey: .openingTags)
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(fen, forKey: .fen)
        try container.encode(moves.joined(separator: " "), forKey: .moves)
        try container.encode(rating, forKey: .rating)
        try container.encode(ratingDeviation, forKey: .ratingDeviation)
        try container.encode(popularity, forKey: .popularity)
        try container.encode(nbPlays, forKey: .nbPlays)
        try container.encode(themes.joined(separator: " "), forKey: .themes)
        try container.encodeIfPresent(gameUrl, forKey: .gameUrl)
        try container.encodeIfPresent(openingTags?.joined(separator: " "), forKey: .openingTags)
    }

    // Manual initializer for creating puzzles programmatically
    init(
        id: String,
        fen: String,
        moves: [String],
        rating: Int,
        ratingDeviation: Int = 75,
        popularity: Int = 50,
        nbPlays: Int = 0,
        themes: [String] = [],
        gameUrl: String? = nil,
        openingTags: [String]? = nil
    ) {
        self.id = id
        self.fen = fen
        self.moves = moves
        self.rating = rating
        self.ratingDeviation = ratingDeviation
        self.popularity = popularity
        self.nbPlays = nbPlays
        self.themes = themes
        self.gameUrl = gameUrl
        self.openingTags = openingTags
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: ChessPuzzle, rhs: ChessPuzzle) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Puzzle Theme

enum PuzzleTheme: String, CaseIterable, Codable, Sendable {
    // Tactical themes
    case fork
    case pin
    case skewer
    case discoveredAttack
    case doubleCheck
    case sacrifice
    case deflection
    case decoy
    case interference
    case clearance
    case xRayAttack
    case zugzwang

    // Checkmate themes
    case mate
    case mateIn1
    case mateIn2
    case mateIn3
    case mateIn4
    case mateIn5
    case anastasiaMate
    case arabianMate
    case backRankMate
    case bodenMate
    case doubleBishopMate
    case dovetailMate
    case hookMate
    case smotheredMate

    // Game phase
    case opening
    case middlegame
    case endgame
    case rookEndgame
    case bishopEndgame
    case pawnEndgame
    case knightEndgame
    case queenEndgame
    case queenRookEndgame

    // Length
    case oneMove
    case short
    case long
    case veryLong

    // Other
    case crushing
    case advantage
    case equality
    case defensiveMove
    case attackingF2F7
    case capturingDefender
    case castling
    case enPassant
    case exposedKing
    case hangingPiece
    case kingsideAttack
    case queensideAttack
    case promotion
    case underPromotion
    case quietMove
    case trappedPiece

    var displayName: String {
        switch self {
        case .fork: return "Fork"
        case .pin: return "Pin"
        case .skewer: return "Skewer"
        case .discoveredAttack: return "Discovered Attack"
        case .doubleCheck: return "Double Check"
        case .sacrifice: return "Sacrifice"
        case .deflection: return "Deflection"
        case .decoy: return "Decoy"
        case .interference: return "Interference"
        case .clearance: return "Clearance"
        case .xRayAttack: return "X-Ray Attack"
        case .zugzwang: return "Zugzwang"
        case .mate: return "Checkmate"
        case .mateIn1: return "Mate in 1"
        case .mateIn2: return "Mate in 2"
        case .mateIn3: return "Mate in 3"
        case .mateIn4: return "Mate in 4"
        case .mateIn5: return "Mate in 5"
        case .anastasiaMate: return "Anastasia's Mate"
        case .arabianMate: return "Arabian Mate"
        case .backRankMate: return "Back Rank Mate"
        case .bodenMate: return "Boden's Mate"
        case .doubleBishopMate: return "Double Bishop Mate"
        case .dovetailMate: return "Dovetail Mate"
        case .hookMate: return "Hook Mate"
        case .smotheredMate: return "Smothered Mate"
        case .opening: return "Opening"
        case .middlegame: return "Middlegame"
        case .endgame: return "Endgame"
        case .rookEndgame: return "Rook Endgame"
        case .bishopEndgame: return "Bishop Endgame"
        case .pawnEndgame: return "Pawn Endgame"
        case .knightEndgame: return "Knight Endgame"
        case .queenEndgame: return "Queen Endgame"
        case .queenRookEndgame: return "Queen + Rook Endgame"
        case .oneMove: return "One Move"
        case .short: return "Short (2-3 moves)"
        case .long: return "Long (4+ moves)"
        case .veryLong: return "Very Long (6+ moves)"
        case .crushing: return "Crushing"
        case .advantage: return "Advantage"
        case .equality: return "Equality"
        case .defensiveMove: return "Defensive Move"
        case .attackingF2F7: return "Attacking f2/f7"
        case .capturingDefender: return "Capturing Defender"
        case .castling: return "Castling"
        case .enPassant: return "En Passant"
        case .exposedKing: return "Exposed King"
        case .hangingPiece: return "Hanging Piece"
        case .kingsideAttack: return "Kingside Attack"
        case .queensideAttack: return "Queenside Attack"
        case .promotion: return "Promotion"
        case .underPromotion: return "Under-Promotion"
        case .quietMove: return "Quiet Move"
        case .trappedPiece: return "Trapped Piece"
        }
    }

    var icon: String {
        switch self {
        case .fork: return "arrow.triangle.branch"
        case .pin: return "pin.fill"
        case .skewer: return "arrow.left.arrow.right"
        case .sacrifice: return "flame.fill"
        case .mate, .mateIn1, .mateIn2, .mateIn3, .mateIn4, .mateIn5: return "crown.fill"
        case .backRankMate, .smotheredMate: return "crown.fill"
        case .endgame, .rookEndgame, .bishopEndgame, .pawnEndgame: return "flag.checkered"
        case .promotion, .underPromotion: return "arrow.up.circle.fill"
        default: return "puzzlepiece.fill"
        }
    }
}

// MARK: - Puzzle Attempt

struct PuzzleAttempt: Codable, Sendable {
    let puzzleId: String
    let date: Date
    let solved: Bool
    let timeSpent: TimeInterval
    let movesPlayed: Int
    let hintsUsed: Int
}

// MARK: - User Puzzle Stats

struct UserPuzzleStats: Codable, Sendable {
    var rating: Int = 1500
    var ratingDeviation: Int = 350
    var totalSolved: Int = 0
    var totalAttempted: Int = 0
    var currentStreak: Int = 0
    var bestStreak: Int = 0
    var averageTime: TimeInterval = 0
    var themePerformance: [String: ThemePerformance] = [:]

    var successRate: Double {
        totalAttempted > 0 ? Double(totalSolved) / Double(totalAttempted) : 0
    }
}

struct ThemePerformance: Codable, Sendable {
    var attempted: Int = 0
    var solved: Int = 0
    var averageRating: Int = 1500

    var successRate: Double {
        attempted > 0 ? Double(solved) / Double(attempted) : 0
    }
}

// MARK: - Puzzle Move Result

enum PuzzleMoveResult: Sendable {
    case correct
    case incorrect
    case puzzleComplete
    case puzzleFailed

    var feedbackText: String {
        switch self {
        case .correct: return "Correct!"
        case .incorrect: return "That's not the best move"
        case .puzzleComplete: return "Puzzle Solved!"
        case .puzzleFailed: return "Puzzle Failed"
        }
    }
}
