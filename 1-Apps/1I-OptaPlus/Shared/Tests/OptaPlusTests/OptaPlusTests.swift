import XCTest
@testable import OptaPlus

final class OptaPlusTests: XCTestCase {
    func testVersion() {
        XCTAssertFalse(OptaPlus.version.isEmpty, "Version string should not be empty")
    }
}
