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

class PersistenceController {
    static let shared = PersistenceController()

    let container: NSPersistentContainer

    init(inMemory: Bool = false) {
        container = NSPersistentContainer(name: "OptaScan")

        if inMemory {
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        }

        container.loadPersistentStores { description, error in
            if let error = error {
                print("Core Data failed to load: \(error.localizedDescription)")
            }
        }

        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }

    // MARK: - Preview Support

    static var preview: PersistenceController = {
        let controller = PersistenceController(inMemory: true)
        let context = controller.container.viewContext

        // Create sample data
        for i in 0..<5 {
            let scan = ScanEntity(context: context)
            scan.id = UUID()
            scan.prompt = "Sample prompt \(i + 1)"
            scan.understanding = "Understanding of the scan"
            scan.resultMarkdown = "# Result\n\nThis is a sample result."
            scan.highlights = ["Highlight 1", "Highlight 2"]
            scan.createdAt = Date().addingTimeInterval(Double(-i * 86400))
        }

        try? context.save()
        return controller
    }()

    // MARK: - Save Context

    func save() {
        let context = container.viewContext
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                print("Failed to save context: \(error.localizedDescription)")
            }
        }
    }
}

// MARK: - Scan Entity

@objc(ScanEntity)
public class ScanEntity: NSManagedObject, Identifiable {

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

    // MARK: - Computed Properties

    var highlights: [String] {
        get {
            guard let data = highlightsData else { return [] }
            return (try? JSONDecoder().decode([String].self, from: data)) ?? []
        }
        set {
            highlightsData = try? JSONEncoder().encode(newValue)
        }
    }

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

    var image: UIImage? {
        get {
            guard let data = imageData else { return nil }
            return UIImage(data: data)
        }
        set {
            imageData = newValue?.jpegData(compressionQuality: 0.8)
        }
    }

    // MARK: - Fetch Request

    @nonobjc public class func fetchRequest() -> NSFetchRequest<ScanEntity> {
        let request = NSFetchRequest<ScanEntity>(entityName: "ScanEntity")
        request.sortDescriptors = [NSSortDescriptor(keyPath: \ScanEntity.createdAt, ascending: false)]
        return request
    }
}


// MARK: - History Manager

@MainActor
class HistoryManager: ObservableObject {

    @Published var scans: [ScanEntity] = []
    @Published var searchText = ""

    private let context: NSManagedObjectContext

    init(context: NSManagedObjectContext = PersistenceController.shared.container.viewContext) {
        self.context = context
        fetchScans()
    }

    // MARK: - Fetch

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
            print("Failed to fetch scans: \(error.localizedDescription)")
        }
    }

    // MARK: - Save Scan

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

    // MARK: - Delete

    func deleteScan(_ scan: ScanEntity) {
        context.delete(scan)
        PersistenceController.shared.save()
        fetchScans()
    }

    func deleteScans(at offsets: IndexSet) {
        for index in offsets {
            context.delete(scans[index])
        }
        PersistenceController.shared.save()
        fetchScans()
    }
}
