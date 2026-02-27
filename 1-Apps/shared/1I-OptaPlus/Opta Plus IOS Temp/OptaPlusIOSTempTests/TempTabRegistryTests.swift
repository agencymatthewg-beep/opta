import XCTest
@testable import OptaPlusIOSTemp

final class TempTabRegistryTests: XCTestCase {
    func testSaturdayTabsLeadAndLegacyPagesAreAppended() {
        let ids = TempTabRegistry.orderedTabs.map(\.id)

        XCTAssertEqual(ids.prefix(5), ["home", "plan", "chat", "work", "more"])
        XCTAssertEqual(ids.suffix(5), ["map", "legacy-chat", "automations", "settings", "diagnostics"])
    }
}
