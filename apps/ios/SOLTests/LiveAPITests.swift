import XCTest
@testable import SOL

/// Kiểm giải mã model với backend thật (stack e2e cục bộ, tài khoản demo trong docs/DEMO_ACCOUNTS.md).
/// Chỉ chạy khi có `TEST_RUNNER_SOL_LIVE_API=http://localhost:18080/api/v1`; bỏ qua nếu không.
final class LiveAPITests: XCTestCase {
    private func login(_ user: String, _ password: String) async throws -> AuthResponse {
        try await APIClient.shared.post("/auth/login", body: ["username": user, "password": password])
    }

    private func check(_ name: String, _ call: () async throws -> Void) async {
        do { try await call() } catch { XCTFail("\(name): \(error)") }
    }

    override func setUpWithError() throws {
        try XCTSkipIf(ProcessInfo.processInfo.environment["SOL_LIVE_API"] == nil, "SOL_LIVE_API chưa đặt")
    }

    func testMemberScreens() async throws {
        let r = try await login("an@demo.sol.vn", "Demo@12345"); APIClient.shared.token = r.token
        await check("subscription") { let s = try await MemberAPI.currentSubscription(); XCTAssertNotNil(s) }
        await check("history") { _ = try await MemberAPI.subscriptionHistory() }
        await check("dynamicQr") { _ = try await MemberAPI.dynamicQr() }
        await check("packages") { let p = try await MemberAPI.packages(); XCTAssertFalse(p.isEmpty) }
        await check("classes") { let c = try await MemberAPI.classes(); XCTAssertFalse(c.isEmpty) }
        await check("enrollments") { _ = try await MemberAPI.upcomingEnrollments() }
        await check("myEnrollments") { _ = try await MemberAPI.myCourseEnrollments() }
        await check("quota") { _ = try await MemberAPI.quota() }
        await check("sessions") { _ = try await MemberAPI.sessions(from: Fmt.todayString(), to: Fmt.todayString()) }
        await check("checkins") { _ = try await MemberAPI.checkinHistory() }
        await check("streak") { _ = try await MemberAPI.streak() }
        await check("payments") { _ = try await MemberAPI.payments() }
        await check("wallet") { _ = try await MemberAPI.wallet() }
        await check("metrics") { _ = try await MemberAPI.healthMetrics() }
        await check("plans") { _ = try await MemberAPI.trainingPlans() }
        await check("notifications") { _ = try await MemberAPI.notifications() }
        await check("unread") { _ = try await MemberAPI.unreadCount() }
        await check("profile") { _ = try await MemberAPI.profile(); _ = try await MemberAPI.rawProfile() }
        await check("coaches") { let c = try await ExtraAPI.coaches(); XCTAssertFalse(c.isEmpty); _ = try await ExtraAPI.coachSlots(c[0].id, date: Fmt.todayString()) }
        await check("coachQuota") { _ = try await ExtraAPI.coachQuota() }
        await check("coachBookings") { _ = try await ExtraAPI.myCoachBookings() }
        await check("tickets") { _ = try await ExtraAPI.tickets() }
        await check("aiSessions") { _ = try await ExtraAPI.aiSessions() }
        await check("chat") { _ = try await ChatAPI.conversations(); _ = try await ChatAPI.contacts("") }
        await check("courts") { let c = try await CourtsAPI.courts(); if let f = c.first { _ = try await CourtsAPI.slots(f.id, date: Fmt.todayString()) }; _ = try await CourtsAPI.mine(); _ = try await CourtsAPI.quota(date: Fmt.todayString()) }
        await check("shop") { _ = try await ShopOrdersAPI.myOrders(); _ = try await ShopOrdersAPI.addresses(); _ = try await ShopAPI.products(q: "", category: nil) }
        await check("realtimeSession") { let _: [String: JSONValue] = try await APIClient.shared.post("/chat/realtime-session") }
    }

    func testStaffScreens() async throws {
        let r = try await login("letan@demo.sol.vn", "Demo@12345"); APIClient.shared.token = r.token
        await check("pending") { _ = try await StaffAPI.pending() }
        await check("holds") { _ = try await StaffAPI.holds() }
        await check("lookup") { let m = try await StaffAPI.lookup("an"); XCTAssertFalse(m.isEmpty) }
        await check("history") { _ = try await StaffAPI.history(from: Fmt.todayString(), to: Fmt.todayString()) }
        await check("sessions") { _ = try await MemberAPI.sessions(from: Fmt.todayString(), to: Fmt.todayString()) }
        await check("inbox") { _ = try await ExtraAPI.inbox() }
        await check("orders") { _ = try await ShopOrdersAPI.staffOrders(status: "paid") }
        await check("notifications") { _ = try await MemberAPI.notifications() }
    }

    func testCoachScreens() async throws {
        let r = try await login("hung@demo.sol.vn", "Demo@12345"); APIClient.shared.token = r.token
        await check("schedule") {
            let s = try await CoachAPI.sessions(from: "2026-10-01", to: "2026-12-31")
            if let first = s.first { _ = try await CoachAPI.roster(first.id) }
        }
        await check("profile") { _ = try await MemberAPI.profile() }
    }

    func testManagerAndAdminScreens() async throws {
        let r = try await login("manager@demo.sol.vn", "Demo@12345"); APIClient.shared.token = r.token
        await check("report") { let d = try await ManagerAPI.report(days: 90); XCTAssertFalse(d.packages.isEmpty) }
        await check("cancellations") { _ = try await ManagerAPI.cancellations() }
        await check("staff") { _ = try await AdminAPI.staff() }
        await check("packages") { _ = try await AdminAPI.packages() }
        await check("rooms") { _ = try await AdminAPI.rooms(); _ = try await AdminAPI.disciplines() }
        await check("equipment") { _ = try await AdminAPI.equipment() }
        await check("products") { let p = try await ProductsAdminAPI.list(q: ""); if let f = p.first { _ = try await ProductsAdminAPI.get(f.id) } }
        await check("categories") { let _: [AdminCategory] = try await APIClient.shared.get("/manager/product-categories") }
        await check("coachAssignments") { let _: CoachAssignmentData = try await APIClient.shared.get("/manager/coach-assignments") }

        let a = try await login("admin@e2e.sol.vn", "Admin@12345"); APIClient.shared.token = a.token
        await check("users") { let u = try await AdminAPI.users(); XCTAssertFalse(u.isEmpty) }
        await check("roles") { _ = try await AdminAPI.roles(); let _: [PermissionDto] = try await APIClient.shared.get("/roles/permissions") }
        await check("auditLogs") { _ = try await AdminAPI.auditLogs() }
    }
}
