//
//  PuzzleService.swift
//  OptaNative
//
//  Service for loading, filtering, and tracking chess puzzles.
//  Puzzles sourced from Lichess database.
//  Created for Opta Native macOS - Phase 100
//

import Foundation

// MARK: - Puzzle Service Error

enum PuzzleServiceError: Error, LocalizedError {
    case noPuzzlesLoaded
    case puzzleNotFound
    case invalidPuzzleData
    case fileNotFound

    var errorDescription: String? {
        switch self {
        case .noPuzzlesLoaded: return "No puzzles have been loaded"
        case .puzzleNotFound: return "Puzzle not found"
        case .invalidPuzzleData: return "Invalid puzzle data"
        case .fileNotFound: return "Puzzle database file not found"
        }
    }
}

// MARK: - Puzzle Service

actor PuzzleService {
    static let shared = PuzzleService()

    // MARK: - State

    private var allPuzzles: [ChessPuzzle] = []
    private var puzzlesByRating: [Int: [ChessPuzzle]] = [:]  // Rating bucket -> puzzles
    private var puzzlesByTheme: [String: [ChessPuzzle]] = [:]
    private var completedPuzzleIds: Set<String> = []
    private var userStats: UserPuzzleStats = UserPuzzleStats()

    private let ratingBucketSize = 100  // Group puzzles in 100-point buckets

    private init() {}

    // MARK: - Loading

    /// Load puzzles from bundled JSON file
    func loadPuzzles() async throws {
        // Try bundle first
        if let url = Bundle.main.url(forResource: "puzzles", withExtension: "json") {
            try await loadFromURL(url)
            return
        }

        // Try documents directory
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        if let puzzlePath = documentsPath?.appendingPathComponent("puzzles.json"),
           FileManager.default.fileExists(atPath: puzzlePath.path) {
            try await loadFromURL(puzzlePath)
            return
        }

        // Load built-in sample puzzles
        await loadSamplePuzzles()
    }

    private func loadFromURL(_ url: URL) async throws {
        let data = try Data(contentsOf: url)
        let puzzles = try JSONDecoder().decode([ChessPuzzle].self, from: data)
        await indexPuzzles(puzzles)
        print("PuzzleService: Loaded \(puzzles.count) puzzles from \(url.lastPathComponent)")
    }

    private func indexPuzzles(_ puzzles: [ChessPuzzle]) async {
        allPuzzles = puzzles

        // Index by rating bucket
        puzzlesByRating = [:]
        for puzzle in puzzles {
            let bucket = (puzzle.rating / ratingBucketSize) * ratingBucketSize
            puzzlesByRating[bucket, default: []].append(puzzle)
        }

        // Index by theme
        puzzlesByTheme = [:]
        for puzzle in puzzles {
            for theme in puzzle.themes {
                puzzlesByTheme[theme, default: []].append(puzzle)
            }
        }
    }

    /// Load sample puzzles if no database is available
    private func loadSamplePuzzles() async {
        let samples: [ChessPuzzle] = [
            // Mate in 1 - Back rank
            ChessPuzzle(
                id: "sample001",
                fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
                moves: ["e1e8"],
                rating: 800,
                themes: ["mate", "mateIn1", "backRankMate"]
            ),
            // Simple fork
            ChessPuzzle(
                id: "sample002",
                fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
                moves: ["h5f7"],
                rating: 900,
                themes: ["mate", "mateIn1", "fork"]
            ),
            // Knight fork
            ChessPuzzle(
                id: "sample003",
                fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
                moves: ["f3e5", "c6e5", "d1h5", "g7g6", "h5e5"],
                rating: 1100,
                themes: ["fork", "middlegame", "short"]
            ),
            // Pin
            ChessPuzzle(
                id: "sample004",
                fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5",
                moves: ["c1g5"],
                rating: 1000,
                themes: ["pin", "opening", "oneMove"]
            ),
            // Discovered attack
            ChessPuzzle(
                id: "sample005",
                fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
                moves: ["f1b5"],
                rating: 950,
                themes: ["opening", "pin", "advantage"]
            ),
            // Smothered mate
            ChessPuzzle(
                id: "sample006",
                fen: "r5rk/pp4pp/3p4/2pN1Q2/4n3/8/PPP2qPP/2KR3R b - - 0 1",
                moves: ["f2c2", "d1c1", "c2c1", "d5f6", "g7f6", "f5f6"],
                rating: 1400,
                themes: ["smotheredMate", "sacrifice", "long"]
            ),
            // Double bishop mate
            ChessPuzzle(
                id: "sample007",
                fen: "r1b2r1k/ppp3pp/2n5/3Bp3/2B5/8/PPP2PPP/R3K2R w KQ - 0 1",
                moves: ["d5f7"],
                rating: 1200,
                themes: ["mate", "mateIn1", "doubleBishopMate"]
            ),
            // Promotion
            ChessPuzzle(
                id: "sample008",
                fen: "8/P7/8/8/8/8/8/k1K5 w - - 0 1",
                moves: ["a7a8q"],
                rating: 700,
                themes: ["promotion", "endgame", "pawnEndgame", "oneMove"]
            ),
            // Under-promotion
            ChessPuzzle(
                id: "sample009",
                fen: "8/1P6/8/8/8/2k5/8/K7 w - - 0 1",
                moves: ["b7b8n"],
                rating: 1300,
                themes: ["underPromotion", "endgame", "pawnEndgame"]
            ),
            // En passant
            ChessPuzzle(
                id: "sample010",
                fen: "8/8/8/1Pp5/8/8/8/4K2k w - c6 0 1",
                moves: ["b5c6"],
                rating: 850,
                themes: ["enPassant", "endgame", "pawnEndgame"]
            )
        ]

        await indexPuzzles(samples)
        print("PuzzleService: Loaded \(samples.count) sample puzzles")
    }

    // MARK: - Puzzle Selection

    /// Get a random puzzle within rating range
    func getPuzzle(rating: Int, range: Int = 200) async -> ChessPuzzle? {
        let minRating = rating - range
        let maxRating = rating + range

        let candidates = allPuzzles.filter { puzzle in
            puzzle.rating >= minRating &&
            puzzle.rating <= maxRating &&
            !completedPuzzleIds.contains(puzzle.id)
        }

        return candidates.randomElement() ?? allPuzzles.filter { !completedPuzzleIds.contains($0.id) }.randomElement()
    }

    /// Get puzzles by theme
    func getPuzzles(theme: String, rating: Int? = nil, limit: Int = 10) async -> [ChessPuzzle] {
        var candidates = puzzlesByTheme[theme] ?? []

        // Filter by rating if specified
        if let rating = rating {
            candidates = candidates.filter { abs($0.rating - rating) <= 300 }
        }

        // Exclude completed
        candidates = candidates.filter { !completedPuzzleIds.contains($0.id) }

        // Shuffle and limit
        return Array(candidates.shuffled().prefix(limit))
    }

    /// Get next puzzle based on user performance
    func getNextPuzzle() async -> ChessPuzzle? {
        // Adjust target rating based on recent performance
        var targetRating = userStats.rating

        // If on a streak, increase difficulty slightly
        if userStats.currentStreak >= 3 {
            targetRating += 50 * min(userStats.currentStreak - 2, 3)
        }

        return await getPuzzle(rating: targetRating)
    }

    /// Get a puzzle by ID
    func getPuzzle(id: String) async -> ChessPuzzle? {
        return allPuzzles.first { $0.id == id }
    }

    // MARK: - Progress Tracking

    /// Record a puzzle attempt
    func recordAttempt(_ attempt: PuzzleAttempt) async {
        userStats.totalAttempted += 1

        if attempt.solved {
            userStats.totalSolved += 1
            userStats.currentStreak += 1
            userStats.bestStreak = max(userStats.bestStreak, userStats.currentStreak)
            completedPuzzleIds.insert(attempt.puzzleId)

            // Update rating (simple Elo-like)
            if let puzzle = allPuzzles.first(where: { $0.id == attempt.puzzleId }) {
                let expected = expectedScore(userRating: userStats.rating, puzzleRating: puzzle.rating)
                let kFactor = userStats.ratingDeviation > 200 ? 40 : 20
                userStats.rating += Int(Double(kFactor) * (1.0 - expected))
                userStats.ratingDeviation = max(50, userStats.ratingDeviation - 5)

                // Track theme performance
                for theme in puzzle.themes {
                    userStats.themePerformance[theme, default: ThemePerformance()].attempted += 1
                    userStats.themePerformance[theme, default: ThemePerformance()].solved += 1
                }
            }
        } else {
            userStats.currentStreak = 0

            // Update rating on failure
            if let puzzle = allPuzzles.first(where: { $0.id == attempt.puzzleId }) {
                let expected = expectedScore(userRating: userStats.rating, puzzleRating: puzzle.rating)
                let kFactor = userStats.ratingDeviation > 200 ? 40 : 20
                userStats.rating += Int(Double(kFactor) * (0.0 - expected))
                userStats.rating = max(500, userStats.rating)  // Floor at 500

                // Track theme performance
                for theme in puzzle.themes {
                    userStats.themePerformance[theme, default: ThemePerformance()].attempted += 1
                }
            }
        }

        // Update average time
        let totalTime = userStats.averageTime * Double(userStats.totalAttempted - 1) + attempt.timeSpent
        userStats.averageTime = totalTime / Double(userStats.totalAttempted)

        // Persist stats
        await saveStats()
    }

    private func expectedScore(userRating: Int, puzzleRating: Int) -> Double {
        let diff = Double(puzzleRating - userRating)
        return 1.0 / (1.0 + pow(10.0, diff / 400.0))
    }

    // MARK: - Stats

    /// Get current user stats
    func getStats() async -> UserPuzzleStats {
        return userStats
    }

    /// Get stats for a specific theme
    func getThemeStats(_ theme: String) async -> ThemePerformance {
        return userStats.themePerformance[theme] ?? ThemePerformance()
    }

    /// Reset progress (for testing)
    func resetProgress() async {
        completedPuzzleIds.removeAll()
        userStats = UserPuzzleStats()
        await saveStats()
    }

    // MARK: - Persistence

    private func saveStats() async {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(userStats) {
            UserDefaults.standard.set(data, forKey: "puzzleStats")
        }

        // Save completed puzzles
        UserDefaults.standard.set(Array(completedPuzzleIds), forKey: "completedPuzzles")
    }

    func loadSavedProgress() async {
        // Load stats
        if let data = UserDefaults.standard.data(forKey: "puzzleStats"),
           let stats = try? JSONDecoder().decode(UserPuzzleStats.self, from: data) {
            userStats = stats
        }

        // Load completed puzzles
        if let completed = UserDefaults.standard.stringArray(forKey: "completedPuzzles") {
            completedPuzzleIds = Set(completed)
        }
    }

    // MARK: - UCI Conversion

    /// Convert UCI move notation to ChessMove
    func uciToMove(_ uci: String, in state: ChessState) -> ChessMove? {
        guard uci.count >= 4 else { return nil }

        let fromFile = fileIndex(from: uci[uci.startIndex])
        let fromRank = Int(String(uci[uci.index(uci.startIndex, offsetBy: 1)])) ?? 0
        let toFile = fileIndex(from: uci[uci.index(uci.startIndex, offsetBy: 2)])
        let toRank = Int(String(uci[uci.index(uci.startIndex, offsetBy: 3)])) ?? 0

        guard let ff = fromFile, let tf = toFile else { return nil }

        let from = Position(rank: fromRank - 1, file: ff)
        let to = Position(rank: toRank - 1, file: tf)

        // Check for promotion
        var promotion: ChessPieceType?
        if uci.count == 5 {
            let promoChar = uci[uci.index(uci.startIndex, offsetBy: 4)]
            promotion = pieceType(from: promoChar)
        }

        // Check for castling
        let piece = state.board.piece(at: from)
        let isCastling = piece?.type == .king && abs(to.file - from.file) == 2

        // Check for en passant
        let isEnPassant = piece?.type == .pawn &&
                          from.file != to.file &&
                          state.board.piece(at: to) == nil

        return ChessMove(
            from: from,
            to: to,
            promotion: promotion,
            isCastling: isCastling,
            isEnPassant: isEnPassant
        )
    }

    /// Convert ChessMove to UCI notation
    func moveToUCI(_ move: ChessMove) -> String {
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

    private func fileIndex(from char: Character) -> Int? {
        guard let asciiValue = char.asciiValue else { return nil }
        let index = Int(asciiValue) - Int(Character("a").asciiValue!)
        return index >= 0 && index < 8 ? index : nil
    }

    private func pieceType(from char: Character) -> ChessPieceType? {
        switch char.lowercased() {
        case "q": return .queen
        case "r": return .rook
        case "b": return .bishop
        case "n": return .knight
        default: return nil
        }
    }

    // MARK: - Statistics

    var puzzleCount: Int {
        allPuzzles.count
    }

    var availableThemes: [String] {
        Array(puzzlesByTheme.keys).sorted()
    }
}
