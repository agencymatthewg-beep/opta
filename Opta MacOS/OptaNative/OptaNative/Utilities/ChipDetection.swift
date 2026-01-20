//
//  ChipDetection.swift
//  OptaNative
//
//  Detects CPU chip type (Apple Silicon vs Intel) and generation.
//  Essential for selecting correct SMC sensor keys.
//

import Foundation

/// Chip family enumeration
enum ChipFamily: String, CaseIterable {
    case m1 = "M1"
    case m2 = "M2"
    case m3 = "M3"
    case m4 = "M4"
    case intel = "Intel"
    case unknown = "Unknown"
}

/// Chip variant (base, Pro, Max, Ultra)
enum ChipVariant: String, CaseIterable {
    case base = "Base"
    case pro = "Pro"
    case max = "Max"
    case ultra = "Ultra"
}

/// Complete chip information
struct ChipInfo {
    let family: ChipFamily
    let variant: ChipVariant
    let isAppleSilicon: Bool
    let brandString: String
    let coreCount: Int
    let performanceCores: Int
    let efficiencyCores: Int

    /// Full display name (e.g., "M3 Pro")
    var displayName: String {
        if variant == .base {
            return family.rawValue
        }
        return "\(family.rawValue) \(variant.rawValue)"
    }
}

/// Chip detection utilities
enum ChipDetection {
    /// Cache the detected chip info
    private static var cachedInfo: ChipInfo?

    /// Check if running on Apple Silicon
    static var isAppleSilicon: Bool {
        var sysinfo = utsname()
        uname(&sysinfo)

        let machine = withUnsafePointer(to: &sysinfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) {
                String(validatingUTF8: $0)
            }
        }

        return machine?.hasPrefix("arm64") == true
    }

    /// Get the CPU brand string
    static var brandString: String {
        var size = 0
        sysctlbyname("machdep.cpu.brand_string", nil, &size, nil, 0)

        guard size > 0 else { return "Unknown" }

        var brand = [CChar](repeating: 0, count: size)
        sysctlbyname("machdep.cpu.brand_string", &brand, &size, nil, 0)

        return String(cString: brand)
    }

    /// Get physical core count
    static var physicalCoreCount: Int {
        var count: Int32 = 0
        var size = MemoryLayout<Int32>.size
        sysctlbyname("hw.physicalcpu", &count, &size, nil, 0)
        return Int(count)
    }

    /// Get performance core count (P-cores)
    static var performanceCoreCount: Int {
        var count: Int32 = 0
        var size = MemoryLayout<Int32>.size
        sysctlbyname("hw.perflevel0.physicalcpu", &count, &size, nil, 0)
        return Int(count)
    }

    /// Get efficiency core count (E-cores)
    static var efficiencyCoreCount: Int {
        var count: Int32 = 0
        var size = MemoryLayout<Int32>.size
        sysctlbyname("hw.perflevel1.physicalcpu", &count, &size, nil, 0)
        return Int(count)
    }

    /// Get chip generation from brand string
    static func getChipGeneration() -> String {
        let brand = brandString

        // Apple Silicon chips
        if brand.contains("M4") { return "M4" }
        if brand.contains("M3") { return "M3" }
        if brand.contains("M2") { return "M2" }
        if brand.contains("M1") { return "M1" }

        // Intel chips
        if brand.contains("Intel") { return "Intel" }

        // Fallback based on architecture
        return isAppleSilicon ? "Apple Silicon" : "Intel"
    }

    /// Get chip family
    static func getChipFamily() -> ChipFamily {
        let brand = brandString

        if brand.contains("M4") { return .m4 }
        if brand.contains("M3") { return .m3 }
        if brand.contains("M2") { return .m2 }
        if brand.contains("M1") { return .m1 }
        if brand.contains("Intel") { return .intel }

        return .unknown
    }

    /// Get chip variant (Pro, Max, Ultra)
    static func getChipVariant() -> ChipVariant {
        let brand = brandString

        if brand.contains("Ultra") { return .ultra }
        if brand.contains("Max") { return .max }
        if brand.contains("Pro") { return .pro }

        return .base
    }

    /// Get complete chip information
    static func getChipInfo() -> ChipInfo {
        if let cached = cachedInfo {
            return cached
        }

        let info = ChipInfo(
            family: getChipFamily(),
            variant: getChipVariant(),
            isAppleSilicon: isAppleSilicon,
            brandString: brandString,
            coreCount: physicalCoreCount,
            performanceCores: performanceCoreCount,
            efficiencyCores: efficiencyCoreCount
        )

        cachedInfo = info
        return info
    }

    /// Clear cached chip info (useful for testing)
    static func clearCache() {
        cachedInfo = nil
    }
}
