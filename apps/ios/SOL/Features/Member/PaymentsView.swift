import SwiftUI

struct PaymentsView: View {
    @State private var loader = Loader { try await MemberAPI.payments() }
    @State private var pdf: PDFItem?
    @State private var error: String?
    @State private var busy: Int?

    struct PDFItem: Identifiable { let id = UUID(); let data: Data; let name: String }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ErrorBanner(message: error)
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "doc.text", title: t("Chưa có giao dịch", "No payments yet")).card() }
                    ForEach(list) { p in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Text(p.serviceName ?? p.invoiceNumber ?? "#\(p.id)").font(.headline).foregroundStyle(Theme.text); Spacer(); Pill(text: statusText(p.status), tone: tone(p.status)) }
                            Text(Fmt.money(p.amount)).font(.title3.weight(.bold)).foregroundStyle(Theme.accentText)
                            LabeledRow(label: t("Phương thức", "Method"), value: methodText(p.method))
                            LabeledRow(label: t("Ngày", "Date"), value: Fmt.dayTime(p.paidAt ?? p.createdAt))
                            if p.status == "success", p.invoiceNumber != nil {
                                Button(t("Xem hoá đơn", "View invoice")) { Task { await invoice(p) } }.buttonStyle(.solSecondary).disabled(busy == p.id)
                            }
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Thanh toán & hoá đơn", "Payments & invoices")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .sheet(item: $pdf) { PDFSheet(data: $0.data, name: $0.name) }
    }

    private func invoice(_ p: Payment) async {
        busy = p.id; error = nil
        defer { busy = nil }
        do { pdf = PDFItem(data: try await MemberAPI.invoicePdf(paymentId: p.id), name: p.invoiceNumber ?? "Invoice") }
        catch { self.error = error.localizedDescription }
    }

    private func tone(_ s: String) -> Pill.Tone { s == "success" ? .success : s == "pending" ? .warning : s == "failed" ? .danger : .neutral }
    private func statusText(_ s: String) -> String {
        switch s { case "success": t("Thành công", "Paid"); case "pending": t("Chờ xử lý", "Pending"); case "failed": t("Thất bại", "Failed"); case "refunded": t("Đã hoàn", "Refunded"); default: s }
    }
    private func methodText(_ m: String?) -> String {
        switch m { case "cash": t("Tiền mặt", "Cash"); case "online_wallet": t("Ví / VNPay", "Wallet / VNPay"); case "vnpay": "VNPay"; case let x?: x; default: "—" }
    }
}
