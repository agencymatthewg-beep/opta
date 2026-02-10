//
//  NetworkLatencyService.swift
//  OptaNative
//
//  Service for monitoring network latency to key gaming infrastructure.
//  Enhanced with DNS timing, jitter calculation, and QoS detection.
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
    let hostname: String

    init(id: String, name: String, url: URL, region: String) {
        self.id = id
        self.name = name
        self.url = url
        self.region = region
        self.hostname = url.host ?? ""
    }
}

/// Quality of Service classification
enum QoSClass: String, Sendable {
    case excellent = "Excellent"
    case good = "Good"
    case fair = "Fair"
    case poor = "Poor"

    var icon: String {
        switch self {
        case .excellent: return "checkmark.seal.fill"
        case .good: return "checkmark.circle.fill"
        case .fair: return "exclamationmark.circle.fill"
        case .poor: return "xmark.circle.fill"
        }
    }
}

/// Network recommendation for buffer tuning
struct NetworkRecommendation: Sendable {
    let bufferSizeKB: Int
    let description: String
    let priority: Int // 1 = high, 2 = medium, 3 = low
}

struct LatencyResult: Identifiable, Sendable {
    let id: UUID
    let targetId: String
    let targetName: String
    let region: String
    let rttMs: Double           // Round Trip Time in milliseconds
    let dnsMs: Double           // DNS resolution time in milliseconds
    let jitterMs: Double        // Latency variance (standard deviation)
    let qosClass: QoSClass      // Quality assessment
    let timestamp: Date

    /// Total latency including DNS
    var totalMs: Double { rttMs + dnsMs }

    /// Whether this result indicates gaming-ready connection
    var isGamingReady: Bool {
        totalMs < 80 && jitterMs < 15
    }
}

/// Aggregated network analysis
struct NetworkAnalysis: Sendable {
    let results: [LatencyResult]
    let bestRegion: String
    let averageLatency: Double
    let averageJitter: Double
    let overallQoS: QoSClass
    let recommendation: NetworkRecommendation
    let timestamp: Date
}

// MARK: - Service

actor NetworkLatencyService {

    // MARK: - Configuration

    private let sampleCount = 3        // Number of pings per target for jitter calculation
    private let pingTimeout: TimeInterval = 5.0

    // MARK: - Targets

    // Using HTTP endpoints that are globally distributed and reliable
    // URLs are validated at compile time via static initialization
    private static let googleURL = URL(string: "https://www.google.com/generate_204")!
    private static let cloudflareURL = URL(string: "https://1.1.1.1/cdn-cgi/trace")!
    private static let awsUSEastURL = URL(string: "https://dynamodb.us-east-1.amazonaws.com/")!
    private static let awsEuropeURL = URL(string: "https://dynamodb.eu-west-1.amazonaws.com/")!
    private static let awsAsiaURL = URL(string: "https://dynamodb.ap-northeast-1.amazonaws.com/")!
    private static let steamURL = URL(string: "https://store.steampowered.com/")!
    private static let discordURL = URL(string: "https://discord.com/")!

    private let targets: [LatencyTarget] = [
        LatencyTarget(id: "google", name: "Google", url: googleURL, region: "Global"),
        LatencyTarget(id: "cloudflare", name: "Cloudflare", url: cloudflareURL, region: "Global"),
        LatencyTarget(id: "aws_ue1", name: "AWS US-East", url: awsUSEastURL, region: "US-East"),
        LatencyTarget(id: "aws_euw1", name: "AWS Europe", url: awsEuropeURL, region: "Europe"),
        LatencyTarget(id: "aws_apne1", name: "AWS Asia", url: awsAsiaURL, region: "Asia"),
        LatencyTarget(id: "steam", name: "Steam", url: steamURL, region: "Global"),
        LatencyTarget(id: "discord", name: "Discord", url: discordURL, region: "Global")
    ]

    // MARK: - DNS Resolution

    /// Measures DNS resolution time for a hostname
    private func measureDNSTime(for hostname: String) async -> Double {
        let start = Date()

        // Use CFHost for DNS resolution timing
        guard let host = CFHostCreateWithName(nil, hostname as CFString).takeRetainedValue() as CFHost? else {
            return 0
        }

        var resolved = DarwinBoolean(false)
        CFHostStartInfoResolution(host, .addresses, nil)
        _ = CFHostGetAddressing(host, &resolved)

        let end = Date()
        return resolved.boolValue ? end.timeIntervalSince(start) * 1000.0 : 0
    }

    // MARK: - Jitter Calculation

    /// Calculates jitter (standard deviation) from multiple samples
    private func calculateJitter(_ samples: [Double]) -> Double {
        guard samples.count > 1 else { return 0 }

        let mean = samples.reduce(0, +) / Double(samples.count)
        let squaredDiffs = samples.map { pow($0 - mean, 2) }
        let variance = squaredDiffs.reduce(0, +) / Double(samples.count - 1)

        return sqrt(variance)
    }

    // MARK: - QoS Assessment

    /// Determines QoS class based on metrics
    private func assessQoS(rtt: Double, jitter: Double, dnsTime: Double) -> QoSClass {
        let total = rtt + dnsTime

        // Excellent: < 30ms total, < 5ms jitter
        if total < 30 && jitter < 5 {
            return .excellent
        }
        // Good: < 60ms total, < 10ms jitter
        if total < 60 && jitter < 10 {
            return .good
        }
        // Fair: < 120ms total, < 25ms jitter
        if total < 120 && jitter < 25 {
            return .fair
        }
        // Poor: anything worse
        return .poor
    }

    // MARK: - Buffer Recommendations

    /// Generates buffer size recommendation based on network conditions
    private func generateRecommendation(avgLatency: Double, avgJitter: Double) -> NetworkRecommendation {
        // Low latency, low jitter -> smaller buffers for responsiveness
        if avgLatency < 50 && avgJitter < 10 {
            return NetworkRecommendation(
                bufferSizeKB: 64,
                description: "Excellent connection. Small buffers for minimal input lag.",
                priority: 3
            )
        }

        // Moderate latency or jitter -> balanced buffers
        if avgLatency < 100 && avgJitter < 20 {
            return NetworkRecommendation(
                bufferSizeKB: 128,
                description: "Good connection. Balanced buffer size recommended.",
                priority: 2
            )
        }

        // High latency or jitter -> larger buffers to smooth variance
        return NetworkRecommendation(
            bufferSizeKB: 256,
            description: "Variable connection. Larger buffers to reduce stuttering.",
            priority: 1
        )
    }

    // MARK: - Ping Operations

    /// Measures latency to a specific target with DNS timing and jitter
    func ping(targetId: String) async -> LatencyResult? {
        guard let target = targets.first(where: { $0.id == targetId }) else { return nil }

        // Measure DNS time first
        let dnsTime = await measureDNSTime(for: target.hostname)

        // Collect multiple samples for jitter
        var samples: [Double] = []

        for _ in 0..<sampleCount {
            do {
                let start = Date()
                var request = URLRequest(url: target.url)
                request.httpMethod = "HEAD"
                request.timeoutInterval = pingTimeout
                request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData

                let (_, _) = try await URLSession.shared.data(for: request)
                let end = Date()

                let rtt = end.timeIntervalSince(start) * 1000.0
                samples.append(rtt)

                // Small delay between samples
                try? await Task.sleep(nanoseconds: 50_000_000) // 50ms
            } catch {
                // Continue with available samples
            }
        }

        guard !samples.isEmpty else {
            print("Latency check failed for \(target.name): no successful samples")
            return nil
        }

        let avgRtt = samples.reduce(0, +) / Double(samples.count)
        let jitter = calculateJitter(samples)
        let qos = assessQoS(rtt: avgRtt, jitter: jitter, dnsTime: dnsTime)

        return LatencyResult(
            id: UUID(),
            targetId: target.id,
            targetName: target.name,
            region: target.region,
            rttMs: avgRtt,
            dnsMs: dnsTime,
            jitterMs: jitter,
            qosClass: qos,
            timestamp: Date()
        )
    }

    /// Measures latency to all targets concurrently and generates analysis
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
            return results.sorted { $0.rttMs < $1.rttMs }
        }
    }

    /// Performs full network analysis with recommendations
    func analyzeNetwork() async -> NetworkAnalysis {
        let results = await pingAll()

        guard !results.isEmpty else {
            return NetworkAnalysis(
                results: [],
                bestRegion: "Unknown",
                averageLatency: 0,
                averageJitter: 0,
                overallQoS: .poor,
                recommendation: NetworkRecommendation(
                    bufferSizeKB: 256,
                    description: "Unable to test network. Check connection.",
                    priority: 1
                ),
                timestamp: Date()
            )
        }

        let avgLatency = results.map(\.totalMs).reduce(0, +) / Double(results.count)
        let avgJitter = results.map(\.jitterMs).reduce(0, +) / Double(results.count)
        // Safe: guard above ensures results is not empty
        guard let bestResult = results.min(by: { $0.totalMs < $1.totalMs }) else {
            // Defensive fallback - should never reach here due to guard above
            return NetworkAnalysis(
                results: results,
                bestRegion: "Unknown",
                averageLatency: avgLatency,
                averageJitter: avgJitter,
                overallQoS: .fair,
                recommendation: generateRecommendation(avgLatency: avgLatency, avgJitter: avgJitter),
                timestamp: Date()
            )
        }

        // Overall QoS is the most common classification
        let qosCounts = Dictionary(grouping: results, by: \.qosClass)
        let overallQoS = qosCounts.max(by: { $0.value.count < $1.value.count })?.key ?? .fair

        return NetworkAnalysis(
            results: results,
            bestRegion: bestResult.region,
            averageLatency: avgLatency,
            averageJitter: avgJitter,
            overallQoS: overallQoS,
            recommendation: generateRecommendation(avgLatency: avgLatency, avgJitter: avgJitter),
            timestamp: Date()
        )
    }

    // MARK: - Access

    func getTargets() -> [LatencyTarget] {
        return targets
    }
}
