import SwiftUI

struct PackagesData { var packages: [MembershipPackage]; var current: Subscription?; var history: [Subscription] }

struct PackagesView: View {
    @State private var loader = Loader<PackagesData> {
        async let p = MemberAPI.packages()
        async let c = MemberAPI.currentSubscription()
        async let h = MemberAPI.subscriptionHistory()
        return PackagesData(packages: try await p, current: try await c, history: try await h)
    }
    @State private var paying: PayTarget?
    @State private var upgradeFrom: Subscription?
    @State private var busy = false
    @State private var message: String?
    @State private var isError = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if let message { if isError { ErrorBanner(message: message) } else { Text(message).foregroundStyle(Theme.success).frame(maxWidth: .infinity, alignment: .leading).padding(12).background(Theme.success.opacity(0.12), in: RoundedRectangle(cornerRadius: 12)) } }
                LoadView(loader) { d in
                    let pending = d.history.first { $0.isPending } ?? (d.current?.isPending == true ? d.current : nil)
                    if let cur = d.current, cur.isActive { currentCard(cur) }
                    if let pending { pendingCard(pending) }
                    SectionTitle(t("Các gói tập", "Membership plans"))
                    ForEach(d.packages.filter { ($0.status ?? "active") == "active" }) { p in packageCard(p, canBuy: pending == nil && d.current?.isActive != true) }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Gói tập", "Plans")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .sheet(item: $upgradeFrom) { cur in UpgradeSheet(current: cur, packages: loader.value?.packages ?? [], onCreated: { n in upgradeFrom = nil; Task { await loader.load(silent: true); paying = PayTarget(subscription: n) } }) }
        .sheet(item: $paying, onDismiss: { Task { await loader.load(silent: true) } }) { target in PaySheet(target: target) }
    }

    private func currentCard(_ s: Subscription) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text(s.packageName).font(.title3.weight(.bold)); Spacer(); Pill(text: t("Đang hoạt động", "Active"), tone: .success) }
            LabeledRow(label: t("Hiệu lực", "Valid"), value: "\(Fmt.day(s.startDate)) – \(Fmt.day(s.endDate))")
            if let left = Fmt.daysLeft(until: s.endDate) { LabeledRow(label: t("Còn lại", "Left"), value: t("\(left) ngày", "\(left) days")) }
            HStack {
                Button(t("Gia hạn", "Renew")) { Task { await renew(s) } }.buttonStyle(.solSecondary).disabled(busy)
                if loader.value?.packages.contains(where: { $0.price > (s.remainingValue ?? .infinity) && $0.id != s.packageId }) == true {
                    Button(t("Nâng cấp", "Upgrade")) { upgradeFrom = s }.buttonStyle(.solSecondary).disabled(busy)
                }
            }
        }.card()
    }

    private func pendingCard(_ s: Subscription) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text(s.packageName).font(.title3.weight(.bold)); Spacer(); Pill(text: t("Chờ thanh toán", "Awaiting payment"), tone: .warning) }
            if let due = s.amountDue { LabeledRow(label: t("Cần thanh toán", "Amount due"), value: Fmt.money(due)) }
            HStack {
                Button(t("Thanh toán", "Pay")) { paying = PayTarget(subscription: s) }.buttonStyle(.solPrimary)
                Button(t("Huỷ yêu cầu", "Cancel")) { Task { await cancel(s) } }.buttonStyle(.solSecondary).disabled(busy)
            }
        }.card()
    }

    private func packageCard(_ p: MembershipPackage, canBuy: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(p.name).font(.title3.weight(.bold)).foregroundStyle(Theme.text)
            Text(Fmt.money(p.price)).font(.title.weight(.heavy)).foregroundStyle(Theme.accentText)
            Text(t("\(p.durationDays) ngày", "\(p.durationDays) days")).font(.subheadline).foregroundStyle(Theme.textMuted)
            if let d = p.description, !d.isEmpty { Text(d).font(.subheadline).foregroundStyle(Theme.textMuted) }
            if let c = p.classCreditLimit { Label(t("\(c) khoá học miễn phí", "\(c) free courses"), systemImage: "checkmark.circle").font(.subheadline).foregroundStyle(Theme.text) }
            if canBuy { Button(t("Đăng ký gói", "Register")) { Task { await register(p) } }.buttonStyle(.solPrimary).disabled(busy) }
        }.card()
    }

    private func register(_ p: MembershipPackage) async {
        busy = true; message = nil
        defer { busy = false }
        do { let s = try await MemberAPI.registerPackage(p.id); await loader.load(silent: true); paying = PayTarget(subscription: s, fallbackAmount: p.price) }
        catch { isError = true; message = error.localizedDescription }
    }

    private func renew(_ s: Subscription) async {
        busy = true; message = nil
        defer { busy = false }
        do { let n = try await MemberAPI.renew(s.id); await loader.load(silent: true); paying = PayTarget(subscription: n) }
        catch { isError = true; message = error.localizedDescription }
    }

    private func cancel(_ s: Subscription) async {
        busy = true; message = nil
        defer { busy = false }
        do { _ = try await MemberAPI.cancelPending(s.id); isError = false; message = t("Đã huỷ yêu cầu.", "Request cancelled."); await loader.load(silent: true) }
        catch { isError = true; message = error.localizedDescription }
    }
}

struct PayTarget: Identifiable {
    let subscription: Subscription
    var fallbackAmount: Double? = nil
    var id: Int { subscription.id }
    var amount: Double { subscription.amountDue ?? fallbackAmount ?? 0 }
}

struct PaySheet: View {
    let target: PayTarget
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var error: String?
    @State private var done: String?
    @State private var web: URL?
    @State private var reference: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(target.subscription.packageName).font(.title3.weight(.bold))
                    Text(Fmt.money(target.amount)).font(.largeTitle.weight(.heavy)).foregroundStyle(Theme.accentText)
                }.card()
                if let done {
                    Label(done, systemImage: "checkmark.circle.fill").foregroundStyle(Theme.success).font(.headline)
                    Button(t("Xong", "Done")) { dismiss() }.buttonStyle(.solPrimary)
                } else {
                    ErrorBanner(message: error)
                    Button { Task { await wallet() } } label: { Label(t("Trả bằng ví SÖL", "Pay with SÖL wallet"), systemImage: "wallet.bifold") }.buttonStyle(.solPrimary).disabled(busy)
                    Button { Task { await vnpay() } } label: { Label(t("Thanh toán VNPay", "Pay with VNPay"), systemImage: "creditcard") }.buttonStyle(.solSecondary).disabled(busy)
                    Text(t("Hoặc thanh toán tiền mặt tại quầy lễ tân; lễ tân sẽ xác nhận yêu cầu của bạn.", "Or pay cash at the front desk; reception will confirm your request.")).font(.footnote).foregroundStyle(Theme.textMuted)
                }
                Spacer()
            }
            .padding(Metrics.pad).screenBackground()
            .navigationTitle(t("Thanh toán", "Payment")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
            .sheet(item: Binding(get: { web.map(IdentifiableURL.init) }, set: { if $0 == nil { web = nil } }), onDismiss: { Task { await checkStatus() } }) { SafariView(url: $0.url).ignoresSafeArea() }
        }
    }

    private func wallet() async {
        busy = true; error = nil
        defer { busy = false }
        do { _ = try await MemberAPI.payWithWallet(subscriptionId: target.subscription.id); done = t("Đã thanh toán bằng ví.", "Paid with your wallet.") }
        catch { self.error = error.localizedDescription }
    }

    private func vnpay() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            let c = try await MemberAPI.vnpayCheckout(subscriptionId: target.subscription.id)
            guard let url = VnpayURL.validated(c.paymentUrl) else { throw APIError(status: 0, code: nil, message: t("Địa chỉ VNPay không hợp lệ.", "Invalid VNPay address.")) }
            reference = c.reference; web = url
        } catch { self.error = error.localizedDescription }
    }

    private func checkStatus() async {
        guard let reference else { return }
        if let s = try? await MemberAPI.vnpayStatus(reference: reference) {
            if s.status == "success" { done = t("Thanh toán VNPay thành công.", "VNPay payment successful.") }
            else if s.status == "failed" { error = t("Thanh toán VNPay không thành công.", "VNPay payment failed.") }
            else { error = t("Giao dịch đang chờ xác nhận. Kiểm tra lại trong Thanh toán & hoá đơn.", "Transaction is pending. Check Payments & invoices later.") }
        }
    }
}

struct IdentifiableURL: Identifiable { let url: URL; var id: String { url.absoluteString } }


struct UpgradeSheet: View {
    let current: Subscription
    let packages: [MembershipPackage]
    let onCreated: (Subscription) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var error: String?

    /// Phí = giá gói mới − giá trị còn lại của kỳ hiện tại (backend chốt số tiền cuối).
    private func quote(_ p: MembershipPackage) -> Double? { current.remainingValue.map { max(0, p.price - $0) } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    if let r = current.remainingValue { Text(t("Giá trị còn lại của gói hiện tại: ", "Remaining value of your current plan: ") + Fmt.money(r)).font(.subheadline).foregroundStyle(Theme.textMuted) }
                    ErrorBanner(message: error)
                    ForEach(packages.filter { $0.id != current.packageId && $0.price > (current.remainingValue ?? .infinity) }) { p in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(p.name).font(.headline)
                            LabeledRow(label: t("Giá gói", "Plan price"), value: Fmt.money(p.price))
                            if let q = quote(p) { LabeledRow(label: t("Cần thanh toán", "To pay"), value: Fmt.money(q)) }
                            Button(t("Nâng cấp lên gói này", "Upgrade to this plan")) { Task { await upgrade(p) } }.buttonStyle(.solPrimary).disabled(busy)
                        }.card()
                    }
                }.padding(Metrics.pad)
            }
            .screenBackground()
            .navigationTitle(t("Nâng cấp gói", "Upgrade plan")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
        }
    }

    private func upgrade(_ p: MembershipPackage) async {
        busy = true; error = nil
        defer { busy = false }
        do { onCreated(try await ExtraAPI.upgrade(subscriptionId: current.id, packageId: p.id)) } catch { self.error = error.localizedDescription }
    }
}
