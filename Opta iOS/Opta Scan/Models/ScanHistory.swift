//
//  ScanHistory.swift
//  Opta Scan
//
//  Core Data model and persistence for scan history
//  Created by Matthew Byrden
//

import CoreData
import SwiftUI

// MARK: - Persistence Controller

/// Manages Core Data stack and provides shared persistence container for scan history
final class PersistenceController {

    // MARK: - Shared Instance

    static let shared = PersistenceController()

    // MARK: - Properties

    let container: NSPersistentContainer

    // MARK: - Initialization

    /// Initialize the persistence controller
    /// - Parameter inMemory: If true, uses in-memory store (for previews/testing)
    init(inMemory: Bool = false) {
        container = NSPersistentContainer(name: "OptaScan")

        if inMemory {
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        }

        container.loadPersistentStores { _, error in
            if let error {
                print("[ScanHistory] Core Data failed to load: \(error.localizedDescription)")
            }
        }

        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }

    // MARK: - Preview Support

    /// Preview instance with sample data for SwiftUI previews
    static var preview: PersistenceController = {
        let controller = PersistenceController(inMemory: true)
        let context = controller.container.viewContext

        // Create sample data for previews
        let sampleCount = 5
        let secondsPerDay: TimeInterval = 86_400

        for index in 0..<sampleCount {
            let scan = ScanEntity(context: context)
            scan.id = UUID()
            scan.prompt = "Sample prompt \(index + 1)"
            scan.understanding = "Understanding of the scan"
            scan.resultMarkdown = "# Result\n\nThis is a sample result."
            scan.highlights = ["Highlight 1", "Highlight 2"]
            scan.createdAt = Date().addingTimeInterval(-Double(index) * secondsPerDay)
        }

        try? context.save()
        return controller
    }()

    // MARK: - Persistence Operations

    /// Save the view context if there are pending changes
    func save() {
        let context = container.viewContext
        guard context.hasChanges else { return }

        do {
            try context.save()
        } catch {
            print("[ScanHistory] Failed to save context: \(error.localizedDescription)")
        }
    }
}

// MARK: - Scan Entity

/// Core Data entity representing a single optimization scan
@objc(ScanEntity)
public class ScanEntity: NSManagedObject, Identifiable {

    // MARK: - Managed Properties

    @NSManaged public var id: UUID?
    @NSManaged public var prompt: String?
    @NSManaged public var imageData: Data?
    @NSManaged public var understanding: String?
    @NSManaged public var questionsJSON: String?
    @NSManaged public var answersJSON: String?
    @NSManaged public var resultMarkdown: String?
    @NSManaged public var highlightsData: Data?
    @NSManaged public var rankingsJSON: String?
    @NSManaged public var createdAt: Date?
    @NSManaged public var isFavorite: Bool

    // MARK: - Computed Properties

    /// Decoded highlights array from JSON data
    var highlights: [String] {
        get {
            guard let data = highlightsData else { return [] }
            return (try? JSONDecoder().decode([String].self, from: data)) ?? []
        }
        set {
            highlightsData = try? JSONEncoder().encode(newValue)
        }
    }

    /// Decoded rankings array from JSON string
    var rankings: [RankingItem]? {
        get {
            guard let json = rankingsJSON,
                  let data = json.data(using: .utf8) else { return nil }
            return try? JSONDecoder().decode([RankingItem].self, from: data)
        }
        set {
            guard let items = newValue,
                  let data = try? JSONEncoder().encode(items) else {
                rankingsJSON = nil
                return
            }
            rankingsJSON = String(data: data, encoding: .utf8)
        }
    }

    /// Decoded UIImage from stored JPEG data
    var image: UIImage? {
        get {
            guard let data = imageData else { return nil }
            return UIImage(data: data)
        }
        set {
            let jpegCompressionQuality: CGFloat = 0.8
            imageData = newValue?.jpegData(compressionQuality: jpegCompressionQuality)
        }
    }

    // MARK: - Fetch Request

    /// Default fetch request sorted by creation date (newest first)
    @nonobjc public class func fetchRequest() -> NSFetchRequest<ScanEntity> {
        let request = NSFetchRequest<ScanEntity>(entityName: "ScanEntity")
        request.sortDescriptors = [NSSortDescriptor(keyPath: \ScanEntity.createdAt, ascending: false)]
        return request
    }
}


// MARK: - History Manager

/// Observable manager for scan history with search and CRUD operations
@MainActor
final class HistoryManager: ObservableObject {

    // MARK: - Published Properties

    @Published var scans: [ScanEntity] = []
    @Published var searchText = ""

    // MARK: - Private Properties

    private let context: NSManagedObjectContext

    // MARK: - Initialization

    init(context: NSManagedObjectContext = PersistenceController.shared.container.viewContext) {
        self.context = context
        fetchScans()
    }

    // MARK: - Fetch Operations

    /// Fetch scans from Core Data, optionally filtered by search text
    func fetchScans() {
        let request = ScanEntity.fetchRequest()

        if !searchText.isEmpty {
            request.predicate = NSPredicate(
                format: "prompt CONTAINS[cd] %@ OR understanding CONTAINS[cd] %@",
                searchText, searchText
            )
        }

        do {
            scans = try context.fetch(request)
        } catch {
            print("[HistoryManager] Failed to fetch scans: \(error.localizedDescription)")
        }
    }

    // MARK: - Create Operations

    /// Save a new scan to Core Data
    /// - Parameters:
    ///   - prompt: The optimization prompt text
    ///   - image: Optional captured image
    ///   - understanding: Claude's understanding of the request
    ///   - result: The optimization result to persist
    func saveScan(
        prompt: String,
        image: UIImage?,
        understanding: String?,
        result: OptimizationResult
    ) {
        let scan = ScanEntity(context: context)
        scan.id = UUID()
        scan.prompt = prompt
        scan.image = image
        scan.understanding = understanding
        scan.resultMarkdown = result.markdown
        scan.highlights = result.highlights
        scan.rankings = result.rankings
        scan.createdAt = Date()

        PersistenceController.shared.save()
        fetchScans()
    }

    // MARK: - Update Operations

    /// Toggle the favorite status of a scan
    /// - Parameter scan: The scan entity to toggle
    func toggleFavorite(_ scan: ScanEntity) {
        scan.isFavorite.toggle()
        PersistenceController.shared.save()
        fetchScans()
    }

    /// Duplicate a scan with a new ID and timestamp
    /// - Parameter scan: The scan entity to duplicate
    func duplicateScan(_ scan: ScanEntity) {
        let duplicate = ScanEntity(context: context)
        duplicate.id = UUID()
        duplicate.prompt = scan.prompt
        duplicate.imageData = scan.imageData
        duplicate.understanding = scan.understanding
        duplicate.questionsJSON = scan.questionsJSON
        duplicate.answersJSON = scan.answersJSON
        duplicate.resultMarkdown = scan.resultMarkdown
        duplicate.highlightsData = scan.highlightsData
        duplicate.rankingsJSON = scan.rankingsJSON
        duplicate.createdAt = Date()
        duplicate.isFavorite = false

        PersistenceController.shared.save()
        fetchScans()
    }

    // MARK: - Delete Operations

    /// Delete a single scan
    /// - Parameter scan: The scan entity to delete
    func deleteScan(_ scan: ScanEntity) {
        context.delete(scan)
        PersistenceController.shared.save()
        fetchScans()
    }

    /// Delete scans at the specified index set
    /// - Parameter offsets: Index set of scans to delete
    func deleteScans(at offsets: IndexSet) {
        offsets.forEach { index in
            context.delete(scans[index])
        }
        PersistenceController.shared.save()
        fetchScans()
    }
}
