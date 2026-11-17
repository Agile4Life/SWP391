import SwiftUI

struct CheckInData { var history: [Checkin]; var streak: WorkoutStreak? }

struct CheckInView: View {
    @State private var loader = Loader<CheckInData> {
        async let h = MemberAPI.checkinHistory()
        async let s = try? MemberAPI.streak()
        return CheckInData(history: try await h, streak: await s)
    }
    @State private var scanning = false
    @State private var checkout = false
    @State private var result: String?
    @State private var isError = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                HStack(spacing: 12) {
                    Button { checkout = false; scanning = true } label: { Label(t("Quét vào", "Check in"), systemImage: "qrcode.viewfinder") }.buttonStyle(.solPrimary)
                    Button { checkout = true; scanning = true } label: { Label(t("Quét ra", "Check out"), systemImage: "rectangle.portrait.and.arrow.right") }.buttonStyle(.solSecondary)
                }
                if let result { if isError { ErrorBanner(message: result) } else { Text(result).foregroundStyle(Theme.success).frame(maxWidth: .infinity, alignment: .leading).padding(12).background(Theme.success.opacity(0.12), in: RoundedRectangle(cornerRadius: 12)) } }
                LoadView(loader) { d in
                    HStack(spacing: 12) {
                        StatTile(label: t("Chuỗi hiện tại", "Current"), value: "\(d.streak?.currentStreak ?? 0)", icon: "flame")
                        StatTile(label: t("Dài nhất", "Longest"), value: "\(d.streak?.longestStreak ?? 0)", icon: "trophy")
                        StatTile(label: t("Ngày tập", "Days"), value: "\(d.streak?.workoutDays ?? 0)", icon: "figure.run")
                    }
                    SectionTitle(t("Lịch sử check-in", "Check-in history"))
                    if d.history.isEmpty { EmptyState(icon: "clock", title: t("Chưa có lượt check-in", "No check-ins yet")).card() }
                    ForEach(d.history.prefix(40)) { c in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(Fmt.dayTime(c.checkInTime)).font(.headline).foregroundStyle(Theme.text)
                                if let out = c.checkOutTime { Text(t("Ra: ", "Out: ") + Fmt.dayTime(out)).font(.caption).foregroundStyle(Theme.textMuted) }
                                if let r = c.denialReason, !c.granted { Text(r).font(.caption).foregroundStyle(Theme.danger) }
                            }
                            Spacer(); Pill(text: c.granted ? t("Hợp lệ", "Granted") : t("Từ chối", "Denied"), tone: c.granted ? .success : .danger)
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Check-in", "Check-in")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .fullScreenCover(isPresented: $scanning) {
            ZStack(alignment: .topTrailing) {
                QRScannerView { code in Task { await handle(code) } }.ignoresSafeArea()
                Button { scanning = false } label: { Image(systemName: "xmark.circle.fill").font(.largeTitle).foregroundStyle(.white).padding() }
            }
        }
    }

    private func handle(_ code: String) async {
        scanning = false
        do {
            let c = checkout ? try await MemberAPI.selfCheckOut(gateQr: code) : try await MemberAPI.selfCheckIn(gateQr: code)
            isError = !c.granted
            result = c.granted ? (checkout ? t("Đã check-out.", "Checked out.") : t("Check-in thành công!", "Checked in!")) : (c.denialReason ?? t("Check-in bị từ chối.", "Check-in denied."))
            await loader.load(silent: true)
        } catch { isError = true; result = error.localizedDescription }
    }
}
