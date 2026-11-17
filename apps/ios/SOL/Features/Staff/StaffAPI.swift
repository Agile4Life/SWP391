import Foundation

struct PendingSubscription: Decodable, Identifiable, Hashable {
    let id: Int
    let memberId: Int
    let membershipCode: String?
    let memberName: String
    let memberPhone: String?
    let packageId: Int
    let packageName: String
    let packagePrice: Double
    let startDate: String
    let endDate: String
    let createdAt: String?
}

struct HoldRequest: Decodable, Identifiable, Hashable {
    let id: Int
    let memberName: String
    let membershipCode: String?
    let packageName: String
    let holdReason: String?
    let holdRequestedAt: String?
    let cancelledEnrollmentsCount: Int?
}

struct MemberLookup: Decodable, Identifiable, Hashable {
    var id: Int { userId }
    let userId: Int
    let membershipCode: String?
    let fullName: String
    let email: String?
    let phone: String?
    let status: String?
    let currentPackage: String?
    let endDate: String?
}

private struct ProcessPaymentBody: Encodable {
    let memberId: Int; let subscriptionId: Int; let packageId: Int; let amount: Double; let method: String; let note: String
}
private struct ScanBody: Encodable { let qrCode: String; let gate: String }

enum StaffAPI {
    private static var c: APIClient { .shared }
    static func pending() async throws -> [PendingSubscription] { try await c.get("/memberships/subscriptions/pending") }
    static func holds() async throws -> [HoldRequest] { try await c.get("/memberships/subscriptions/holds/pending") }
    static func approveHold(_ id: Int) async throws { let _: Empty? = try await c.post("/memberships/subscriptions/\(id)/hold/approve") }
    static func rejectHold(_ id: Int) async throws { let _: Empty? = try await c.post("/memberships/subscriptions/\(id)/hold/reject") }
    static func cancelPending(_ id: Int) async throws { let _: Empty? = try await c.post("/memberships/subscriptions/\(id)/cancel") }
    static func collect(_ p: PendingSubscription, method: String) async throws {
        let _: Empty? = try await c.post("/payments/process", body: ProcessPaymentBody(memberId: p.memberId, subscriptionId: p.id, packageId: p.packageId, amount: p.packagePrice, method: method, note: "Thu tiền tại quầy Lễ tân (app iOS)"))
    }
    static func lookup(_ q: String) async throws -> [MemberLookup] { try await c.get("/members/lookup", query: ["q": q]) }
    static func scan(_ qr: String) async throws -> Checkin { try await c.post("/check-in/scan", body: ScanBody(qrCode: qr.trimmingCharacters(in: .whitespaces), gate: "Turnstile A1 - Sảnh Chính")) }
    static func checkout(_ id: Int) async throws -> Checkin { try await c.post("/check-in/\(id)/checkout") }
    static func history(from: String, to: String) async throws -> [Checkin] { try await c.get("/check-in/history", query: ["fromDate": from, "toDate": to]) }
}
