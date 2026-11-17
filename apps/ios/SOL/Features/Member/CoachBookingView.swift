import SwiftUI

/// PT 1:1: chọn huấn luyện viên, ngày, khung giờ; trả bằng lượt trong gói hoặc theo giờ.
struct CoachBookingView: View {
    @State private var tab = 0
    @State private var coaches = Loader { try await ExtraAPI.coaches() }
    @State private var mine = Loader { try await ExtraAPI.myCoachBookings() }
    @State private var quota: CoachQuotaStatus?
    @State private var message: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Picker("", selection: $tab) { Text(t("Đặt PT", "Book PT")).tag(0); Text(t("Lịch của tôi", "My sessions")).tag(1) }.pickerStyle(.segmented)
                if let message { Text(message).font(.subheadline).foregroundStyle(Theme.success).frame(maxWidth: .infinity, alignment: .leading) }
                if tab == 0 {
                    if let q = quota { Text(t("Gói \(q.packageName ?? "—"): còn \(q.remainingQuota)/\(q.monthlyQuota) buổi PT tháng này", "\(q.packageName ?? "—") plan: \(q.remainingQuota)/\(q.monthlyQuota) PT sessions left")).font(.subheadline).foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity, alignment: .leading) }
                    LoadView(coaches) { list in
                        if list.isEmpty { EmptyState(icon: "figure.strengthtraining.traditional", title: t("Chưa có huấn luyện viên", "No coaches available")).card() }
                        ForEach(list) { c in
                            NavigationLink { CoachSlotsView(coach: c, onBooked: { message = t("Đặt buổi PT thành công.", "PT session booked."); tab = 1; Task { await mine.load(silent: true) } }) } label: {
                                HStack(spacing: 12) {
                                    Avatar(name: c.fullName, url: c.avatarUrl, size: 54)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(c.fullName).font(.headline).foregroundStyle(Theme.text)
                                        if let s = c.specialization { Text(s).font(.subheadline).foregroundStyle(Theme.textMuted) }
                                        if let r = c.defaultHourlyRate { Text(Fmt.money(r) + t("/giờ", "/hour")).font(.caption.weight(.semibold)).foregroundStyle(Theme.accentText) }
                                    }
                                    Spacer(); Image(systemName: "chevron.right").foregroundStyle(Theme.textMuted)
                                }.card()
                            }.buttonStyle(.plain)
                        }
                    }
                } else {
                    LoadView(mine) { list in
                        if list.isEmpty { EmptyState(icon: "calendar.badge.clock", title: t("Chưa có buổi PT", "No PT sessions")).card() }
                        ForEach(list) { b in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack { Text(b.coachName).font(.headline); Spacer(); Pill(text: b.status == "confirmed" ? t("Đã xác nhận", "Confirmed") : b.status == "completed" ? t("Hoàn thành", "Completed") : t("Đã huỷ", "Cancelled"), tone: b.status == "cancelled" ? .neutral : .success) }
                                LabeledRow(label: t("Ngày", "Date"), value: Fmt.day(b.bookingDate))
                                LabeledRow(label: t("Giờ", "Time"), value: "\(Fmt.time(b.startTime)) – \(Fmt.time(b.endTime))")
                                if let pm = b.paymentMethod { LabeledRow(label: t("Thanh toán", "Payment"), value: pm == "package_quota" ? t("Lượt trong gói", "Plan quota") : t("Trả theo giờ", "Hourly") + (b.paymentStatus.map { " · \($0)" } ?? "")) }
                                if b.status == "confirmed" { Button(t("Huỷ buổi PT", "Cancel session")) { Task { try? await ExtraAPI.cancelCoachBooking(b.id); await mine.load(silent: true) } }.buttonStyle(.solSecondary) }
                            }.card()
                        }
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await coaches.load(silent: true); await mine.load(silent: true) }
        .task { quota = try? await ExtraAPI.coachQuota() }
        .navigationTitle(t("PT 1:1", "1:1 coaching")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }
}

struct CoachSlotsView: View {
    let coach: CoachPublic
    let onBooked: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var date = Date()
    @State private var slots: [CoachSlot] = []
    @State private var chosen: CoachSlot?
    @State private var method = "package_quota"
    @State private var notes = ""
    @State private var loading = true
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                DatePicker(t("Ngày", "Date"), selection: $date, in: Date()..., displayedComponents: .date).card()
                if loading { ProgressView() } else if slots.isEmpty { EmptyState(icon: "clock", title: t("Không có khung giờ", "No time slots")).card() }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], spacing: 8) {
                    ForEach(slots) { s in
                        Button { chosen = s } label: {
                            Text(Fmt.time(s.startTime)).font(.subheadline.weight(.bold)).frame(maxWidth: .infinity, minHeight: 46)
                                .background(chosen == s ? Theme.accent : Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border))
                                .foregroundStyle(chosen == s ? Theme.onAccent : Theme.text).opacity(s.available ? 1 : 0.35)
                        }.disabled(!s.available)
                    }
                }
                if chosen != nil {
                    Picker("", selection: $method) { Text(t("Lượt trong gói", "Plan quota")).tag("package_quota"); Text(t("Trả theo giờ", "Pay hourly")).tag("hourly_pay") }.pickerStyle(.segmented)
                    SOLField(label: t("Ghi chú (tuỳ chọn)", "Notes (optional)"), text: $notes)
                    ErrorBanner(message: error)
                    Button { Task { await book() } } label: { if busy { ProgressView() } else { Text(t("XÁC NHẬN ĐẶT PT", "CONFIRM")) } }.buttonStyle(.solPrimary).disabled(busy)
                }
            }.padding(Metrics.pad)
        }
        .navigationTitle(coach.fullName).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task(id: date) { loading = true; chosen = nil; slots = (try? await ExtraAPI.coachSlots(coach.id, date: Fmt.dayString(date))) ?? []; loading = false }
    }

    private func book() async {
        guard let chosen else { return }
        busy = true; error = nil
        defer { busy = false }
        do { _ = try await ExtraAPI.bookCoach(coachId: coach.id, date: Fmt.dayString(date), slot: chosen, method: method, notes: notes.nilIfEmpty); onBooked(); dismiss() }
        catch { self.error = error.localizedDescription }
    }
}
