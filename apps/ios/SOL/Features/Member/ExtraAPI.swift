import Foundation

// MARK: - Models

struct CoachPublic: Decodable, Identifiable, Hashable {
    let id: Int; let fullName: String; let specialization: String?; let bio: String?; let certification: String?
    let avatarUrl: String?; let defaultHourlyRate: Double?
}
struct CoachSlot: Decodable, Identifiable, Hashable { let startTime: String; let endTime: String; let available: Bool; let reason: String?; var id: String { startTime } }
struct CoachBooking: Decodable, Identifiable, Hashable {
    let id: Int; let coachName: String; let coachSpecialization: String?; let bookingDate: String
    let startTime: String; let endTime: String; let hourlyRate: Double?
    let paymentMethod: String?; let paymentStatus: String?; let status: String
}
struct CoachQuotaStatus: Decodable { let packageName: String?; let monthlyQuota: Int; let usedThisMonth: Int; let remainingQuota: Int }

struct SupportTicket: Decodable, Identifiable, Hashable {
    let id: Int; let subject: String; let description: String?; let status: String; let createdAt: String; let assignedToName: String?
    let memberName: String?
}
struct SupportMessage: Decodable, Identifiable, Hashable { let id: Int; let senderName: String?; let senderRole: String?; let message: String; let createdAt: String }
struct TicketPage: Decodable { let content: [SupportTicket] }

struct AiSession: Decodable, Identifiable, Hashable { let id: Int; let topic: String?; let startedAt: String }
struct AiMessage: Decodable, Identifiable, Hashable { let id: Int; let sender: String; let message: String; let createdAt: String }
struct AiReply: Decodable { let memberMessage: AiMessage; let aiMessage: AiMessage }

struct CourseCheckoutResult: Decodable { let enrollmentId: Int; let amount: Double; let paymentStatus: String?; let paymentUrl: String? }

private struct CoachBookBody: Encodable { let coachId: Int; let bookingDate: String; let startTime: String; let endTime: String; let paymentMethod: String; let notes: String? }
private struct TicketBody: Encodable { let subject: String; let description: String }
private struct TextBody: Encodable { let message: String }
private struct SupportSend: Encodable { let message: String; let clientMessageId: String }
private struct PackageBody: Encodable { let packageId: Int }
private struct MethodBody: Encodable { let method: String }
private struct KycBody: Encodable { let documentType: String; let citizenId: String; let fullName: String; let nationality: String?; let frontImageUrl: String; let backImageUrl: String? }

enum ExtraAPI {
    private static var c: APIClient { .shared }

    static func upgrade(subscriptionId: Int, packageId: Int) async throws -> Subscription { try await c.post("/memberships/subscriptions/\(subscriptionId)/upgrade", body: PackageBody(packageId: packageId)) }

    static func coaches() async throws -> [CoachPublic] { try await c.get("/coach-bookings/coaches") }
    static func coachSlots(_ id: Int, date: String) async throws -> [CoachSlot] { try await c.get("/coach-bookings/available-slots", query: ["coachId": String(id), "date": date]) }
    static func coachQuota() async throws -> CoachQuotaStatus { try await c.get("/coach-bookings/quota-status") }
    static func myCoachBookings() async throws -> [CoachBooking] { try await c.get("/coach-bookings/my") }
    static func bookCoach(coachId: Int, date: String, slot: CoachSlot, method: String, notes: String?) async throws -> CoachBooking {
        try await c.post("/coach-bookings", body: CoachBookBody(coachId: coachId, bookingDate: date, startTime: slot.startTime, endTime: slot.endTime, paymentMethod: method, notes: notes))
    }
    static func cancelCoachBooking(_ id: Int) async throws { let _: Empty? = try await c.delete("/coach-bookings/\(id)") }

    static func tickets() async throws -> [SupportTicket] { (try await c.get("/support/requests/my", query: ["page": "0", "size": "30"]) as TicketPage).content }
    static func inbox(status: String = "") async throws -> [SupportTicket] { (try await c.get("/support/requests", query: ["page": "0", "size": "30", "status": status.isEmpty ? nil : status]) as TicketPage).content }
    static func createTicket(subject: String, description: String) async throws -> SupportTicket { try await c.post("/support/requests", body: TicketBody(subject: subject, description: description)) }
    static func ticketMessages(_ id: Int) async throws -> [SupportMessage] { try await c.get("/support/requests/\(id)/messages") }
    static func sendTicketMessage(_ id: Int, _ text: String) async throws -> SupportMessage { try await c.post("/support/requests/\(id)/messages", body: SupportSend(message: text, clientMessageId: UUID().uuidString)) }
    static func setTicketStatus(_ id: Int, _ status: String) async throws -> SupportTicket { try await c.patch("/support/requests/\(id)/status", body: ["status": status]) }

    static func aiSessions() async throws -> [AiSession] { try await c.get("/ai/chat/sessions") }
    static func createAiSession() async throws -> AiSession { try await c.post("/ai/chat/sessions", body: [String: String]()) }
    static func aiHistory(_ id: Int) async throws -> [AiMessage] { try await c.get("/ai/chat/sessions/\(id)/history") }
    static func aiSend(_ id: Int, _ text: String) async throws -> AiReply { try await c.post("/ai/chat/sessions/\(id)/messages", body: TextBody(message: text)) }

    static func submitKyc(type: String, citizenId: String, fullName: String, nationality: String?, front: String, back: String?) async throws {
        let _: Empty? = try await c.post("/profile/kyc", body: KycBody(documentType: type, citizenId: citizenId, fullName: fullName, nationality: nationality, frontImageUrl: front, backImageUrl: back))
    }

    static func courseCheckout(_ classId: Int, method: String) async throws -> CourseCheckoutResult { try await c.post("/classes/\(classId)/checkout", body: MethodBody(method: method)) }
}
