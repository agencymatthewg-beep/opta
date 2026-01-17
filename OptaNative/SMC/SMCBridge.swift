//
//  SMCBridge.swift
//  OptaNative
//
//  Swift wrapper for SMC (System Management Controller) access.
//  Provides high-level API for reading hardware sensor data.
//

import Foundation
import IOKit

/// Error types for SMC operations
enum SMCError: Error, LocalizedError {
    case serviceNotFound
    case connectionFailed(kern_return_t)
    case readFailed(kern_return_t)
    case invalidKey
    case unsupportedDataType

    var errorDescription: String? {
        switch self {
        case .serviceNotFound:
            return "AppleSMC service not found"
        case .connectionFailed(let code):
            return "Failed to connect to SMC (error: \(code))"
        case .readFailed(let code):
            return "Failed to read SMC key (error: \(code))"
        case .invalidKey:
            return "Invalid SMC key"
        case .unsupportedDataType:
            return "Unsupported SMC data type"
        }
    }
}

/// Known SMC data types
enum SMCDataType: UInt32 {
    // Unsigned integers
    case ui8  = 0x75693820  // "ui8 "
    case ui16 = 0x75693136  // "ui16"
    case ui32 = 0x75693332  // "ui32"

    // Signed integers
    case si8  = 0x73693820  // "si8 "
    case si16 = 0x73693136  // "si16"

    // Fixed-point types (signed, various scales)
    case sp1e = 0x73703165  // "sp1e"
    case sp2d = 0x73703264  // "sp2d"
    case sp3c = 0x73703363  // "sp3c"
    case sp4b = 0x73703462  // "sp4b"
    case sp5a = 0x73703561  // "sp5a"
    case sp69 = 0x73703639  // "sp69"
    case sp78 = 0x73703738  // "sp78"
    case sp87 = 0x73703837  // "sp87"
    case sp96 = 0x73703936  // "sp96"
    case spa5 = 0x73706135  // "spa5"
    case spb4 = 0x73706234  // "spb4"

    // Floating point
    case flt  = 0x666c7420  // "flt "
    case fpe2 = 0x66706532  // "fpe2"
    case fp2e = 0x66703265  // "fp2e"

    // String
    case fds  = 0x7b666473  // "{fds"
    case ch8s = 0x63683873  // "ch8*"

    // Flag
    case flag = 0x666c6167  // "flag"
}

/// Represents a value read from the SMC
struct SMCValue {
    let key: String
    let dataSize: UInt32
    let dataType: UInt32
    let bytes: [UInt8]

    /// Convert bytes to Double based on data type
    func toDouble() -> Double? {
        guard bytes.count >= Int(dataSize) else { return nil }

        switch dataType {
        // Unsigned integers
        case SMCDataType.ui8.rawValue:
            return Double(bytes[0])

        case SMCDataType.ui16.rawValue:
            let value = UInt16(bytes[0]) << 8 | UInt16(bytes[1])
            return Double(value)

        case SMCDataType.ui32.rawValue:
            let value = UInt32(bytes[0]) << 24 | UInt32(bytes[1]) << 16 |
                        UInt32(bytes[2]) << 8 | UInt32(bytes[3])
            return Double(value)

        // Signed integers
        case SMCDataType.si8.rawValue:
            return Double(Int8(bitPattern: bytes[0]))

        case SMCDataType.si16.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value)

        // Fixed-point signed (sp78 - most common for temperatures)
        case SMCDataType.sp78.rawValue:
            // sp78: signed 16-bit, 7 bits integer, 8 bits fraction
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 256.0

        case SMCDataType.sp1e.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 16384.0

        case SMCDataType.sp2d.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 8192.0

        case SMCDataType.sp3c.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 4096.0

        case SMCDataType.sp4b.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 2048.0

        case SMCDataType.sp5a.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 1024.0

        case SMCDataType.sp69.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 512.0

        case SMCDataType.sp87.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 128.0

        case SMCDataType.sp96.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 64.0

        case SMCDataType.spa5.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 32.0

        case SMCDataType.spb4.rawValue:
            let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
            return Double(value) / 16.0

        // Floating point (fpe2 - fan speeds)
        case SMCDataType.fpe2.rawValue:
            let value = UInt16(bytes[0]) << 8 | UInt16(bytes[1])
            return Double(value) / 4.0

        case SMCDataType.fp2e.rawValue:
            let value = UInt16(bytes[0]) << 8 | UInt16(bytes[1])
            return Double(value) / 16384.0

        // Standard float
        case SMCDataType.flt.rawValue:
            guard bytes.count >= 4 else { return nil }
            var float: Float = 0
            let data = Data(bytes.prefix(4))
            _ = withUnsafeMutableBytes(of: &float) { data.copyBytes(to: $0) }
            return Double(float)

        default:
            // Unknown type - try to interpret as sp78 (common temperature format)
            if dataSize == 2 {
                let value = Int16(bytes[0]) << 8 | Int16(bytes[1])
                return Double(value) / 256.0
            }
            return nil
        }
    }
}

/// Service for reading SMC sensor data
final class SMCService {
    private var connection: io_connect_t = 0
    private var isConnected = false
    private let queue = DispatchQueue(label: "com.opta.native.smc", qos: .utility)

    deinit {
        close()
    }

    /// Open connection to SMC
    func open() throws {
        guard !isConnected else { return }

        let result = SMCOpen(&connection)

        if result == kIOReturnNotFound {
            throw SMCError.serviceNotFound
        }

        if result != kIOReturnSuccess {
            throw SMCError.connectionFailed(result)
        }

        isConnected = true
    }

    /// Close SMC connection
    func close() {
        guard isConnected else { return }
        SMCClose(connection)
        isConnected = false
        connection = 0
    }

    /// Read a raw SMC key value
    func readKey(_ key: String) -> SMCValue? {
        guard isConnected else { return nil }
        guard key.count == 4 else { return nil }

        var val = SMCVal_t()
        let result = SMCReadKey(connection, key, &val)

        guard result == kIOReturnSuccess else { return nil }

        // Convert C array to Swift array
        let bytes = withUnsafeBytes(of: val.bytes) { Array($0) }

        return SMCValue(
            key: key,
            dataSize: val.dataSize,
            dataType: val.dataType,
            bytes: bytes
        )
    }

    /// Read temperature from SMC key (returns Celsius)
    func readTemperature(_ key: String) -> Double? {
        guard let value = readKey(key) else { return nil }
        guard let temp = value.toDouble() else { return nil }

        // Validate temperature is in reasonable range (0-150°C)
        guard temp >= 0 && temp <= 150 else { return nil }

        return temp
    }

    /// Read fan speed from SMC key (returns RPM)
    func readFanSpeed(_ key: String) -> Int? {
        guard let value = readKey(key) else { return nil }
        guard let rpm = value.toDouble() else { return nil }

        // Validate fan speed is in reasonable range (0-10000 RPM)
        guard rpm >= 0 && rpm <= 10000 else { return nil }

        return Int(rpm)
    }

    /// Read integer value from SMC key
    func readInteger(_ key: String) -> Int? {
        guard let value = readKey(key) else { return nil }
        guard let intVal = value.toDouble() else { return nil }
        return Int(intVal)
    }

    /// Read value asynchronously on background queue
    func readTemperatureAsync(_ key: String, completion: @escaping (Double?) -> Void) {
        queue.async { [weak self] in
            let temp = self?.readTemperature(key)
            DispatchQueue.main.async {
                completion(temp)
            }
        }
    }

    /// Check if SMC service is available
    static var isAvailable: Bool {
        var conn: io_connect_t = 0
        let result = SMCOpen(&conn)
        if result == kIOReturnSuccess {
            SMCClose(conn)
            return true
        }
        return false
    }
}
