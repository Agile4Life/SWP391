import SwiftUI

// MARK: - Models

struct CartLine: Codable, Identifiable, Hashable {
    let variantId: Int
    let productName: String
    let variantLabel: String
    let unitPrice: Double
    let imageUrl: String?
    var quantity: Int
    var id: Int { variantId }
}

struct QuoteLine: Decodable, Identifiable, Hashable {
    let variantId: Int; let productName: String; let variantLabel: String; let unitPrice: Double
    let requestedQuantity: Int; let quantity: Int; let stock: Int?
    var id: Int { variantId }
}
struct Quote: Decodable { let lines: [QuoteLine]; let subtotal: Double; let shippingFee: Double; let total: Double; let valid: Bool; let discountPercent: Double?; let discountAmount: Double? }
struct GeoRegion: Decodable, Identifiable, Hashable { let code: String; let name: String; var id: String { code } }
struct SavedAddress: Decodable, Identifiable, Hashable {
    let id: Int; let recipientName: String; let phone: String; let provinceName: String; let wardName: String; let streetLine: String; let isDefault: Bool?
}
struct OrderItem: Decodable, Hashable { let productName: String; let variantLabel: String; let unitPrice: Double; let quantity: Int; let lineTotal: Double }
struct ShippingInfo: Decodable, Hashable { let recipientName: String; let phone: String; let provinceName: String; let wardName: String; let streetLine: String }
struct Order: Decodable, Identifiable, Hashable {
    let id: Int; let code: String; let status: String; let fulfillment: String; let paymentMethod: String
    let items: [OrderItem]; let subtotal: Double; let shippingFee: Double; let total: Double
    let shipping: ShippingInfo?; let pickupAddress: String?; let paymentDueAt: String?; let createdAt: String
    let cancelReason: String?; let trackingCarrier: String?; let trackingNumber: String?
    let canCancel: Bool?; let canPay: Bool?
}
struct OrderSummary: Decodable, Identifiable, Hashable { let id: Int; let code: String; let status: String; let total: Double; let itemCount: Int?; let firstItemName: String?; let createdAt: String; let canPay: Bool? }
struct OrderPage: Decodable { let content: [OrderSummary] }
struct OrderFullPage: Decodable { let content: [Order] }

private struct QuoteItem: Encodable { let variantId: Int; let quantity: Int }
private struct QuoteBody: Encodable { let items: [QuoteItem]; let fulfillment: String }
private struct AddressBody: Encodable { let recipientName: String; let phone: String; let provinceCode: String; let wardCode: String; let streetLine: String; let note: String?; let makeDefault: Bool }
private struct OrderBody: Encodable { let clientRequestId: String; let items: [QuoteItem]; let fulfillment: String; let paymentMethod: String; let addressId: Int?; let shippingAddress: AddressBody?; let saveAddress: Bool; let expectedTotal: Double }
private struct OrderTarget: Encodable { let productOrderId: Int }
private struct ReasonBody: Encodable { let reason: String }
private struct MethodOnly: Encodable { let method: String }
private struct ShipBody: Encodable { let carrier: String; let trackingNumber: String }

enum ShopOrdersAPI {
    private static var c: APIClient { .shared }
    static func quote(_ lines: [CartLine], fulfillment: String) async throws -> Quote { try await c.post("/public/shop/quote", body: QuoteBody(items: lines.map { QuoteItem(variantId: $0.variantId, quantity: $0.quantity) }, fulfillment: fulfillment)) }
    static func provinces() async throws -> [GeoRegion] { try await c.get("/public/geo/provinces") }
    static func wards(_ code: String) async throws -> [GeoRegion] { try await c.get("/public/geo/provinces/\(code)/wards") }
    static func addresses() async throws -> [SavedAddress] { try await c.get("/shop/addresses") }
    static func create(lines: [CartLine], fulfillment: String, payment: String, addressId: Int?, address: (name: String, phone: String, province: String, ward: String, street: String)?, total: Double) async throws -> Order {
        let addr = address.map { AddressBody(recipientName: $0.name, phone: $0.phone, provinceCode: $0.province, wardCode: $0.ward, streetLine: $0.street, note: nil, makeDefault: false) }
        return try await c.post("/shop/orders", body: OrderBody(clientRequestId: UUID().uuidString, items: lines.map { QuoteItem(variantId: $0.variantId, quantity: $0.quantity) }, fulfillment: fulfillment, paymentMethod: payment, addressId: addressId, shippingAddress: addr, saveAddress: addr != nil, expectedTotal: total))
    }
    static func myOrders() async throws -> [OrderSummary] { (try await c.get("/shop/orders", query: ["page": "0", "size": "30"]) as OrderPage).content }
    static func order(_ id: Int) async throws -> Order { try await c.get("/shop/orders/\(id)") }
    static func cancel(_ id: Int) async throws -> Order { try await c.post("/shop/orders/\(id)/cancel", body: [String: String]()) }
    static func vnpay(_ orderId: Int) async throws -> VnpayCheckout { try await c.post("/payments/vnpay/checkout", body: OrderTarget(productOrderId: orderId)) }
    static func walletPay(_ orderId: Int) async throws -> Wallet { try await c.post("/wallet/pay", body: OrderTarget(productOrderId: orderId)) }

    // Staff
    static func staffOrders(status: String) async throws -> [Order] { (try await c.get("/staff/product-orders", query: ["status": status.isEmpty ? nil : status, "page": "0", "size": "30"]) as OrderFullPage).content }
    static func staffAction(_ id: Int, _ action: String, body: (any Encodable)? = nil) async throws -> Order { try await c.post("/staff/product-orders/\(id)/\(action)", body: body) }
    static func counterPay(_ id: Int, method: String) async throws -> Order { try await staffAction(id, "counter-payment", body: MethodOnly(method: method)) }
    static func ship(_ id: Int, carrier: String, tracking: String) async throws -> Order { try await staffAction(id, "ship", body: ShipBody(carrier: carrier, trackingNumber: tracking)) }
    static func staffCancel(_ id: Int, reason: String) async throws -> Order { try await staffAction(id, "cancel", body: ["reason": reason]) }
}

// MARK: - Cart store

@MainActor @Observable
final class CartStore {
    static let shared = CartStore()
    var lines: [CartLine] { didSet { UserDefaults.standard.set(try? JSONEncoder().encode(lines), forKey: "sol_cart") } }
    private init() { lines = (UserDefaults.standard.data(forKey: "sol_cart").flatMap { try? JSONDecoder().decode([CartLine].self, from: $0) }) ?? [] }
    var count: Int { lines.reduce(0) { $0 + $1.quantity } }
    func add(_ line: CartLine) {
        if let i = lines.firstIndex(where: { $0.variantId == line.variantId }) { lines[i].quantity = min(20, lines[i].quantity + line.quantity) } else { lines.append(line) }
    }
    func remove(_ id: Int) { lines.removeAll { $0.variantId == id } }
    func setQuantity(_ id: Int, _ q: Int) { if let i = lines.firstIndex(where: { $0.variantId == id }) { if q <= 0 { lines.remove(at: i) } else { lines[i].quantity = min(20, q) } } }
    func clear() { lines = [] }
}

// MARK: - Views

struct CartView: View {
    @State private var cart = CartStore.shared
    @State private var placed: Order?

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if cart.lines.isEmpty { EmptyState(icon: "cart", title: t("Giỏ hàng trống", "Your cart is empty")).card() }
                ForEach(cart.lines) { l in
                    HStack(spacing: 12) {
                        ProductImageView(url: ShopAPI.imageURL(l.imageUrl)).frame(width: 64, height: 64)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(l.productName).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text).lineLimit(2)
                            Text(l.variantLabel).font(.caption).foregroundStyle(Theme.textMuted)
                            Text(Fmt.money(l.unitPrice)).font(.footnote.weight(.bold)).foregroundStyle(Theme.accentText)
                        }
                        Spacer()
                        Stepper("", value: Binding(get: { l.quantity }, set: { cart.setQuantity(l.variantId, $0) }), in: 0...20).labelsHidden()
                    }.card()
                }
                if !cart.lines.isEmpty {
                    HStack { Text(t("Tạm tính", "Subtotal")); Spacer(); Text(Fmt.money(cart.lines.reduce(0) { $0 + $1.unitPrice * Double($1.quantity) })).fontWeight(.bold) }.card()
                    NavigationLink { CheckoutView(onPlaced: { placed = $0 }) } label: { Text(t("TIẾN HÀNH ĐẶT HÀNG", "CHECKOUT")) }.buttonStyle(.solPrimary)
                }
            }.padding(Metrics.pad)
        }
        .navigationTitle(t("Giỏ hàng", "Cart")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .navigationDestination(item: $placed) { OrderDetailView(orderId: $0.id) }
    }
}

struct CheckoutView: View {
    let onPlaced: (Order) -> Void
    @State private var cart = CartStore.shared
    @State private var fulfillment = "pickup"
    @State private var payment = "counter"
    @State private var quote: Quote?
    @State private var addresses: [SavedAddress] = []
    @State private var addressId: Int?
    @State private var provinces: [GeoRegion] = []
    @State private var wards: [GeoRegion] = []
    @State private var name = ""
    @State private var phone = ""
    @State private var province = ""
    @State private var ward = ""
    @State private var street = ""
    @State private var busy = false
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss

    private var newAddress: Bool { addressId == nil }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Picker("", selection: $fulfillment) { Text(t("Nhận tại quầy", "Pick up")).tag("pickup"); Text(t("Giao tận nơi", "Delivery")).tag("delivery") }.pickerStyle(.segmented)
                if fulfillment == "delivery" {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(t("Địa chỉ giao hàng", "Delivery address")).font(.headline)
                        ForEach(addresses) { a in
                            Button { addressId = a.id } label: {
                                HStack { Image(systemName: addressId == a.id ? "largecircle.fill.circle" : "circle").foregroundStyle(Theme.accent)
                                    VStack(alignment: .leading) { Text(a.recipientName + " · " + a.phone).foregroundStyle(Theme.text); Text("\(a.streetLine), \(a.wardName), \(a.provinceName)").font(.caption).foregroundStyle(Theme.textMuted) }; Spacer() }
                            }
                        }
                        Button { addressId = nil } label: { HStack { Image(systemName: newAddress ? "largecircle.fill.circle" : "circle").foregroundStyle(Theme.accent); Text(t("Địa chỉ mới", "New address")).foregroundStyle(Theme.text); Spacer() } }
                        if newAddress {
                            SOLField(label: t("Người nhận", "Recipient"), text: $name, contentType: .name)
                            SOLField(label: t("Số điện thoại", "Phone"), text: $phone, keyboard: .phonePad, contentType: .telephoneNumber)
                            Picker(t("Tỉnh/Thành", "Province"), selection: $province) { Text("—").tag(""); ForEach(provinces) { Text($0.name).tag($0.code) } }
                            Picker(t("Phường/Xã", "Ward"), selection: $ward) { Text("—").tag(""); ForEach(wards) { Text($0.name).tag($0.code) } }.disabled(province.isEmpty)
                            SOLField(label: t("Số nhà, đường", "Street address"), text: $street)
                        }
                    }.card()
                }
                Picker("", selection: $payment) { Text(t("Thanh toán tại quầy", "Pay at counter")).tag("counter"); Text(t("Trả online", "Pay online")).tag("online") }.pickerStyle(.segmented)
                if let q = quote {
                    VStack(spacing: 8) {
                        ForEach(q.lines) { l in LabeledRow(label: "\(l.productName) ×\(l.quantity)", value: Fmt.money(l.unitPrice * Double(l.quantity))) }
                        Divider()
                        LabeledRow(label: t("Tạm tính", "Subtotal"), value: Fmt.money(q.subtotal))
                        if let d = q.discountAmount, d > 0 { LabeledRow(label: t("Ưu đãi hạng gói", "Plan discount"), value: "−" + Fmt.money(d)) }
                        LabeledRow(label: t("Phí giao hàng", "Shipping"), value: Fmt.money(q.shippingFee))
                        HStack { Text(t("Tổng", "Total")).font(.headline); Spacer(); Text(Fmt.money(q.total)).font(.title3.weight(.heavy)).foregroundStyle(Theme.accentText) }
                        if !q.valid { ErrorBanner(message: t("Một số sản phẩm không đủ tồn kho. Hãy chỉnh lại giỏ hàng.", "Some items are out of stock. Adjust your cart.")) }
                    }.card()
                } else { ProgressView() }
                ErrorBanner(message: error)
                Button { Task { await place() } } label: { if busy { ProgressView() } else { Text(t("ĐẶT HÀNG", "PLACE ORDER")) } }.buttonStyle(.solPrimary).disabled(busy || quote?.valid != true || !addressReady)
            }.padding(Metrics.pad)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(t("Đặt hàng", "Checkout")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task(id: fulfillment) { quote = nil; quote = try? await ShopOrdersAPI.quote(cart.lines, fulfillment: fulfillment) }
        .task { addresses = (try? await ShopOrdersAPI.addresses()) ?? []; addressId = addresses.first(where: { $0.isDefault == true })?.id ?? addresses.first?.id; provinces = (try? await ShopOrdersAPI.provinces()) ?? [] }
        .onChange(of: province) { _, p in ward = ""; Task { wards = p.isEmpty ? [] : ((try? await ShopOrdersAPI.wards(p)) ?? []) } }
    }

    private var addressReady: Bool {
        fulfillment == "pickup" || addressId != nil || (!name.isEmpty && Validate.phone(phone) && !province.isEmpty && !ward.isEmpty && !street.isEmpty)
    }

    private func place() async {
        guard let quote else { return }
        busy = true; error = nil
        defer { busy = false }
        do {
            let addr = (fulfillment == "delivery" && newAddress) ? (name: name, phone: phone, province: province, ward: ward, street: street) : nil
            let order = try await ShopOrdersAPI.create(lines: cart.lines, fulfillment: fulfillment, payment: payment, addressId: fulfillment == "delivery" ? addressId : nil, address: addr, total: quote.total)
            cart.clear(); onPlaced(order); dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

struct OrdersView: View {
    @State private var loader = Loader { try await ShopOrdersAPI.myOrders() }
    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "shippingbox", title: t("Chưa có đơn hàng", "No orders yet")).card() }
                    ForEach(list) { o in
                        NavigationLink { OrderDetailView(orderId: o.id) } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack { Text(o.code).font(.headline).foregroundStyle(Theme.text); Spacer(); Pill(text: orderStatus(o.status), tone: orderTone(o.status)) }
                                if let n = o.firstItemName { Text(n + ((o.itemCount ?? 1) > 1 ? t(" và \((o.itemCount ?? 1) - 1) sản phẩm khác", " +\((o.itemCount ?? 1) - 1) more") : "")).font(.subheadline).foregroundStyle(Theme.textMuted) }
                                HStack { Text(Fmt.dayTime(o.createdAt)).font(.caption).foregroundStyle(Theme.textMuted); Spacer(); Text(Fmt.money(o.total)).font(.subheadline.weight(.bold)).foregroundStyle(Theme.accentText) }
                            }.card()
                        }.buttonStyle(.plain)
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Đơn hàng của tôi", "My orders")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }
}

func orderStatus(_ s: String) -> String {
    switch s { case "pending_payment": t("Chờ thanh toán", "Awaiting payment"); case "paid": t("Đã thanh toán", "Paid"); case "processing": t("Đang chuẩn bị", "Processing"); case "shipping": t("Đang giao", "Shipping")
    case "ready_for_pickup": t("Sẵn sàng nhận", "Ready for pickup"); case "completed": t("Hoàn tất", "Completed"); case "cancelled": t("Đã huỷ", "Cancelled"); default: s }
}
func orderTone(_ s: String) -> Pill.Tone { s == "completed" ? .success : s == "cancelled" ? .danger : s == "pending_payment" ? .warning : .accent }

struct OrderDetailView: View {
    let orderId: Int
    @State private var loader: Loader<Order>
    @State private var busy = false
    @State private var error: String?
    @State private var web: URL?

    init(orderId: Int) { self.orderId = orderId; _loader = State(initialValue: Loader { try await ShopOrdersAPI.order(orderId) }) }

    var body: some View {
        ScrollView {
            LoadView(loader) { o in
                VStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack { Text(o.code).font(.title3.weight(.bold)); Spacer(); Pill(text: orderStatus(o.status), tone: orderTone(o.status)) }
                        LabeledRow(label: t("Ngày đặt", "Placed"), value: Fmt.dayTime(o.createdAt))
                        LabeledRow(label: t("Nhận hàng", "Fulfillment"), value: o.fulfillment == "pickup" ? t("Tại quầy", "Pick up") : t("Giao tận nơi", "Delivery"))
                        if let due = o.paymentDueAt, o.status == "pending_payment" { LabeledRow(label: t("Hạn thanh toán", "Pay by"), value: Fmt.dayTime(due)) }
                        if let p = o.pickupAddress, o.fulfillment == "pickup" { LabeledRow(label: t("Địa điểm nhận", "Pickup at"), value: p) }
                        if let s = o.shipping { LabeledRow(label: t("Giao đến", "Ship to"), value: "\(s.recipientName), \(s.streetLine), \(s.wardName), \(s.provinceName)") }
                        if let tn = o.trackingNumber { LabeledRow(label: t("Mã vận đơn", "Tracking"), value: (o.trackingCarrier ?? "") + " " + tn) }
                        if let r = o.cancelReason { LabeledRow(label: t("Lý do huỷ", "Cancel reason"), value: r) }
                    }.card()
                    VStack(spacing: 8) {
                        ForEach(o.items, id: \.productName) { i in LabeledRow(label: "\(i.productName) · \(i.variantLabel) ×\(i.quantity)", value: Fmt.money(i.lineTotal)) }
                        Divider()
                        LabeledRow(label: t("Phí giao hàng", "Shipping"), value: Fmt.money(o.shippingFee))
                        HStack { Text(t("Tổng", "Total")).font(.headline); Spacer(); Text(Fmt.money(o.total)).font(.title3.weight(.heavy)).foregroundStyle(Theme.accentText) }
                    }.card()
                    ErrorBanner(message: error)
                    if o.canPay == true {
                        Button { Task { await wallet(o) } } label: { Label(t("Trả bằng ví SÖL", "Pay with wallet"), systemImage: "wallet.bifold") }.buttonStyle(.solPrimary).disabled(busy)
                        Button { Task { await online(o) } } label: { Label(t("Thanh toán VNPay", "Pay with VNPay"), systemImage: "creditcard") }.buttonStyle(.solSecondary).disabled(busy)
                    }
                    if o.canCancel == true { Button(t("Huỷ đơn", "Cancel order")) { Task { await cancel(o) } }.buttonStyle(.solSecondary).disabled(busy) }
                }.padding(Metrics.pad)
            }
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Đơn hàng", "Order")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .sheet(item: Binding(get: { web.map(IdentifiableURL.init) }, set: { if $0 == nil { web = nil } }), onDismiss: { Task { await loader.load(silent: true) } }) { SafariView(url: $0.url).ignoresSafeArea() }
    }

    private func wallet(_ o: Order) async { await run { _ = try await ShopOrdersAPI.walletPay(o.id) } }
    private func cancel(_ o: Order) async { await run { _ = try await ShopOrdersAPI.cancel(o.id) } }
    private func online(_ o: Order) async {
        busy = true; error = nil
        defer { busy = false }
        do {
            let c = try await ShopOrdersAPI.vnpay(o.id)
            guard let url = VnpayURL.validated(c.paymentUrl) else { throw APIError(status: 0, code: nil, message: t("Địa chỉ VNPay không hợp lệ.", "Invalid VNPay address.")) }
            web = url
        } catch { self.error = error.localizedDescription }
    }
    private func run(_ a: () async throws -> Void) async {
        busy = true; error = nil
        defer { busy = false }
        do { try await a(); await loader.load(silent: true) } catch { self.error = error.localizedDescription }
    }
}

// MARK: - Staff order handling

struct StaffOrdersView: View {
    @State private var status = "paid"
    @State private var loader = Loader { try await ShopOrdersAPI.staffOrders(status: "paid") }
    @State private var busy: Int?
    @State private var error: String?
    @State private var shipTarget: Order?

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Picker("", selection: $status) {
                    Text(t("Đã trả", "Paid")).tag("paid"); Text(t("Chuẩn bị", "Prep")).tag("processing"); Text(t("Đang giao", "Ship")).tag("shipping"); Text(t("Chờ nhận", "Ready")).tag("ready_for_pickup"); Text(t("Chờ trả", "Unpaid")).tag("pending_payment")
                }.pickerStyle(.segmented)
                .onChange(of: status) { _, s in loader = Loader { try await ShopOrdersAPI.staffOrders(status: s) } }
                ErrorBanner(message: error)
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "shippingbox", title: t("Không có đơn", "No orders")).card() }
                    ForEach(list) { o in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Text(o.code).font(.headline); Spacer(); Pill(text: orderStatus(o.status), tone: orderTone(o.status)) }
                            Text(o.items.map { "\($0.productName) ×\($0.quantity)" }.joined(separator: ", ")).font(.subheadline).foregroundStyle(Theme.textMuted)
                            LabeledRow(label: t("Tổng", "Total"), value: Fmt.money(o.total))
                            LabeledRow(label: t("Nhận hàng", "Fulfillment"), value: o.fulfillment == "pickup" ? t("Tại quầy", "Pick up") : t("Giao tận nơi", "Delivery"))
                            actions(o)
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Đơn sản phẩm", "Product orders")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .sheet(item: $shipTarget) { o in ShipSheet(order: o) { await loader.load(silent: true) } }
    }

    @ViewBuilder private func actions(_ o: Order) -> some View {
        HStack {
            switch o.status {
            case "pending_payment": Button(t("Thu tiền mặt", "Collect cash")) { Task { await run(o) { try await ShopOrdersAPI.counterPay(o.id, method: "cash") } } }.buttonStyle(.solPrimary)
            case "paid": Button(t("Bắt đầu chuẩn bị", "Start")) { Task { await run(o) { _ = try await ShopOrdersAPI.staffAction(o.id, "start-processing") } } }.buttonStyle(.solPrimary)
            case "processing":
                if o.fulfillment == "pickup" { Button(t("Sẵn sàng nhận", "Ready")) { Task { await run(o) { _ = try await ShopOrdersAPI.staffAction(o.id, "ready-for-pickup") } } }.buttonStyle(.solPrimary) }
                else { Button(t("Giao hàng", "Ship")) { shipTarget = o }.buttonStyle(.solPrimary) }
            case "shipping", "ready_for_pickup": Button(t("Hoàn tất", "Complete")) { Task { await run(o) { _ = try await ShopOrdersAPI.staffAction(o.id, "complete") } } }.buttonStyle(.solPrimary)
            default: EmptyView()
            }
            if ["pending_payment", "paid", "processing"].contains(o.status) { Button(t("Huỷ", "Cancel")) { Task { await run(o) { _ = try await ShopOrdersAPI.staffCancel(o.id, reason: "Nhân viên huỷ đơn") } } }.buttonStyle(.solSecondary) }
        }.disabled(busy == o.id)
    }

    private func run(_ o: Order, _ a: () async throws -> Void) async {
        busy = o.id; error = nil
        defer { busy = nil }
        do { try await a(); await loader.load(silent: true) } catch { self.error = error.localizedDescription }
    }
}

struct ShipSheet: View {
    let order: Order
    let done: () async -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var carrier = ""
    @State private var tracking = ""
    @State private var error: String?
    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                SOLField(label: t("Đơn vị vận chuyển", "Carrier"), text: $carrier)
                SOLField(label: t("Mã vận đơn", "Tracking number"), text: $tracking)
                ErrorBanner(message: error)
                Button(t("XÁC NHẬN GIAO", "CONFIRM SHIPMENT")) { Task { do { _ = try await ShopOrdersAPI.ship(order.id, carrier: carrier, tracking: tracking); await done(); dismiss() } catch { self.error = error.localizedDescription } } }.buttonStyle(.solPrimary).disabled(carrier.isEmpty || tracking.isEmpty)
                Spacer()
            }.padding(Metrics.pad).screenBackground()
            .navigationTitle(order.code).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
        }
    }
}
