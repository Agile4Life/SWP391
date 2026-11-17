import Foundation

private struct PackageBody: Encodable { let packageId: Int }
private struct MethodBody: Encodable { let method: String }
private struct SubscriptionTarget: Encodable { let subscriptionId: Int }
private struct AmountBody: Encodable { let amount: Int }
private struct PasswordBody: Encodable { let currentPassword: String; let newPassword: String }

/// Gọi API member. Endpoint lấy theo `apps/web/src/features/member/*Api.ts` và `docs/api-contracts`.
enum MemberAPI {
    private static var c: APIClient { .shared }

    static func currentSubscription() async throws -> Subscription? { try await c.get("/memberships/subscriptions/my") }
    static func subscriptionHistory() async throws -> [Subscription] { try await c.get("/memberships/subscriptions/history") }
    static func dynamicQr() async throws -> DynamicQr { try await c.get("/memberships/subscriptions/my/dynamic-qr") }
    static func packages() async throws -> [MembershipPackage] { try await c.get("/packages") }
    static func registerPackage(_ id: Int) async throws -> Subscription { try await c.post("/memberships/subscriptions", body: PackageBody(packageId: id)) }
    static func renew(_ subscriptionId: Int) async throws -> Subscription { try await c.post("/memberships/subscriptions/\(subscriptionId)/renew") }
    static func cancelPending(_ subscriptionId: Int) async throws -> Subscription { try await c.post("/memberships/subscriptions/\(subscriptionId)/cancel") }

    static func upcomingEnrollments() async throws -> [ClassEnrollment] { try await c.get("/classes/enrollments/my", query: ["status": "booked", "upcoming": "true"]) }
    static func myCourseEnrollments() async throws -> [ClassEnrollment] { try await c.get("/classes/my-enrollments") }
    static func classes() async throws -> [GymClass] { try await c.get("/classes") }
    static func quota() async throws -> Quota { try await c.get("/classes/my-quota") }
    static func sessions(from: String, to: String) async throws -> [ClassSession] { try await c.get("/classes/sessions", query: ["fromDate": from, "toDate": to]) }
    static func enroll(_ classId: Int) async throws -> ClassEnrollment { try await c.post("/classes/\(classId)/enroll") }
    static func leave(_ classId: Int) async throws -> ClassEnrollment { try await c.delete("/classes/\(classId)/enroll") }

    static func selfCheckIn(gateQr: String) async throws -> Checkin { try await c.post("/check-in/self", body: ["gateQr": gateQr]) }
    static func selfCheckOut(gateQr: String) async throws -> Checkin { try await c.post("/check-in/self/checkout", body: ["gateQr": gateQr]) }
    static func checkinHistory() async throws -> [Checkin] { try await c.get("/check-in/history") }
    static func streak() async throws -> WorkoutStreak { try await c.get("/check-in/streak") }

    static func payments() async throws -> [Payment] { try await c.get("/payments/my") }
    static func invoicePdf(paymentId: Int) async throws -> Data { try await c.download("/invoices/my/by-payment/\(paymentId)/download") }

    static func wallet() async throws -> Wallet { try await c.get("/wallet/my") }
    static func topup(amount: Int) async throws -> VnpayCheckout { try await c.post("/wallet/topup/vnpay", body: AmountBody(amount: amount)) }
    static func payWithWallet(subscriptionId: Int) async throws -> Wallet { try await c.post("/wallet/pay", body: SubscriptionTarget(subscriptionId: subscriptionId)) }
    static func vnpayCheckout(subscriptionId: Int) async throws -> VnpayCheckout { try await c.post("/payments/vnpay/checkout", body: SubscriptionTarget(subscriptionId: subscriptionId)) }
    static func vnpayStatus(reference: String) async throws -> VnpayStatus {
        let ref = reference.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? reference
        return try await c.get("/payments/vnpay/transactions/\(ref)")
    }

    static func healthMetrics() async throws -> [HealthMetric] { try await c.get("/health/metrics/my") }
    static func trainingPlans() async throws -> [TrainingPlan] { try await c.get("/coaching/training-plans/my") }

    static func notifications(page: Int = 0) async throws -> [AppNotification] {
        let p: NotificationPage = try await c.get("/notifications", query: ["page": String(page), "size": "30"])
        return p.content
    }
    static func unreadCount() async throws -> Int { (try await c.get("/notifications/unread-count") as UnreadCount).count }
    static func markRead(_ id: Int) async throws { let _: Empty? = try await c.patch("/notifications/\(id)/read") }
    static func markAllRead() async throws { let _: Empty? = try await c.patch("/notifications/read-all") }

    static func profile() async throws -> Profile { try await c.get("/profile") }
    static func changePassword(current: String, new: String) async throws { let _: Empty? = try await c.post("/profile/password", body: PasswordBody(currentPassword: current, newPassword: new)) }
}

extension MemberAPI {
    /// Hồ sơ dạng thô để sửa rồi PUT lại nguyên đối tượng.
    static func rawProfile() async throws -> [String: JSONValue] { try await APIClient.shared.get("/profile") }
    static func saveProfile(_ values: [String: JSONValue]) async throws -> [String: JSONValue] { try await APIClient.shared.put("/profile", body: values) }
}
