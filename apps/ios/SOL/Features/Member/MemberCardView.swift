import SwiftUI

struct MemberCardView: View {
    @Environment(AuthStore.self) private var auth
    @State private var qr: DynamicQr?
    @State private var sub: Subscription?
    @State private var error: String?
    @State private var loaded = false
    @State private var remaining = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                VStack(spacing: 14) {
                    Text("SÖL Fitness").font(.title3.weight(.heavy)).foregroundStyle(Theme.accentText)
                    Text(auth.user?.fullName ?? "").font(.title2.weight(.bold)).foregroundStyle(Theme.text)
                    if let sub, sub.isActive {
                        if let qr { QRCodeView(text: qr.qrCode).frame(width: 240, height: 240)
                            Text(remaining > 0 ? t("Mã làm mới sau \(remaining)s", "Code refreshes in \(remaining)s") : t("Đang làm mới…", "Refreshing…")).font(.caption).foregroundStyle(Theme.textMuted)
                        } else if error == nil { ProgressView().frame(height: 240) }
                        Divider()
                        LabeledRow(label: t("Gói", "Plan"), value: sub.packageName)
                        LabeledRow(label: t("Hết hạn", "Expires"), value: Fmt.day(sub.endDate))
                    } else if loaded {
                        EmptyState(icon: "qrcode", title: t("Chưa có gói tập hoạt động", "No active plan"), subtitle: t("Đăng ký gói để nhận mã QR check-in.", "Get a plan to receive your check-in QR."))
                    } else { ProgressView().frame(height: 240) }
                    ErrorBanner(message: error)
                }.card()
                Text(t("Đưa mã này cho lễ tân hoặc quét tại cổng để check-in. Mã tự đổi liên tục để chống chụp lại.", "Show this code at the desk or gate to check in. It rotates constantly to prevent copies.")).font(.footnote).foregroundStyle(Theme.textMuted)
            }.padding(Metrics.pad)
        }
        .navigationTitle(t("Thẻ hội viên", "Member card")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task { await run() }
    }

    /// Nạp gói, rồi làm mới QR động trước khi hết hạn.
    private func run() async {
        do { sub = try await MemberAPI.currentSubscription() } catch { self.error = error.localizedDescription }
        loaded = true
        guard sub?.isActive == true else { return }
        while !Task.isCancelled {
            do {
                let next = try await MemberAPI.dynamicQr()
                qr = next; error = nil; remaining = next.expiresInSeconds
            } catch { self.error = error.localizedDescription; remaining = 10 }
            while remaining > 1, !Task.isCancelled { try? await Task.sleep(for: .seconds(1)); remaining -= 1 }
        }
    }
}
