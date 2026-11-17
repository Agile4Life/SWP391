import SwiftUI

struct Court: Decodable, Identifiable, Hashable { let id: Int; let name: String; let location: String?; let disciplineName: String; let openTime: String?; let closeTime: String? }
struct CourtSlot: Decodable, Identifiable, Hashable { let startTime: String; let endTime: String; let status: String; let price: Double?; var id: String { startTime } }
struct CourtBooking: Decodable, Identifiable, Hashable {
    let id: Int; let roomName: String; let disciplineName: String?; let date: String; let startTime: String; let endTime: String
    let status: String; let canCancel: Bool?; let price: Double?; let paymentMethod: String?; let paymentStatus: String?
}
struct CourtQuota: Decodable { let packageName: String?; let monthlyQuota: Int; let used: Int; let remaining: Int }
private struct BookBody: Encodable { let roomId: Int; let date: String; let startTime: String; let paymentMethod: String }
private struct CancelBody: Encodable { let reason: String? }
private struct CourtPage: Decodable { let content: [CourtBooking] }

enum CourtsAPI {
    static func courts() async throws -> [Court] { try await APIClient.shared.get("/courts") }
    static func slots(_ id: Int, date: String) async throws -> [CourtSlot] { try await APIClient.shared.get("/courts/\(id)/availability", query: ["date": date]) }
    static func quota(date: String) async throws -> CourtQuota { try await APIClient.shared.get("/court-bookings/quota", query: ["date": date]) }
    static func book(_ court: Court, date: String, slot: CourtSlot, method: String) async throws -> CourtBooking {
        try await APIClient.shared.post("/court-bookings", body: BookBody(roomId: court.id, date: date, startTime: slot.startTime, paymentMethod: method))
    }
    static func mine() async throws -> [CourtBooking] { (try await APIClient.shared.get("/court-bookings/my", query: ["page": "0", "size": "30"]) as CourtPage).content }
    static func cancel(_ id: Int) async throws { let _: Empty? = try await APIClient.shared.patch("/court-bookings/\(id)/cancel", body: CancelBody(reason: nil)) }
}

struct CourtsView: View {
    @State private var tab = 0
    @State private var courts = Loader { try await CourtsAPI.courts() }
    @State private var mine = Loader { try await CourtsAPI.mine() }
    @State private var message: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Picker("", selection: $tab) { Text(t("Đặt sân", "Book")).tag(0); Text(t("Lượt đặt của tôi", "My bookings")).tag(1) }.pickerStyle(.segmented)
                if let message { Text(message).font(.subheadline).foregroundStyle(Theme.success).frame(maxWidth: .infinity, alignment: .leading) }
                if tab == 0 {
                    LoadView(courts) { list in
                        if list.isEmpty { EmptyState(icon: "sportscourt", title: t("Chưa có sân", "No courts")).card() }
                        ForEach(list) { c in
                            NavigationLink { CourtBookingView(court: c, onBooked: { message = t("Đặt sân thành công.", "Court booked."); tab = 1; Task { await mine.load(silent: true) } }) } label: {
                                HStack { VStack(alignment: .leading, spacing: 3) { Text(c.name).font(.headline).foregroundStyle(Theme.text)
                                    Text(c.disciplineName + (c.location.map { " · \($0)" } ?? "")).font(.subheadline).foregroundStyle(Theme.textMuted)
                                    Text("\(Fmt.time(c.openTime)) – \(Fmt.time(c.closeTime))").font(.caption).foregroundStyle(Theme.textMuted) }
                                    Spacer(); Image(systemName: "chevron.right").foregroundStyle(Theme.textMuted) }.card()
                            }.buttonStyle(.plain)
                        }
                    }
                } else {
                    LoadView(mine) { list in
                        if list.isEmpty { EmptyState(icon: "calendar.badge.exclamationmark", title: t("Chưa có lượt đặt sân", "No bookings yet")).card() }
                        ForEach(list) { b in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack { Text(b.roomName).font(.headline); Spacer(); Pill(text: b.status == "booked" ? t("Đã đặt", "Booked") : t("Đã huỷ", "Cancelled"), tone: b.status == "booked" ? .success : .neutral) }
                                LabeledRow(label: t("Ngày", "Date"), value: Fmt.day(b.date))
                                LabeledRow(label: t("Giờ", "Time"), value: "\(Fmt.time(b.startTime)) – \(Fmt.time(b.endTime))")
                                if let p = b.price { LabeledRow(label: t("Giá", "Price"), value: Fmt.money(p)) }
                                if b.canCancel == true { Button(t("Huỷ lượt đặt", "Cancel booking")) { Task { try? await CourtsAPI.cancel(b.id); await mine.load(silent: true) } }.buttonStyle(.solSecondary) }
                            }.card()
                        }
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await courts.load(silent: true); await mine.load(silent: true) }
        .navigationTitle(t("Đặt sân", "Courts")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }
}

struct CourtBookingView: View {
    let court: Court
    let onBooked: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var date = Date()
    @State private var slots: [CourtSlot] = []
    @State private var quota: CourtQuota?
    @State private var chosen: CourtSlot?
    @State private var method = "cash"
    @State private var busy = false
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                DatePicker(t("Ngày", "Date"), selection: $date, in: Date()..., displayedComponents: .date).datePickerStyle(.compact).card()
                if let q = quota { Text(t("Gói \(q.packageName ?? "—"): còn \(q.remaining)/\(q.monthlyQuota) lượt tháng này", "\(q.packageName ?? "—") plan: \(q.remaining)/\(q.monthlyQuota) bookings left this month")).font(.subheadline).foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity, alignment: .leading) }
                if loading { ProgressView() }
                else if slots.isEmpty { EmptyState(icon: "clock", title: t("Không có khung giờ", "No time slots")).card() }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], spacing: 8) {
                    ForEach(slots) { s in
                        let free = s.status == "free"
                        Button { chosen = s } label: {
                            VStack(spacing: 2) { Text(Fmt.time(s.startTime)).font(.subheadline.weight(.bold)); if let p = s.price { Text(Fmt.money(p)).font(.caption2) } }
                                .frame(maxWidth: .infinity, minHeight: 52)
                                .background(chosen == s ? Theme.accent : Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border))
                                .foregroundStyle(chosen == s ? Theme.onAccent : Theme.text).opacity(free ? 1 : 0.35)
                        }.disabled(!free)
                    }
                }
                if chosen != nil {
                    Picker("", selection: $method) { Text(t("Tiền mặt tại quầy", "Cash at desk")).tag("cash"); Text("VNPay").tag("vnpay") }.pickerStyle(.segmented)
                    ErrorBanner(message: error)
                    Button { Task { await book() } } label: { if busy { ProgressView() } else { Text(t("XÁC NHẬN ĐẶT SÂN", "CONFIRM BOOKING")) } }.buttonStyle(.solPrimary).disabled(busy)
                    if method == "vnpay" { Text(t("Sau khi đặt, hoàn tất thanh toán VNPay trên website SÖL hoặc chọn tiền mặt.", "After booking, finish VNPay payment on the SÖL website or choose cash.")).font(.footnote).foregroundStyle(Theme.textMuted) }
                }
            }.padding(Metrics.pad)
        }
        .navigationTitle(court.name).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task(id: date) { await load() }
    }

    private func load() async {
        loading = true; chosen = nil
        let d = Fmt.dayString(date)
        slots = (try? await CourtsAPI.slots(court.id, date: d)) ?? []
        quota = try? await CourtsAPI.quota(date: d)
        loading = false
    }

    private func book() async {
        guard let chosen else { return }
        busy = true; error = nil
        defer { busy = false }
        do { _ = try await CourtsAPI.book(court, date: Fmt.dayString(date), slot: chosen, method: method); onBooked(); dismiss() }
        catch { self.error = error.localizedDescription }
    }
}
