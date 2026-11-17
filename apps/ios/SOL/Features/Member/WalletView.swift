import SwiftUI

struct WalletView: View {
    @State private var loader = Loader { try await MemberAPI.wallet() }
    @State private var amount = "100000"
    @State private var web: URL?
    @State private var reference: String?
    @State private var error: String?
    @State private var info: String?
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                LoadView(loader) { w in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(t("Số dư", "Balance")).foregroundStyle(Theme.textMuted)
                        Text(Fmt.money(w.balance)).font(.system(size: 36, weight: .heavy)).foregroundStyle(Theme.accentText)
                    }.card()
                    VStack(alignment: .leading, spacing: 10) {
                        Text(t("Nạp tiền qua VNPay", "Top up with VNPay")).font(.headline)
                        SOLField(label: t("Số tiền (₫)", "Amount (₫)"), text: $amount, keyboard: .numberPad)
                        HStack { ForEach([50000, 100000, 200000, 500000], id: \.self) { v in Button(Fmt.money(Double(v))) { amount = String(v) }.font(.caption.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 6).background(Theme.surfaceRaised, in: Capsule()).foregroundStyle(Theme.text) } }
                        ErrorBanner(message: error)
                        if let info { Text(info).font(.subheadline).foregroundStyle(Theme.success) }
                        Button(t("Nạp tiền", "Top up")) { Task { await topup() } }.buttonStyle(.solPrimary).disabled(busy || (Int(amount) ?? 0) < 10000)
                    }.card()
                    SectionTitle(t("Giao dịch gần đây", "Recent transactions"))
                    let txs = w.transactions ?? []
                    if txs.isEmpty { EmptyState(icon: "tray", title: t("Chưa có giao dịch", "No transactions")).card() }
                    ForEach(txs) { tx in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(tx.description ?? tx.type).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                                Text(Fmt.dayTime(tx.createdAt)).font(.caption).foregroundStyle(Theme.textMuted)
                            }
                            Spacer()
                            Text((tx.amount >= 0 ? "+" : "") + Fmt.money(tx.amount)).font(.subheadline.weight(.bold)).foregroundStyle(tx.amount >= 0 ? Theme.success : Theme.danger)
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Ví SÖL", "SÖL wallet")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .sheet(item: Binding(get: { web.map(IdentifiableURL.init) }, set: { if $0 == nil { web = nil } }), onDismiss: { Task { await finish() } }) { SafariView(url: $0.url).ignoresSafeArea() }
    }

    private func topup() async {
        busy = true; error = nil; info = nil
        defer { busy = false }
        do {
            let c = try await MemberAPI.topup(amount: Int(amount) ?? 0)
            guard let url = VnpayURL.validated(c.paymentUrl) else { throw APIError(status: 0, code: nil, message: t("Địa chỉ VNPay không hợp lệ.", "Invalid VNPay address.")) }
            reference = c.reference; web = url
        } catch { self.error = error.localizedDescription }
    }

    private func finish() async {
        if let reference, let s = try? await MemberAPI.vnpayStatus(reference: reference) {
            info = s.status == "success" ? t("Nạp tiền thành công.", "Top-up successful.") : s.status == "failed" ? nil : t("Giao dịch đang chờ xác nhận.", "Transaction pending.")
            if s.status == "failed" { error = t("Nạp tiền không thành công.", "Top-up failed.") }
        }
        await loader.load(silent: true)
    }
}
