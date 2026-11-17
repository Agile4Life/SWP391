import SwiftUI

struct ShopCategory: Decodable, Identifiable, Hashable { let id: Int; let name: String; let slug: String }
struct ProductSummary: Decodable, Identifiable, Hashable {
    let id: Int; let slug: String; let name: String; let categoryName: String?
    let shortDescription: String?; let imageUrl: String?; let minPrice: Double?
    let inStock: Bool?; let lowStock: Bool?; let featured: Bool?
}
struct ProductPage: Decodable { let content: [ProductSummary]; let totalPages: Int?; let number: Int? }
struct ProductImage: Decodable, Hashable { let id: Int; let url: String; let alt: String? }
struct ProductVariant: Decodable, Identifiable, Hashable { let id: Int; let label: String; let price: Double; let stock: Int?; let available: Bool?; let servingsPerContainer: Int? }
struct Nutrient: Decodable, Hashable { let name: String; let amount: Double?; let unit: String?; let dailyValuePercent: Double?; let subRow: Bool?; let highlight: Bool? }
struct ProductDetail: Decodable {
    let id: Int; let name: String; let brand: String?; let categoryName: String?
    let description: String?; let servingSize: String?; let usageInstructions: String?; let warnings: String?
    let images: [ProductImage]?; let variants: [ProductVariant]?; let nutrients: [Nutrient]?
}
struct ShopConfig: Decodable { let shippingFee: Double?; let freeShippingThreshold: Double?; let pickupAddress: String? }

enum ShopAPI {
    /// Ảnh sản phẩm là đường dẫn tương đối trên cùng máy chủ.
    static func imageURL(_ path: String?) -> URL? {
        guard let path else { return nil }
        if path.hasPrefix("http") { return URL(string: path) }
        return URL(string: path, relativeTo: Config.apiBase.deletingLastPathComponent().deletingLastPathComponent())?.absoluteURL
    }
    static func categories() async throws -> [ShopCategory] { try await APIClient.shared.get("/public/product-categories") }
    static func products(q: String, category: String?) async throws -> [ProductSummary] {
        let p: ProductPage = try await APIClient.shared.get("/public/products", query: ["q": q.isEmpty ? nil : q, "category": category, "size": "40"])
        return p.content
    }
    static func detail(_ slug: String) async throws -> ProductDetail {
        try await APIClient.shared.get("/public/products/\(slug.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? slug)")
    }
    static func config() async throws -> ShopConfig { try await APIClient.shared.get("/public/shop/config") }
}

struct ShopView: View {
    @State private var query = ""
    @State private var category: String?
    @State private var cats: [ShopCategory] = []
    @State private var loader = Loader<[ProductSummary]> { try await ShopAPI.products(q: "", category: nil) }
    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        chip(t("Tất cả", "All"), selected: category == nil) { category = nil }
                        ForEach(cats) { c in chip(c.name, selected: category == c.slug) { category = c.slug } }
                    }
                }
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "bag", title: t("Không tìm thấy sản phẩm", "No products found")).card() }
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(list) { p in
                            NavigationLink { ProductDetailView(slug: p.slug, name: p.name) } label: { ProductCard(product: p) }.buttonStyle(.plain)
                        }
                    }
                }
                Text(t("Đặt mua và nhận hàng tại quầy lễ tân hoặc trên website SÖL.", "Order and pick up at the front desk or on the SÖL website.")).font(.footnote).foregroundStyle(Theme.textMuted)
            }.padding(Metrics.pad)
        }
        .searchable(text: $query, prompt: t("Tìm sản phẩm", "Search products"))
        .onSubmit(of: .search) { reload() }
        .onChange(of: category) { _, _ in reload() }
        .onChange(of: query) { _, q in if q.isEmpty { reload() } }
        .task { cats = (try? await ShopAPI.categories()) ?? [] }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Cửa hàng", "Shop")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }

    private func reload() {
        let q = query, c = category
        loader = Loader { try await ShopAPI.products(q: q, category: c) }
    }

    private func chip(_ text: String, selected: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text).font(.subheadline.weight(.semibold)).padding(.horizontal, 14).padding(.vertical, 8)
                .background(selected ? Theme.accent : Theme.surface, in: Capsule())
                .overlay(Capsule().stroke(Theme.border))
                .foregroundStyle(selected ? Theme.onAccent : Theme.text)
        }
    }
}

struct ProductCard: View {
    let product: ProductSummary
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ProductImageView(url: ShopAPI.imageURL(product.imageUrl)).frame(height: 130).frame(maxWidth: .infinity).clipped()
            if let c = product.categoryName { Text(c).font(.caption).foregroundStyle(Theme.textMuted) }
            Text(product.name).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text).lineLimit(2, reservesSpace: true).multilineTextAlignment(.leading)
            HStack {
                if let p = product.minPrice { Text(t("Từ ", "From ") + Fmt.money(p)).font(.footnote.weight(.bold)).foregroundStyle(Theme.accentText) }
                Spacer()
                if product.inStock == false { Pill(text: t("Hết hàng", "Sold out"), tone: .danger) }
            }
        }
        .padding(10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.border))
    }
}

struct ProductImageView: View {
    let url: URL?
    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let img): img.resizable().scaledToFit()
            case .failure: Image(systemName: "photo").font(.largeTitle).foregroundStyle(Theme.textMuted)
            default: ProgressView()
            }
        }.frame(maxWidth: .infinity).background(Theme.surfaceRaised.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
    }
}

struct ProductDetailView: View {
    let slug: String
    let name: String
    @State private var loader: Loader<ProductDetail>

    init(slug: String, name: String) { self.slug = slug; self.name = name; _loader = State(initialValue: Loader { try await ShopAPI.detail(slug) }) }

    var body: some View {
        ScrollView {
            LoadView(loader) { d in
                VStack(alignment: .leading, spacing: 14) {
                    ProductImageView(url: ShopAPI.imageURL(d.images?.first?.url)).frame(height: 260)
                    if let b = d.brand { Text(b).font(.subheadline).foregroundStyle(Theme.textMuted) }
                    Text(d.name).font(.title2.weight(.bold)).foregroundStyle(Theme.text)
                    if let desc = d.description { Text(desc).font(.body).foregroundStyle(Theme.textMuted) }
                    SectionTitle(t("Phân loại", "Variants"))
                    ForEach(d.variants ?? []) { v in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) { Text(v.label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                                if let s = v.servingsPerContainer { Text(t("\(s) lần dùng", "\(s) servings")).font(.caption).foregroundStyle(Theme.textMuted) } }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 3) { Text(Fmt.money(v.price)).font(.subheadline.weight(.bold)).foregroundStyle(Theme.accentText)
                                if v.available == false { Pill(text: t("Hết hàng", "Sold out"), tone: .danger) } }
                        }.card()
                    }
                    if let n = d.nutrients, !n.isEmpty {
                        SectionTitle(t("Thành phần dinh dưỡng", "Nutrition facts"))
                        if let s = d.servingSize { Text(t("Khẩu phần: ", "Serving size: ") + s).font(.footnote).foregroundStyle(Theme.textMuted) }
                        VStack(spacing: 6) {
                            ForEach(n, id: \.name) { row in
                                HStack { Text(row.name).padding(.leading, row.subRow == true ? 16 : 0).fontWeight(row.highlight == true ? .semibold : .regular); Spacer()
                                    Text("\((row.amount ?? 0).formatted()) \(row.unit ?? "")" + (row.dailyValuePercent.map { " · \(Int($0))%" } ?? "")) }
                                    .font(.subheadline).foregroundStyle(Theme.text)
                                Divider()
                            }
                        }.card()
                    }
                    if let u = d.usageInstructions { SectionTitle(t("Cách dùng", "Usage")); Text(u).foregroundStyle(Theme.textMuted) }
                    if let w = d.warnings { SectionTitle(t("Lưu ý", "Warnings")); Text(w).foregroundStyle(Theme.textMuted) }
                }.padding(Metrics.pad)
            }
        }
        .navigationTitle(name).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }
}
