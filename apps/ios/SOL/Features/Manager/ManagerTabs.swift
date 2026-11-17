import SwiftUI
import Charts

struct DailyRevenue: Decodable, Identifiable { let date: String; let revenue: Double; let transactionCount: Int?; var id: String { date } }
struct PackageRevenue: Decodable, Identifiable { let packageId: Int; let packageName: String; let revenue: Double; let subscriptionCount: Int?; let percentage: Double?; var id: Int { packageId } }
struct RecentTransaction: Decodable, Identifiable { let id: Int; let invoiceNumber: String?; let memberName: String; let packageName: String?; let amount: Double; let method: String?; let paidAt: String }
struct RenewalRate: Decodable { let renewalRate: Double? }
struct CancellationRequest: Decodable, Identifiable, Hashable {
    let id: Int; let memberName: String?; let packageName: String; let reason: String; let status: String
    let requestedAt: String; let refundAmount: Double?; let requestedByName: String?
}
private struct NoteBody: Encodable { let note: String?; let refundAmount: Double? }

struct ReportData { var daily: [DailyRevenue]; var packages: [PackageRevenue]; var recent: [RecentTransaction]; var renewal: Double? }

enum ManagerAPI {
    static func report(days: Int) async throws -> ReportData {
        let to = Fmt.todayString()
        let from = Fmt.dayString(Calendar.current.date(byAdding: .day, value: -(days - 1), to: Date()) ?? Date())
        let q = ["startDate": from, "endDate": to]
        async let d: [DailyRevenue] = APIClient.shared.get("/reports/revenue/daily", query: q)
        async let p: [PackageRevenue] = APIClient.shared.get("/reports/revenue/by-package", query: q)
        async let r: [RecentTransaction] = APIClient.shared.get("/reports/transactions/recent", query: q)
        async let n: RenewalRate? = try? APIClient.shared.get("/reports/renewal-rate", query: q)
        return ReportData(daily: try await d, packages: try await p, recent: try await r, renewal: await n?.renewalRate)
    }
    static func cancellations() async throws -> [CancellationRequest] { try await APIClient.shared.get("/memberships/cancellations") }
    static func approve(_ r: CancellationRequest) async throws { let _: Empty? = try await APIClient.shared.post("/memberships/cancellations/\(r.id)/approve", body: NoteBody(note: "Quản lý phê duyệt hủy gói & hoàn tiền về Ví", refundAmount: r.refundAmount)) }
    static func reject(_ r: CancellationRequest) async throws { let _: Empty? = try await APIClient.shared.post("/memberships/cancellations/\(r.id)/reject", body: NoteBody(note: "Quản lý từ chối yêu cầu hủy gói", refundAmount: nil)) }
}

struct ManagerTabs: View {
    @State private var tab = Demo.initialTab
    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { ReportsView() }.tabItem { Label(t("Báo cáo", "Reports"), systemImage: "chart.bar") }
                .tag(0)
            NavigationStack { CancellationsView() }.tabItem { Label(t("Yêu cầu huỷ", "Cancellations"), systemImage: "arrow.uturn.backward.circle") }
                .tag(1)
            NavigationStack { TodaySessionsView(title: t("Lớp hôm nay", "Today's classes"), coachOnly: false) }.tabItem { Label(t("Lớp học", "Classes"), systemImage: "calendar") }
                .tag(2)
            NavigationStack { StaffMoreView() }.tabItem { Label(t("Thêm", "More"), systemImage: "ellipsis.circle") }
                .tag(3)
        }
    }
}

struct ReportsView: View {
    @State private var days = 30
    @State private var loader = Loader { try await ManagerAPI.report(days: 30) }
    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Picker("", selection: $days) { Text("7").tag(7); Text("30").tag(30); Text("90").tag(90) }.pickerStyle(.segmented)
                    .onChange(of: days) { _, d in loader = Loader { try await ManagerAPI.report(days: d) } }
                LoadView(loader) { r in
                    let total = r.daily.reduce(0) { $0 + $1.revenue }
                    let today = r.daily.first { $0.date == Fmt.todayString() }?.revenue ?? 0
                    let sold = r.packages.reduce(0) { $0 + ($1.subscriptionCount ?? 0) }
                    HStack(spacing: 12) { StatTile(label: t("Doanh thu kỳ", "Period revenue"), value: Fmt.money(total), icon: "banknote"); StatTile(label: t("Hôm nay", "Today"), value: Fmt.money(today), icon: "sun.max") }
                    HStack(spacing: 12) { StatTile(label: t("Gói đã bán", "Plans sold"), value: "\(sold)", icon: "creditcard"); StatTile(label: t("Tỉ lệ gia hạn", "Renewal rate"), value: r.renewal.map { "\(Int($0.rounded()))%" } ?? "—", icon: "arrow.triangle.2.circlepath") }
                    VStack(alignment: .leading) {
                        Text(t("Doanh thu theo ngày", "Daily revenue")).font(.headline)
                        if r.daily.isEmpty { EmptyState(icon: "chart.bar", title: t("Chưa có dữ liệu", "No data")) }
                        else { Chart(r.daily) { BarMark(x: .value("d", Fmt.date($0.date) ?? Date(), unit: .day), y: .value("₫", $0.revenue)).foregroundStyle(Theme.accent) }.frame(height: 180) }
                    }.card()
                    VStack(alignment: .leading, spacing: 8) {
                        Text(t("Theo gói", "By plan")).font(.headline)
                        ForEach(r.packages) { p in LabeledRow(label: p.packageName, value: Fmt.money(p.revenue)) }
                        if r.packages.isEmpty { Text(t("Chưa có dữ liệu", "No data")).foregroundStyle(Theme.textMuted) }
                    }.card()
                    SectionTitle(t("Giao dịch gần đây", "Recent transactions"))
                    ForEach(r.recent.prefix(15)) { tx in
                        HStack { VStack(alignment: .leading, spacing: 3) { Text(tx.memberName).font(.subheadline.weight(.semibold)); Text((tx.packageName ?? "") + " · " + Fmt.dayTime(tx.paidAt)).font(.caption).foregroundStyle(Theme.textMuted) }
                            Spacer(); Text(Fmt.money(tx.amount)).font(.subheadline.weight(.bold)).foregroundStyle(Theme.accentText) }.card()
                    }
                }.id(days)
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Báo cáo doanh thu", "Revenue reports")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }
}

struct CancellationsView: View {
    @State private var loader = Loader { try await ManagerAPI.cancellations() }
    @State private var busy: Int?
    @State private var error: String?
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ErrorBanner(message: error)
                LoadView(loader) { list in
                    let pending = list.filter { $0.status == "PENDING" }
                    if pending.isEmpty { EmptyState(icon: "checkmark.circle", title: t("Không có yêu cầu chờ duyệt", "No pending requests")).card() }
                    ForEach(pending) { r in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(r.memberName ?? "—").font(.headline)
                            LabeledRow(label: t("Gói", "Plan"), value: r.packageName)
                            LabeledRow(label: t("Lý do", "Reason"), value: r.reason)
                            if let a = r.refundAmount { LabeledRow(label: t("Hoàn tiền", "Refund"), value: Fmt.money(a)) }
                            if let by = r.requestedByName { LabeledRow(label: t("Người đề xuất", "Requested by"), value: by) }
                            HStack {
                                Button(t("Duyệt", "Approve")) { Task { await run(r.id) { try await ManagerAPI.approve(r) } } }.buttonStyle(.solPrimary)
                                Button(t("Từ chối", "Reject")) { Task { await run(r.id) { try await ManagerAPI.reject(r) } } }.buttonStyle(.solSecondary)
                            }.disabled(busy == r.id)
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Yêu cầu huỷ gói", "Cancellation requests")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }
    private func run(_ id: Int, _ a: @escaping () async throws -> Void) async {
        busy = id; error = nil
        defer { busy = nil }
        do { try await a(); await loader.load(silent: true) } catch { self.error = error.localizedDescription }
    }
}
