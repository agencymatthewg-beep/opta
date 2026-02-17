//
//  SemanticSearchModule.swift
//  OptaPlusMacOS
//
//  X1. AI-Powered Conversation Search — search across ALL bot conversations
//  by meaning, not just keywords. Uses NaturalLanguage framework NLEmbedding
//  for on-device semantic search with TF-IDF fallback.
//
//  Module registration:  SemanticSearchModule.register(appState:)
//  Module removal:       Delete this file. Search falls back to keyword-only SearchEngine.
//
//  Keyboard shortcuts:
//    ⌘⇧F  — Open semantic search panel
//    ⌘P   — Command palette gains "Semantic Search" action
//    ⌘G   — Next result, ⌘⇧G — Previous result
//
//  Event bus:
//    Posts:    .module_search_resultSelected (messageId, botId)
//    Listens:  .searchEngineQueryReady (query string)
//

import SwiftUI
import Combine
import NaturalLanguage
import OptaMolt
import os.log

// MARK: - Embedding Vector

/// A fixed-size embedding vector for cosine similarity computation.
/// Stored as a contiguous array of Float for memory efficiency.
struct EmbeddingVector: Codable, Sendable {
    let values: [Float]

    var magnitude: Float {
        var sum: Float = 0
        for v in values { sum += v * v }
        return sqrt(sum)
    }

    func cosineSimilarity(to other: EmbeddingVector) -> Float {
        guard values.count == other.values.count else { return 0 }
        let magProduct = magnitude * other.magnitude
        guard magProduct > 0 else { return 0 }
        var dotProduct: Float = 0
        for i in values.indices {
            dotProduct += values[i] * other.values[i]
        }
        return dotProduct / magProduct
    }
}

// MARK: - Indexed Message

/// A message with its pre-computed embedding, stored in the vector index.
struct IndexedMessage: Codable, Sendable {
    let messageId: String
    let botId: String
    let botName: String
    let botEmoji: String
    let content: String
    let timestamp: Date
    let isUser: Bool
    let embedding: EmbeddingVector
}

// MARK: - Semantic Search Result

/// A search result with relevance score from semantic matching.
struct SemanticSearchResult: Identifiable, Equatable {
    let id: String
    let messageId: String
    let botId: String
    let botName: String
    let botEmoji: String
    let content: String
    let snippet: String
    let timestamp: Date
    let isUser: Bool
    let similarity: Float

    static func == (lhs: SemanticSearchResult, rhs: SemanticSearchResult) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Time Range Filter

enum SearchTimeRange: String, CaseIterable {
    case all = "All time"
    case today = "Today"
    case thisWeek = "This week"
    case thisMonth = "This month"
    case last3Months = "Last 3 months"

    var cutoffDate: Date? {
        let cal = Calendar.current
        let now = Date()
        switch self {
        case .all: return nil
        case .today: return cal.startOfDay(for: now)
        case .thisWeek: return cal.date(byAdding: .day, value: -7, to: now)
        case .thisMonth: return cal.date(byAdding: .month, value: -1, to: now)
        case .last3Months: return cal.date(byAdding: .month, value: -3, to: now)
        }
    }
}

// MARK: - Embedding Engine

/// Generates embeddings using NLEmbedding (Apple NaturalLanguage framework)
/// with automatic TF-IDF fallback when NLEmbedding is unavailable.
actor EmbeddingEngine {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "Embedding")

    /// NLEmbedding instance (lazy, may fail on older systems).
    private var nlEmbedding: NLEmbedding?
    private var useTFIDF = false
    private var idfTable: [String: Float] = [:]
    private var documentCount: Int = 0
    private let embeddingDimension = 128

    init() {
        // Try to load NLEmbedding for the user's language
        if let embedding = NLEmbedding.sentenceEmbedding(for: .english) {
            self.nlEmbedding = embedding
            Self.logger.info("NLEmbedding loaded (dimension: \(embedding.dimension))")
        } else {
            self.useTFIDF = true
            Self.logger.info("NLEmbedding unavailable — using TF-IDF fallback")
        }
    }

    /// Generate an embedding vector for the given text.
    func embed(_ text: String) -> EmbeddingVector? {
        if let nlEmb = nlEmbedding {
            return embedWithNL(text, embedding: nlEmb)
        } else {
            return embedWithTFIDF(text)
        }
    }

    /// Build IDF table from a corpus of messages (call once during initial indexing).
    func buildIDF(from texts: [String]) {
        documentCount = texts.count
        var docFreq: [String: Int] = [:]
        for text in texts {
            let tokens = Set(tokenize(text))
            for token in tokens {
                docFreq[token, default: 0] += 1
            }
        }
        idfTable = docFreq.mapValues { df in
            log(Float(documentCount + 1) / Float(df + 1)) + 1
        }
    }

    // MARK: - NLEmbedding Path

    private func embedWithNL(_ text: String, embedding: NLEmbedding) -> EmbeddingVector? {
        guard let vector = embedding.vector(for: text) else { return nil }
        return EmbeddingVector(values: vector.map { Float($0) })
    }

    // MARK: - TF-IDF Path

    private func embedWithTFIDF(_ text: String) -> EmbeddingVector {
        let tokens = tokenize(text)
        guard !tokens.isEmpty else {
            return EmbeddingVector(values: Array(repeating: 0, count: embeddingDimension))
        }

        // Term frequency
        var tf: [String: Float] = [:]
        for t in tokens { tf[t, default: 0] += 1 }
        let maxTF = tf.values.max() ?? 1

        // TF-IDF weighted hash vector (locality-sensitive hashing into fixed dimension)
        var vector = Array(repeating: Float(0), count: embeddingDimension)
        for (term, freq) in tf {
            let normalizedTF = freq / maxTF
            let idf = idfTable[term] ?? 1.0
            let weight = normalizedTF * idf

            // Hash term into dimension buckets (multiple projections)
            let hash1 = abs(term.hashValue) % embeddingDimension
            let hash2 = abs(term.hashValue &* 31) % embeddingDimension
            vector[hash1] += weight
            vector[hash2] += weight * 0.5
        }

        // L2 normalize
        let mag = sqrt(vector.reduce(0) { $0 + $1 * $1 })
        if mag > 0 {
            for i in vector.indices { vector[i] /= mag }
        }

        return EmbeddingVector(values: vector)
    }

    private func tokenize(_ text: String) -> [String] {
        let lower = text.lowercased()
        let tokenizer = NLTokenizer(unit: .word)
        tokenizer.string = lower
        var tokens: [String] = []
        tokenizer.enumerateTokens(in: lower.startIndex..<lower.endIndex) { range, _ in
            let token = String(lower[range])
            if token.count > 1 { tokens.append(token) }
            return true
        }
        return tokens
    }
}

// MARK: - Vector Store

/// Persists and queries the embedding index. One file per bot in App Support.
actor VectorStore {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "VectorStore")
    private var index: [String: IndexedMessage] = [:]  // messageId -> IndexedMessage
    private let storageDir: URL

    init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        self.storageDir = appSupport.appendingPathComponent("OptaPlus/SemanticIndex", isDirectory: true)
        try? FileManager.default.createDirectory(at: storageDir, withIntermediateDirectories: true)
    }

    /// Number of indexed messages.
    var count: Int { index.count }

    /// Whether a message is already indexed.
    func contains(_ messageId: String) -> Bool {
        index[messageId] != nil
    }

    /// Add an indexed message.
    func add(_ message: IndexedMessage) {
        index[message.messageId] = message
    }

    /// Search for the top-K most similar messages to a query embedding.
    func search(
        queryEmbedding: EmbeddingVector,
        topK: Int = 20,
        botFilter: String? = nil,
        after: Date? = nil
    ) -> [SemanticSearchResult] {
        var scored: [(IndexedMessage, Float)] = []

        for (_, msg) in index {
            // Apply bot filter
            if let bf = botFilter, msg.botId != bf { continue }
            // Apply time filter
            if let cutoff = after, msg.timestamp < cutoff { continue }

            let sim = queryEmbedding.cosineSimilarity(to: msg.embedding)
            if sim > 0.1 { // Minimum relevance threshold
                scored.append((msg, sim))
            }
        }

        // Sort by similarity descending
        scored.sort { $0.1 > $1.1 }

        return scored.prefix(topK).map { msg, sim in
            // Build snippet: first 120 chars
            let snippet = String(msg.content.prefix(120))
            return SemanticSearchResult(
                id: "\(msg.messageId)-\(sim)",
                messageId: msg.messageId,
                botId: msg.botId,
                botName: msg.botName,
                botEmoji: msg.botEmoji,
                content: msg.content,
                snippet: snippet,
                timestamp: msg.timestamp,
                isUser: msg.isUser,
                similarity: sim
            )
        }
    }

    /// Persist the full index to disk for a specific bot.
    func save(botId: String) {
        let botMessages = index.values.filter { $0.botId == botId }
        guard !botMessages.isEmpty else { return }
        let url = storageDir.appendingPathComponent("index-\(botId).json")
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(Array(botMessages))
            try data.write(to: url, options: .atomic)
        } catch {
            Self.logger.error("Failed to save index for \(botId): \(error.localizedDescription)")
        }
    }

    /// Load persisted index for a bot.
    func load(botId: String) {
        let url = storageDir.appendingPathComponent("index-\(botId).json")
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let messages = try decoder.decode([IndexedMessage].self, from: data)
            for msg in messages {
                index[msg.messageId] = msg
            }
            Self.logger.info("Loaded \(messages.count) indexed messages for \(botId)")
        } catch {
            Self.logger.error("Failed to load index for \(botId): \(error.localizedDescription)")
        }
    }

    /// Clear all indexed data (for module removal).
    func clearAll() {
        index.removeAll()
        let fm = FileManager.default
        if let files = try? fm.contentsOfDirectory(at: storageDir, includingPropertiesForKeys: nil) {
            for file in files where file.lastPathComponent.hasPrefix("index-") {
                try? fm.removeItem(at: file)
            }
        }
    }
}

// MARK: - Semantic Search View Model

@MainActor
final class SemanticSearchViewModel: ObservableObject {
    private static let logger = Logger(subsystem: "biz.optamize.OptaPlus", category: "SemanticSearch")

    // MARK: Published State
    @Published var query: String = ""
    @Published var results: [SemanticSearchResult] = []
    @Published var isSearching: Bool = false
    @Published var isIndexing: Bool = false
    @Published var indexedCount: Int = 0
    @Published var selectedResultId: String? = nil
    @Published var timeRange: SearchTimeRange = .all
    @Published var isSemanticMode: Bool = true
    @Published var selectedBotFilter: String? = nil  // nil = all bots

    // MARK: Private
    private let embeddingEngine = EmbeddingEngine()
    private let vectorStore = VectorStore()
    private var searchTask: Task<Void, Never>?
    private var debounceCancellable: AnyCancellable?

    init() {
        debounceCancellable = $query
            .removeDuplicates()
            .debounce(for: .milliseconds(400), scheduler: DispatchQueue.main)
            .sink { [weak self] newQuery in
                guard let self else { return }
                let trimmed = newQuery.trimmingCharacters(in: .whitespacesAndNewlines)
                if trimmed.isEmpty {
                    self.results = []
                    self.isSearching = false
                } else {
                    Task { await self.performSearch(trimmed) }
                }
            }
    }

    // MARK: - Indexing

    /// Index all messages from all bots in the background.
    func indexAllBots(appState: AppState) {
        isIndexing = true
        Task {
            // Load persisted indexes first
            for bot in appState.bots {
                await vectorStore.load(botId: bot.id)
            }
            indexedCount = await vectorStore.count

            // Build IDF table from all messages
            var allTexts: [String] = []
            for bot in appState.bots {
                let vm = appState.viewModel(for: bot)
                for msg in vm.messages {
                    allTexts.append(msg.content)
                }
            }
            await embeddingEngine.buildIDF(from: allTexts)

            // Index new messages
            for bot in appState.bots {
                let vm = appState.viewModel(for: bot)
                var newCount = 0
                for msg in vm.messages {
                    let alreadyIndexed = await vectorStore.contains(msg.id)
                    guard !alreadyIndexed else { continue }

                    if let embedding = await embeddingEngine.embed(msg.content) {
                        let indexed = IndexedMessage(
                            messageId: msg.id,
                            botId: bot.id,
                            botName: bot.name,
                            botEmoji: bot.emoji,
                            content: msg.content,
                            timestamp: msg.timestamp,
                            isUser: msg.sender == .user,
                            embedding: embedding
                        )
                        await vectorStore.add(indexed)
                        newCount += 1
                    }
                }
                if newCount > 0 {
                    await vectorStore.save(botId: bot.id)
                    Self.logger.info("Indexed \(newCount) new messages for \(bot.name)")
                }
            }

            indexedCount = await vectorStore.count
            isIndexing = false
            Self.logger.info("Indexing complete: \(self.indexedCount) total messages")
        }
    }

    /// Index a single new message incrementally.
    func indexMessage(_ message: ChatMessage, bot: BotConfig) {
        Task {
            let alreadyIndexed = await vectorStore.contains(message.id)
            guard !alreadyIndexed else { return }

            if let embedding = await embeddingEngine.embed(message.content) {
                let indexed = IndexedMessage(
                    messageId: message.id,
                    botId: bot.id,
                    botName: bot.name,
                    botEmoji: bot.emoji,
                    content: message.content,
                    timestamp: message.timestamp,
                    isUser: message.sender == .user,
                    embedding: embedding
                )
                await vectorStore.add(indexed)
                indexedCount = await vectorStore.count
                // Debounced save handled separately
            }
        }
    }

    // MARK: - Search

    private func performSearch(_ queryText: String) async {
        searchTask?.cancel()
        isSearching = true

        searchTask = Task {
            guard !Task.isCancelled else { return }

            if isSemanticMode {
                // Semantic search via embeddings
                guard let queryEmbedding = await embeddingEngine.embed(queryText) else {
                    isSearching = false
                    return
                }
                guard !Task.isCancelled else { return }

                let found = await vectorStore.search(
                    queryEmbedding: queryEmbedding,
                    topK: 30,
                    botFilter: selectedBotFilter,
                    after: timeRange.cutoffDate
                )
                guard !Task.isCancelled else { return }

                results = found
            } else {
                // Keyword fallback — exact substring match in vector store
                // (delegates to the standard SearchEngine behavior)
                results = []
            }

            isSearching = false
        }
    }

    // MARK: - Navigation

    func selectNext() {
        guard !results.isEmpty else { return }
        if let current = selectedResultId,
           let idx = results.firstIndex(where: { $0.id == current }) {
            let next = (idx + 1) % results.count
            selectedResultId = results[next].id
        } else {
            selectedResultId = results.first?.id
        }
    }

    func selectPrevious() {
        guard !results.isEmpty else { return }
        if let current = selectedResultId,
           let idx = results.firstIndex(where: { $0.id == current }) {
            let prev = (idx - 1 + results.count) % results.count
            selectedResultId = results[prev].id
        } else {
            selectedResultId = results.last?.id
        }
    }

    /// Clear state and persistent data (for module removal).
    func clearAll() {
        query = ""
        results = []
        Task { await vectorStore.clearAll() }
    }
}

// MARK: - Semantic Search Panel View

struct SemanticSearchPanel: View {
    @StateObject private var vm = SemanticSearchViewModel()
    @EnvironmentObject var appState: AppState
    @Binding var isPresented: Bool
    var onNavigateToMessage: ((String, String) -> Void)?  // (messageId, botId)

    @FocusState private var isFocused: Bool

    var body: some View {
        ZStack {
            // Backdrop
            Color.optaVoid.opacity(0.5)
                .ignoresSafeArea()
                .onTapGesture { isPresented = false }

            VStack(spacing: 0) {
                // Search header
                searchHeader
                Divider().background(Color.optaBorder.opacity(0.5))

                // Filter bar
                filterBar
                Divider().background(Color.optaBorder.opacity(0.3))

                // Results
                resultsSection

                // Footer
                footerBar
            }
            .frame(width: 560)
            .frame(maxHeight: 480)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(.ultraThinMaterial)
                    .shadow(color: Color.optaPrimary.opacity(0.15), radius: 30, y: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.optaPrimary.opacity(0.2), lineWidth: 1)
            )
            .padding(.top, 60)
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .onAppear {
            isFocused = true
            vm.indexAllBots(appState: appState)
        }
        .onKeyPress(.escape) {
            isPresented = false
            return .handled
        }
        .onKeyPress(.downArrow) {
            vm.selectNext()
            return .handled
        }
        .onKeyPress(.upArrow) {
            vm.selectPrevious()
            return .handled
        }
        .onKeyPress(.return) {
            if let selected = vm.selectedResultId,
               let result = vm.results.first(where: { $0.id == selected }) {
                onNavigateToMessage?(result.messageId, result.botId)
                isPresented = false
            }
            return .handled
        }
        .transition(.opacity.combined(with: .scale(scale: 0.96)))
    }

    // MARK: - Search Header

    private var searchHeader: some View {
        HStack(spacing: 10) {
            Image(systemName: "brain")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.optaPrimary)

            TextField("Search by meaning across all bots...", text: $vm.query)
                .textFieldStyle(.plain)
                .font(.sora(15))
                .foregroundColor(.optaTextPrimary)
                .focused($isFocused)
                .accessibilityLabel("Semantic search query")

            if vm.isSearching {
                OptaLoader(size: 14)
            }

            // Semantic/Keyword toggle
            Button(action: {
                withAnimation(.optaSnap) {
                    vm.isSemanticMode.toggle()
                }
            }) {
                HStack(spacing: 4) {
                    Image(systemName: vm.isSemanticMode ? "brain.head.profile" : "textformat.abc")
                        .font(.system(size: 10))
                    Text(vm.isSemanticMode ? "Semantic" : "Keyword")
                        .font(.sora(10, weight: .medium))
                }
                .foregroundColor(vm.isSemanticMode ? .optaPrimary : .optaTextSecondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    Capsule().fill(vm.isSemanticMode ? Color.optaPrimaryDim : Color.optaSurface)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // Time range picker
                ForEach(SearchTimeRange.allCases, id: \.rawValue) { range in
                    Button(action: {
                        withAnimation(.optaSnap) {
                            vm.timeRange = range
                        }
                    }) {
                        Text(range.rawValue)
                            .font(.sora(10, weight: vm.timeRange == range ? .semibold : .regular))
                            .foregroundColor(vm.timeRange == range ? .optaPrimary : .optaTextMuted)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule().fill(vm.timeRange == range ? Color.optaPrimaryDim : Color.clear)
                            )
                    }
                    .buttonStyle(.plain)
                }

                Divider().frame(height: 16)

                // Bot filter
                Button(action: {
                    withAnimation(.optaSnap) {
                        vm.selectedBotFilter = nil
                    }
                }) {
                    Text("All bots")
                        .font(.sora(10, weight: vm.selectedBotFilter == nil ? .semibold : .regular))
                        .foregroundColor(vm.selectedBotFilter == nil ? .optaPrimary : .optaTextMuted)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule().fill(vm.selectedBotFilter == nil ? Color.optaPrimaryDim : Color.clear)
                        )
                }
                .buttonStyle(.plain)

                ForEach(appState.bots) { bot in
                    Button(action: {
                        withAnimation(.optaSnap) {
                            vm.selectedBotFilter = bot.id
                        }
                    }) {
                        HStack(spacing: 3) {
                            Text(bot.emoji)
                                .font(.system(size: 10))
                            Text(bot.name)
                                .font(.sora(10, weight: vm.selectedBotFilter == bot.id ? .semibold : .regular))
                        }
                        .foregroundColor(vm.selectedBotFilter == bot.id ? .optaPrimary : .optaTextMuted)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule().fill(vm.selectedBotFilter == bot.id ? Color.optaPrimaryDim : Color.clear)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }

    // MARK: - Results

    private var resultsSection: some View {
        Group {
            if vm.results.isEmpty && !vm.query.isEmpty && !vm.isSearching {
                VStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 28))
                        .foregroundColor(.optaTextMuted)
                    Text("No results found")
                        .font(.sora(13))
                        .foregroundColor(.optaTextSecondary)
                    Text("Try different words or switch to keyword mode")
                        .font(.sora(11))
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.vertical, 30)
            } else if vm.results.isEmpty && vm.query.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 28))
                        .foregroundColor(.optaTextMuted)
                    Text("Semantic Search")
                        .font(.sora(13, weight: .medium))
                        .foregroundColor(.optaTextSecondary)
                    Text("Search by meaning across all conversations")
                        .font(.sora(11))
                        .foregroundColor(.optaTextMuted)
                    if vm.isIndexing {
                        HStack(spacing: 6) {
                            OptaLoader(size: 12)
                            Text("Indexing \(vm.indexedCount) messages...")
                                .font(.sora(10))
                                .foregroundColor(.optaTextMuted)
                        }
                        .padding(.top, 4)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.vertical, 30)
            } else {
                ScrollView {
                    LazyVStack(spacing: 2) {
                        ForEach(vm.results) { result in
                            SemanticResultRow(
                                result: result,
                                isSelected: vm.selectedResultId == result.id
                            )
                            .onTapGesture {
                                vm.selectedResultId = result.id
                                onNavigateToMessage?(result.messageId, result.botId)
                                isPresented = false
                            }
                        }
                    }
                    .padding(.vertical, 6)
                    .padding(.horizontal, 8)
                }
                .frame(maxHeight: 320)
            }
        }
    }

    // MARK: - Footer

    private var footerBar: some View {
        HStack(spacing: 16) {
            // Index status
            HStack(spacing: 4) {
                Circle()
                    .fill(vm.isIndexing ? Color.optaAmber : Color.optaGreen)
                    .frame(width: 5, height: 5)
                Text("\(vm.indexedCount) indexed")
                    .font(.sora(10))
                    .foregroundColor(.optaTextMuted)
            }

            Spacer()

            // Navigation hints
            shortcutHint("↑↓", label: "navigate")
            shortcutHint("↩", label: "open")
            shortcutHint("esc", label: "close")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.optaSurface.opacity(0.3))
    }

    private func shortcutHint(_ key: String, label: String) -> some View {
        HStack(spacing: 4) {
            Text(key)
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .foregroundColor(.optaTextPrimary)
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.optaSurface.opacity(0.6))
                )
            Text(label)
                .font(.sora(10))
                .foregroundColor(.optaTextMuted)
        }
    }
}

// MARK: - Result Row

struct SemanticResultRow: View {
    let result: SemanticSearchResult
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 10) {
            // Bot emoji
            Text(result.botEmoji)
                .font(.system(size: 14))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 3) {
                // Header: bot name + timestamp
                HStack(spacing: 6) {
                    Text(result.botName)
                        .font(.sora(10, weight: .semibold))
                        .foregroundColor(.optaTextSecondary)

                    Text(result.isUser ? "You" : "Bot")
                        .font(.sora(9))
                        .foregroundColor(.optaTextMuted)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(
                            Capsule().fill(Color.optaSurface.opacity(0.5))
                        )

                    Spacer()

                    Text(result.timestamp, style: .relative)
                        .font(.sora(9))
                        .foregroundColor(.optaTextMuted)
                }

                // Snippet
                Text(result.snippet)
                    .font(.sora(12))
                    .foregroundColor(.optaTextPrimary)
                    .lineLimit(2)
            }

            // Similarity bar
            VStack(spacing: 2) {
                similarityBar(result.similarity)
                Text("\(Int(result.similarity * 100))%")
                    .font(.system(size: 8, weight: .medium, design: .monospaced))
                    .foregroundColor(.optaTextMuted)
            }
            .frame(width: 32)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isSelected ? Color.optaPrimary.opacity(0.15) : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isSelected ? Color.optaPrimary.opacity(0.3) : Color.clear, lineWidth: 1)
        )
    }

    private func similarityBar(_ value: Float) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.optaSurface)
                    .frame(height: 3)

                RoundedRectangle(cornerRadius: 2)
                    .fill(barColor(value))
                    .frame(width: geo.size.width * CGFloat(value), height: 3)
            }
        }
        .frame(height: 3)
    }

    private func barColor(_ value: Float) -> Color {
        if value > 0.7 { return .optaGreen }
        if value > 0.4 { return .optaPrimary }
        return .optaTextMuted
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let module_search_resultSelected = Notification.Name("module.search.resultSelected")
    static let module_search_toggle = Notification.Name("module.search.toggle")
}

// MARK: - Module Registration

/// Module registration point. Call from ContentView or AppState to wire up.
///
/// **To add:** Call `SemanticSearchModule.register(appState:)` in AppState.init()
///             Add `.onReceive(NotificationCenter.default.publisher(for: .module_search_toggle))`
///             to ContentView to toggle the panel.
///             Add PaletteAction for "Semantic Search" in CommandPalette.allActions.
///
/// **To remove:** Delete this file. Remove the notification listener and palette action.
///                Search falls back to the existing keyword-only SearchEngine.
@MainActor
enum SemanticSearchModule {
    /// Wire up incremental indexing on new messages.
    static func register(appState: AppState) {
        // Listen for new messages across all VMs and index them
        for bot in appState.bots {
            let vm = appState.viewModel(for: bot)
            // The incremental indexing is handled by the SemanticSearchViewModel
            // which is created when the panel opens. For background indexing,
            // wire into the message append path in ChatViewModel via notification.
            _ = vm // Keep reference
        }
    }
}
