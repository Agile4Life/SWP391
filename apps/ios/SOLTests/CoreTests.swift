import XCTest
@testable import SOL

final class CoreTests: XCTestCase {
    func testMoneyUsesVietnameseGrouping() {
        XCTAssertEqual(Fmt.money(1200000), "1.200.000 ₫")
        XCTAssertEqual(Fmt.money(nil), "0 ₫")
    }

    func testDateParsingHandlesDayAndDateTime() {
        XCTAssertNotNil(Fmt.date("2026-11-17"))
        XCTAssertNotNil(Fmt.date("2026-11-17T09:05:00"))
        XCTAssertNotNil(Fmt.date("2026-11-17T09:05:00.123456"))
        XCTAssertNotNil(Fmt.date("2026-11-17T02:05:00Z"))
        XCTAssertNil(Fmt.date(nil))
        XCTAssertEqual(Fmt.time("07:30:00"), "07:30")
    }

    func testPhoneValidationAcceptsVietnameseFormats() {
        XCTAssertTrue(Validate.phone("0912 345 678"))
        XCTAssertTrue(Validate.phone("+84912345678"))
        XCTAssertFalse(Validate.phone("12345"))
        XCTAssertFalse(Validate.phone("0212345678"))
    }

    func testEmailValidation() {
        XCTAssertTrue(Validate.email("user@example.com"))
        XCTAssertFalse(Validate.email("user@"))
        XCTAssertFalse(Validate.email("not an email"))
    }

    func testJSONValueRoundTripKeepsUnknownFields() throws {
        let raw = #"{"fullName":"A","frontImageUrl":"x","kycStatus":null,"n":1.5,"tags":["a"]}"#
        let value = try JSONDecoder().decode([String: JSONValue].self, from: Data(raw.utf8))
        let again = try JSONDecoder().decode([String: JSONValue].self, from: try JSONEncoder().encode(value))
        XCTAssertEqual(value, again)
        XCTAssertEqual(again["frontImageUrl"]?.stringValue, "x")
    }

    func testBackendRoleCodesMapToAppRoles() {
        XCTAssertEqual(Role(rawValue: "RECEPTIONIST"), .staff)
        XCTAssertEqual(Role(rawValue: "CENTER_MANAGER"), .manager)
        XCTAssertNil(Role(rawValue: "UNKNOWN"))
    }

    func testModelsDecodeBackendPayloads() throws {
        let sub = #"{"id":7,"packageName":"Gold","startDate":"2026-01-01","endDate":"2026-04-01","status":"active"}"#
        let s = try JSONDecoder().decode(Subscription.self, from: Data(sub.utf8))
        XCTAssertTrue(s.isActive)
        let page = #"{"content":[{"id":1,"title":"t","message":"m","isRead":false,"createdAt":"2026-01-01T00:00:00"}]}"#
        XCTAssertEqual(try JSONDecoder().decode(NotificationPage.self, from: Data(page.utf8)).content.count, 1)
    }
}
