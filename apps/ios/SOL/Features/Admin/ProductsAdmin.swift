import SwiftUI
import PhotosUI

struct AdminProductSummary: Decodable, Identifiable, Hashable {
    let id: Int; let name: String; let slug: String?; let categoryName: String?; let variantCount: Int?; let totalStock: Int?
    let lowStock: Bool?; let active: Bool; let featured: Bool?; let imageUrl: String?; let minPrice: Double?
}
struct AdminProductPage: Decodable { let content: [AdminProductSummary] }
struct AdminVariant: Codable, Identifiable, Hashable {
    var id: Int?; var sku: String; var label: String; var price: Double; var servingsPerContainer: Int?; var stock: Int?; var active: Bool; var sortOrder: Int
    var key: String { id.map(String.init) ?? sku }
}
struct AdminNutrient: Codable, Hashable { var name: String; var amount: Double; var unit: String; var dailyValuePercent: Double?; var subRow: Bool; var highlight: Bool; var sortOrder: Int? }
struct AdminImage: Decodable, Identifiable, Hashable { let id: Int; let url: String; let alt: String? }
struct AdminProduct: Decodable {
    let id: Int; var name: String; var brand: String?; var categoryId: Int; var form: String?; var goals: [String]?
    var shortDescription: String?; var description: String?; var servingSize: String?; var usageInstructions: String?; var warnings: String?; var registrationNumber: String?
    var active: Bool; var featured: Bool; var images: [AdminImage]?; var variants: [AdminVariant]; var nutrients: [AdminNutrient]?
}
struct ProductUpsert: Encodable {
    struct V: Encodable { let id: Int?; let sku: String; let label: String; let price: Double; let servingsPerContainer: Int?; let initialStock: Int?; let active: Bool; let sortOrder: Int }
    struct N: Encodable { let name: String; let amount: Double; let unit: String; let dailyValuePercent: Double?; let subRow: Bool; let highlight: Bool; let sortOrder: Int }
    let name: String; let categoryId: Int; let form: String; let brand: String?; let shortDescription: String; let description: String; let servingSize: String
    let usageInstructions: String?; let warnings: String?; let registrationNumber: String?; let goals: [String]; let active: Bool; let featured: Bool
    let variants: [V]; let nutrients: [N]
}
private struct ActiveBody: Encodable { let active: Bool }
private struct ImageBody: Encodable { let dataUrl: String; let altText: String }
private struct StockBody: Encodable { let delta: Int; let reason: String; let note: String? }

enum ProductsAdminAPI {
    private static var c: APIClient { .shared }
    static func list(q: String) async throws -> [AdminProductSummary] { (try await c.get("/manager/products", query: ["q": q.isEmpty ? nil : q, "page": "0", "size": "40"]) as AdminProductPage).content }
    static func get(_ id: Int) async throws -> AdminProduct { try await c.get("/manager/products/\(id)") }
    static func setActive(_ id: Int, _ on: Bool) async throws { let _: Empty? = try await c.patch("/manager/products/\(id)/active", body: ActiveBody(active: on)) }
    static func delete(_ id: Int) async throws { let _: Empty? = try await c.delete("/manager/products/\(id)") }
    static func categories() async throws -> [ShopCategory] { try await c.get("/public/product-categories") }
    static func save(id: Int?, _ body: ProductUpsert) async throws -> AdminProduct { id == nil ? try await c.post("/manager/products", body: body) : try await c.put("/manager/products/\(id!)", body: body) }
    static func addImage(_ id: Int, dataUrl: String, alt: String) async throws -> AdminProduct { try await c.post("/manager/products/\(id)/images", body: ImageBody(dataUrl: dataUrl, altText: alt)) }
    static func removeImage(_ id: Int, image: Int) async throws -> AdminProduct { try await c.delete("/manager/products/\(id)/images/\(image)") }
    static func adjustStock(variant: Int, delta: Int) async throws { let _: Empty? = try await c.post("/manager/product-variants/\(variant)/stock-adjustments", body: StockBody(delta: delta, reason: delta > 0 ? "restock" : "adjustment", note: nil)) }
}

extension AdminProduct {
    func upsert(variantsOverride: [AdminVariant]? = nil) -> ProductUpsert {
        ProductUpsert(name: name, categoryId: categoryId, form: form ?? "other", brand: brand?.nilIfEmpty, shortDescription: shortDescription ?? "", description: description ?? "", servingSize: servingSize ?? "",
                      usageInstructions: usageInstructions?.nilIfEmpty, warnings: warnings?.nilIfEmpty, registrationNumber: registrationNumber?.nilIfEmpty, goals: goals ?? [], active: active, featured: featured,
                      variants: (variantsOverride ?? variants).map { .init(id: $0.id, sku: $0.sku, label: $0.label, price: $0.price, servingsPerContainer: $0.servingsPerContainer, initialStock: $0.id == nil ? $0.stock : nil, active: $0.active, sortOrder: $0.sortOrder) },
                      nutrients: (nutrients ?? []).enumerated().map { .init(name: $1.name, amount: $1.amount, unit: $1.unit, dailyValuePercent: $1.dailyValuePercent, subRow: $1.subRow, highlight: $1.highlight, sortOrder: $1.sortOrder ?? $0) })
    }
}

struct ProductsAdminView: View {
    @State private var query = ""
    @State private var loader = Loader { try await ProductsAdminAPI.list(q: "") }
    @State private var creating = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                ErrorBanner(message: error)
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "bag", title: t("Chưa có sản phẩm", "No products")).card() }
                    ForEach(list) { p in
                        NavigationLink { ProductEditorView(productId: p.id) } label: {
                            HStack(spacing: 12) {
                                ProductImageView(url: ShopAPI.imageURL(p.imageUrl)).frame(width: 56, height: 56)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(p.name).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text).lineLimit(2)
                                    Text((p.categoryName ?? "") + " · " + t("Tồn \(p.totalStock ?? 0)", "Stock \(p.totalStock ?? 0)")).font(.caption).foregroundStyle(Theme.textMuted)
                                    HStack { if p.lowStock == true { Pill(text: t("Sắp hết", "Low stock"), tone: .warning) }; if !p.active { Pill(text: t("Đang ẩn", "Hidden"), tone: .neutral) } }
                                }
                                Spacer()
                                Toggle("", isOn: Binding(get: { p.active }, set: { on in Task { do { try await ProductsAdminAPI.setActive(p.id, on); await loader.load(silent: true) } catch { self.error = error.localizedDescription } } })).labelsHidden().tint(Theme.accent)
                            }.card()
                        }.buttonStyle(.plain)
                    }
                }
            }.padding(Metrics.pad)
        }
        .searchable(text: $query, prompt: t("Tìm sản phẩm", "Search products"))
        .onSubmit(of: .search) { reload() }
        .onChange(of: query) { _, q in if q.isEmpty { reload() } }
        .refreshable { await loader.load(silent: true) }
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { creating = true } label: { Image(systemName: "plus") } } }
        .navigationTitle(t("Sản phẩm", "Products")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .sheet(isPresented: $creating, onDismiss: { reload() }) { NewProductSheet() }
    }
    private func reload() { let q = query; loader = Loader { try await ProductsAdminAPI.list(q: q) } }
}

struct ProductEditorView: View {
    let productId: Int
    @Environment(\.dismiss) private var dismiss
    @State private var product: AdminProduct?
    @State private var error: String?
    @State private var message: String?
    @State private var busy = false
    @State private var photo: PhotosPickerItem?
    @State private var confirmDelete = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if let error { ErrorBanner(message: error) }
                if let message { Text(message).foregroundStyle(Theme.success).frame(maxWidth: .infinity, alignment: .leading) }
                if var p = product {
                    VStack(spacing: 12) {
                        SOLField(label: t("Tên sản phẩm", "Name"), text: bind(\.name))
                        SOLField(label: t("Thương hiệu", "Brand"), text: bindOpt(\.brand))
                        SOLField(label: t("Mô tả ngắn", "Short description"), text: bindOpt(\.shortDescription))
                        SOLField(label: t("Mô tả", "Description"), text: bindOpt(\.description))
                        SOLField(label: t("Khẩu phần", "Serving size"), text: bindOpt(\.servingSize))
                        Toggle(t("Nổi bật", "Featured"), isOn: Binding(get: { product?.featured ?? false }, set: { product?.featured = $0 })).tint(Theme.accent)
                        Toggle(t("Đang bán", "Active"), isOn: Binding(get: { product?.active ?? false }, set: { product?.active = $0 })).tint(Theme.accent)
                    }.card()
                    VStack(alignment: .leading, spacing: 10) {
                        Text(t("Phân loại & tồn kho", "Variants & stock")).font(.headline)
                        ForEach(p.variants.indices, id: \.self) { i in
                            VStack(alignment: .leading, spacing: 6) {
                                SOLField(label: t("Nhãn", "Label"), text: Binding(get: { product?.variants[i].label ?? "" }, set: { product?.variants[i].label = $0 }))
                                SOLField(label: t("Giá (₫)", "Price (₫)"), text: Binding(get: { String(Int(product?.variants[i].price ?? 0)) }, set: { product?.variants[i].price = Double($0) ?? 0 }), keyboard: .numberPad)
                                HStack { Text(t("Tồn kho: \(p.variants[i].stock ?? 0)", "Stock: \(p.variants[i].stock ?? 0)")).font(.subheadline).foregroundStyle(Theme.textMuted); Spacer()
                                    if let vid = p.variants[i].id { Button("−10") { Task { await adjust(vid, -10) } }.buttonStyle(.solSecondary); Button("+10") { Task { await adjust(vid, 10) } }.buttonStyle(.solSecondary) } }
                            }
                            if i < p.variants.count - 1 { Divider() }
                        }
                    }.card()
                    VStack(alignment: .leading, spacing: 10) {
                        Text(t("Hình ảnh", "Images")).font(.headline)
                        ScrollView(.horizontal) { HStack { ForEach(p.images ?? []) { img in
                            ZStack(alignment: .topTrailing) {
                                ProductImageView(url: ShopAPI.imageURL(img.url)).frame(width: 96, height: 96)
                                Button { Task { await removeImage(img.id) } } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.danger).background(Circle().fill(.white)) }.offset(x: 6, y: -6)
                            } } } }
                        PhotosPicker(selection: $photo, matching: .images) { Label(t("Thêm ảnh", "Add image"), systemImage: "photo.badge.plus") }.buttonStyle(.solSecondary)
                    }.card()
                    Button { Task { await save() } } label: { if busy { ProgressView() } else { Text(t("LƯU SẢN PHẨM", "SAVE PRODUCT")) } }.buttonStyle(.solPrimary).disabled(busy)
                    Button(role: .destructive) { confirmDelete = true } label: { Text(t("Xoá sản phẩm", "Delete product")) }.foregroundStyle(Theme.danger).frame(maxWidth: .infinity, minHeight: 44)
                } else if error == nil { ProgressView().frame(minHeight: 200) }
            }.padding(Metrics.pad)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(product?.name ?? t("Sản phẩm", "Product")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task { await load() }
        .onChange(of: photo) { _, item in Task { await upload(item) } }
        .confirmationDialog(t("Xoá sản phẩm này?", "Delete this product?"), isPresented: $confirmDelete, titleVisibility: .visible) {
            Button(t("Xoá", "Delete"), role: .destructive) { Task { do { try await ProductsAdminAPI.delete(productId); dismiss() } catch { self.error = error.localizedDescription } } }
        }
    }

    private func bind(_ kp: WritableKeyPath<AdminProduct, String>) -> Binding<String> { Binding(get: { product?[keyPath: kp] ?? "" }, set: { product?[keyPath: kp] = $0 }) }
    private func bindOpt(_ kp: WritableKeyPath<AdminProduct, String?>) -> Binding<String> { Binding(get: { product?[keyPath: kp] ?? "" }, set: { product?[keyPath: kp] = $0 }) }

    private func load() async { do { product = try await ProductsAdminAPI.get(productId) } catch { self.error = error.localizedDescription } }
    private func save() async {
        guard let p = product else { return }
        busy = true; error = nil; message = nil
        defer { busy = false }
        do { product = try await ProductsAdminAPI.save(id: p.id, p.upsert()); message = t("Đã lưu sản phẩm.", "Product saved.") } catch { self.error = error.localizedDescription }
    }
    private func adjust(_ variant: Int, _ delta: Int) async { do { try await ProductsAdminAPI.adjustStock(variant: variant, delta: delta); await load() } catch { self.error = error.localizedDescription } }
    private func removeImage(_ id: Int) async { do { product = try await ProductsAdminAPI.removeImage(productId, image: id) } catch { self.error = error.localizedDescription } }
    private func upload(_ item: PhotosPickerItem?) async {
        guard let item, let data = try? await item.loadTransferable(type: Data.self), let url = ImagePrep.dataURL(from: data) else { return }
        do { product = try await ProductsAdminAPI.addImage(productId, dataUrl: url, alt: product?.name ?? "") } catch { self.error = error.localizedDescription }
        photo = nil
    }
}

struct NewProductSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var shortDesc = ""
    @State private var desc = ""
    @State private var serving = ""
    @State private var form = "powder"
    @State private var categoryId = 0
    @State private var categories: [ShopCategory] = []
    @State private var sku = ""
    @State private var label = ""
    @State private var price = ""
    @State private var stock = "0"
    @State private var nutrients: [AdminNutrient] = []
    @State private var error: String?
    @State private var busy = false
    private let forms = ["powder", "capsule", "tablet", "liquid", "bar", "other"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    SOLField(label: t("Tên sản phẩm", "Name"), text: $name)
                    Picker(t("Loại", "Category"), selection: $categoryId) { ForEach(categories) { Text($0.name).tag($0.id) } }
                    Picker(t("Dạng", "Form"), selection: $form) { ForEach(forms, id: \.self) { Text($0).tag($0) } }
                    SOLField(label: t("Mô tả ngắn", "Short description"), text: $shortDesc)
                    SOLField(label: t("Mô tả", "Description"), text: $desc)
                    SOLField(label: t("Khẩu phần", "Serving size"), text: $serving)
                    Text(t("Phân loại đầu tiên", "First variant")).font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                    SOLField(label: "SKU", text: $sku)
                    SOLField(label: t("Nhãn (vị · khối lượng)", "Label"), text: $label)
                    SOLField(label: t("Giá (₫)", "Price (₫)"), text: $price, keyboard: .numberPad)
                    SOLField(label: t("Tồn kho ban đầu", "Initial stock"), text: $stock, keyboard: .numberPad)
                    Text(t("Thành phần dinh dưỡng", "Nutrition facts")).font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                    ForEach(nutrients.indices, id: \.self) { i in
                        HStack {
                            TextField(t("Tên", "Name"), text: Binding(get: { nutrients[i].name }, set: { nutrients[i].name = $0 })).textFieldStyle(.roundedBorder)
                            TextField(t("SL", "Amt"), text: Binding(get: { nutrients[i].amount == 0 ? "" : nutrients[i].amount.formatted() }, set: { nutrients[i].amount = Double($0) ?? 0 }), prompt: Text("0")).keyboardType(.decimalPad).textFieldStyle(.roundedBorder).frame(width: 64)
                            TextField(t("Đv", "Unit"), text: Binding(get: { nutrients[i].unit }, set: { nutrients[i].unit = $0 })).textFieldStyle(.roundedBorder).frame(width: 56)
                            Button { nutrients.remove(at: i) } label: { Image(systemName: "minus.circle").foregroundStyle(Theme.danger) }
                        }
                    }
                    Button { nutrients.append(AdminNutrient(name: "", amount: 0, unit: "g", dailyValuePercent: nil, subRow: false, highlight: false, sortOrder: nutrients.count)) } label: { Label(t("Thêm thành phần", "Add nutrient"), systemImage: "plus") }.buttonStyle(.solSecondary)
                    ErrorBanner(message: error)
                    Button { Task { await create() } } label: { if busy { ProgressView() } else { Text(t("TẠO SẢN PHẨM", "CREATE PRODUCT")) } }.buttonStyle(.solPrimary).disabled(busy || name.count < 2 || categoryId == 0 || sku.isEmpty || label.isEmpty || (Double(price) ?? 0) <= 0)
                }.padding(Metrics.pad)
            }.screenBackground()
            .navigationTitle(t("Sản phẩm mới", "New product")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
            .task { categories = (try? await ProductsAdminAPI.categories()) ?? []; categoryId = categories.first?.id ?? 0 }
        }
    }

    private func create() async {
        busy = true; error = nil
        defer { busy = false }
        let body = ProductUpsert(name: name, categoryId: categoryId, form: form, brand: nil, shortDescription: shortDesc, description: desc, servingSize: serving, usageInstructions: nil, warnings: nil, registrationNumber: nil, goals: [], active: false, featured: false,
                                 variants: [.init(id: nil, sku: sku, label: label, price: Double(price) ?? 0, servingsPerContainer: nil, initialStock: Int(stock) ?? 0, active: true, sortOrder: 0)],
                                 nutrients: nutrients.filter { !$0.name.isEmpty }.enumerated().map { .init(name: $1.name, amount: $1.amount, unit: $1.unit, dailyValuePercent: nil, subRow: false, highlight: false, sortOrder: $0) })
        do { _ = try await ProductsAdminAPI.save(id: nil, body); dismiss() } catch { self.error = error.localizedDescription }
    }
}


// MARK: - Categories

struct AdminCategory: Decodable, Identifiable, Hashable { let id: Int; let name: String; let slug: String?; let sortOrder: Int; let active: Bool; let productCount: Int? }
private struct CategoryBody: Encodable { let name: String; let sortOrder: Int; let active: Bool }

struct CategoriesAdminView: View {
    @State private var loader = Loader { try await APIClient.shared.get("/manager/product-categories") as [AdminCategory] }
    @State private var editing: AdminCategory?
    @State private var creating = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                ErrorBanner(message: error)
                LoadView(loader) { list in
                    ForEach(list) { c in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) { Text(c.name).font(.headline).foregroundStyle(Theme.text); Text(t("\(c.productCount ?? 0) sản phẩm", "\(c.productCount ?? 0) products")).font(.caption).foregroundStyle(Theme.textMuted) }
                            Spacer()
                            if !c.active { Pill(text: t("Đang ẩn", "Hidden"), tone: .neutral) }
                            Button(t("Sửa", "Edit")) { editing = c }.buttonStyle(.solSecondary)
                            Button(role: .destructive) { Task { do { let _: Empty? = try await APIClient.shared.delete("/manager/product-categories/\(c.id)"); await loader.load(silent: true) } catch { self.error = error.localizedDescription } } } label: { Image(systemName: "trash") }.foregroundStyle(Theme.danger)
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { creating = true } label: { Image(systemName: "plus") } } }
        .navigationTitle(t("Loại sản phẩm", "Product categories")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .sheet(item: $editing, onDismiss: { Task { await loader.load(silent: true) } }) { CategorySheet(existing: $0) }
        .sheet(isPresented: $creating, onDismiss: { Task { await loader.load(silent: true) } }) { CategorySheet(existing: nil) }
    }
}

struct CategorySheet: View {
    let existing: AdminCategory?
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var order = "0"
    @State private var active = true
    @State private var error: String?
    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                SOLField(label: t("Tên loại", "Name"), text: $name)
                SOLField(label: t("Thứ tự", "Sort order"), text: $order, keyboard: .numberPad)
                Toggle(t("Hiển thị", "Visible"), isOn: $active).tint(Theme.accent)
                ErrorBanner(message: error)
                Button(t("LƯU", "SAVE")) { Task { await save() } }.buttonStyle(.solPrimary).disabled(name.count < 2)
                Spacer()
            }.padding(Metrics.pad).screenBackground()
            .navigationTitle(existing == nil ? t("Loại mới", "New category") : t("Sửa loại", "Edit category")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
            .onAppear { if let e = existing { name = e.name; order = String(e.sortOrder); active = e.active } }
        }
    }
    private func save() async {
        let body = CategoryBody(name: name, sortOrder: Int(order) ?? 0, active: active)
        do { let _: AdminCategory = existing == nil ? try await APIClient.shared.post("/manager/product-categories", body: body) : try await APIClient.shared.put("/manager/product-categories/\(existing!.id)", body: body); dismiss() }
        catch { self.error = error.localizedDescription }
    }
}
