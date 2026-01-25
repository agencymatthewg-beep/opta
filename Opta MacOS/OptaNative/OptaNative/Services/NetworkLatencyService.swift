//
//  NetworkLatencyService.swift
//  OptaNative
//
//  Service for monitoring network latency to key gaming infrastructure.
//  Uses URLSession timing to estimate Round Trip Time (RTT) to global endpoints.
//  Created for Opta Native macOS - Plan 98-01 (v12.0)
//

import Foundation
import Network

// MARK: - Models

struct LatencyTarget: Identifiable, Sendable {
    let id: String
    let name: String
    let url: URL
    let region: String
}

struct LatencyResult: Identifiable, Sendable {
    let id: UUID
    let targetId: String
    let targetName: String
    let rttMs: Double // Round Trip Time in milliseconds
    let timestamp: Date
}

// MARK: - Service

actor NetworkLatencyService {
    
    // MARK: - Targets
    
    // Using HTTP endpoints that are globally distributed and reliable
    private let targets: [LatencyTarget] = [
        LatencyTarget(id: "google", name: "Google", url: URL(string: "https://www.google.com/generate_204")!, region: "Global"),
        LatencyTarget(id: "cloudflare", name: "Cloudflare", url: URL(string: "https://1.1.1.1/cdn-cgi/trace")!, region: "Global"),
        LatencyTarget(id: "aws_ue1", name: "AWS US-East", url: URL(string: "https://dynamodb.us-east-1.amazonaws.com/")!, region: "US-East"),
        LatencyTarget(id: "aws_euw1", name: "AWS Europe", url: URL(string: "https://dynamodb.eu-west-1.amazonaws.com/")!, region: "Europe"),
        LatencyTarget(id: "aws_apne1", name: "AWS Asia", url: URL(string: "https://dynamodb.ap-northeast-1.amazonaws.com/")!, region: "Asia")
    ]
    
    // MARK: - Ping
    
    /// Measures latency to a specific target
    func ping(targetId: String) async -> LatencyResult? {
        guard let target = targets.first(where: { $0.id == targetId }) else { return nil }
        
        do {
            let start = Date()
            var request = URLRequest(url: target.url)
            request.httpMethod = "HEAD" // Use HEAD to minimize data transfer
            request.timeoutInterval = 5.0
            request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            
            let (_, _) = try await URLSession.shared.data(for: request)
            let end = Date()
            
            let rtt = end.timeIntervalSince(start) * 1000.0 // Convert to ms
            
            return LatencyResult(
                id: UUID(),
                targetId: target.id,
                targetName: target.name,
                rttMs: rtt,
                timestamp: end
            )
        } catch {
            print("Latency check failed for \(target.name): \(error)")
            return nil
        }
    }
    
    /// Measures latency to all targets concurrently
    func pingAll() async -> [LatencyResult] {
        return await withTaskGroup(of: LatencyResult?.self) { group in
            for target in targets {
                group.addTask {
                    return await self.ping(targetId: target.id)
                }
            }
            
            var results: [LatencyResult] = []
            for await result in group {
                if let result = result {
                    results.append(result)
                }
            }
            return results.sorted { $0.rttMs < $1.rttMs } // Sort by lowest latency
        }
    }
    
    // MARK: - Access
    
    func getTargets() -> [LatencyTarget] {
        return targets
    }
}
