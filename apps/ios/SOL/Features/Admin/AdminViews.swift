import SwiftUI

// MARK: - Models & API

struct AdminUser: Decodable, Identifiable, Hashable {
    let id: Int; let roleCode: String; let fullName: String; let email: String?; let phone: String?
    let status: String; let createdAt: String?; let lastLoginAt: String?; let deletedAt: String?
    var locked: Bool { status != "active" }
}
struct RoleDto: Decodable { let id: Int; let code: String }
struct StaffAccount: Decodable, Identifiable, Hashable { let id: Int; let fullName: String; let email: String?; let phone: String?; let roleCode: String; let status: String }
struct CatalogRoom: Decodable, Identifiable, Hashable { let id: Int; let name: String; let location: String?; let capacity: Int?; let status: String; let disciplineName: String? }
struct EquipmentItem: Decodable, Identifiable, Hashable { let id: Int; let name: String; let code: String?; let category: String?; let roomName: String?; let quantity: Int; let status: String }
struct Discipline: Decodable, Identifiable, Hashable { let id: Int; let name: String; let description: String? }
struct PackageAdmin: Decodable, Identifiable, Hashable { let id: Int; let name: String; let description: String?; let price: Double; let durationDays: Int; let classCreditLimit: Int?; let status: String; let tier: String? }
struct AuditLog: Decodable, Identifiable, Hashable { let id: Int; let action: String?; let userFullName: String?; let entityType: String?; let entityId: Int?; let createdAt: String? }
struct AuditPage: Decodable { let content: [AuditLog] }

private struct StaffBody: Encodable { let fullName, email: String; let phone: String?; let password: String; let gender: String; let roleCode: String }
private struct StatusBody: Encodable { let status: String }
private struct PackageUpsert: Encodable { let name: String; let description: String?; let price: Double; let durationDays: Int; let classCreditLimit: Int?; let status: String }
private struct UserCreate: Encodable { let fullName, email: String; let phone: String?; let password: String; let roleId: Int }

enum AdminAPI {
    private static var c: APIClient { .shared }
    static func users() async throws -> [AdminUser] { try await c.get("/users") }
    static func toggleLock(_ u: AdminUser) async throws -> AdminUser { try await c.patch("/users/\(u.id)/\(u.locked ? "unlock" : "lock")") }
    static func deleteUser(_ id: Int) async throws { let _: Empty? = try await c.delete("/users/\(id)") }
    static func roles() async throws -> [RoleDto] { try await c.get("/roles") }
    static func createUser(name: String, email: String, phone: String?, password: String, roleId: Int) async throws -> AdminUser { try await c.post("/users", body: UserCreate(fullName: name, email: email, phone: phone, password: password, roleId: roleId)) }
    static func staff() async throws -> [StaffAccount] { try await c.get("/staff-accounts") }
    static func setStaffLock(_ id: Int, locked: Bool) async throws -> StaffAccount { try await c.patch("/staff-accounts/\(id)/\(locked ? "lock" : "unlock")") }
    static func createStaff(name: String, email: String, phone: String?, password: String, gender: String, role: String) async throws -> StaffAccount { try await c.post("/staff-accounts", body: StaffBody(fullName: name, email: email, phone: phone, password: password, gender: gender, roleCode: role)) }
    static func rooms() async throws -> [CatalogRoom] { try await c.get("/rooms") }
    static func equipment() async throws -> [EquipmentItem] { try await c.get("/equipment") }
    static func disciplines() async throws -> [Discipline] { try await c.get("/disciplines") }
    static func packages() async throws -> [PackageAdmin] { try await c.get("/packages") }
    static func setPackageStatus(_ id: Int, _ status: String) async throws -> PackageAdmin { try await c.patch("/packages/\(id)/status", body: StatusBody(status: status)) }
    static func savePackage(id: Int?, name: String, description: String?, price: Double, days: Int, credits: Int?) async throws -> PackageAdmin {
        let body = PackageUpsert(name: name, description: description, price: price, durationDays: days, classCreditLimit: credits, status: "active")
        return id == nil ? try await c.post("/packages", body: body) : try await c.put("/packages/\(id!)", body: body)
    }
    static func setEquipmentStatus(_ id: Int, _ status: String) async throws -> EquipmentItem { try await c.patch("/equipment/\(id)/status", body: StatusBody(status: status)) }
    static func auditLogs() async throws -> [AuditLog] { (try await c.get("/admin/audit-logs", query: ["page": "0", "size": "40"]) as AuditPage).content }
}

func roleName(_ code: String) -> String {
    switch code { case "MEMBER": t("Hội viên", "Member"); case "COACH": t("Huấn luyện viên", "Coach"); case "RECEPTIONIST": t("Lễ tân", "Receptionist"); case "CENTER_MANAGER": t("Quản lý", "Manager"); case "ADMIN": "Admin"; default: code }
}

// MARK: - Hub

struct AdminHubView: View {
    @Environment(AuthStore.self) private var auth
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                MoreLink(icon: "person.2", title: t("Người dùng", "Users")) { UsersAdminView() }
                MoreLink(icon: "person.badge.key", title: t("Tài khoản nhân viên", "Staff accounts")) { StaffAccountsView() }
                MoreLink(icon: "figure.strengthtraining.traditional", title: t("Phân công huấn luyện viên", "Coach assignments")) { CoachAssignmentsView() }
                MoreLink(icon: "creditcard", title: t("Gói tập", "Membership plans")) { PackagesAdminView() }
                MoreLink(icon: "bag", title: t("Sản phẩm", "Products")) { ProductsAdminView() }
                if auth.user?.role == .admin { MoreLink(icon: "lock.shield", title: t("Phân quyền vai trò", "Role permissions")) { RolePermissionsView() } }
                MoreLink(icon: "square.grid.2x2", title: t("Phòng & môn tập", "Rooms & disciplines")) { RoomsAdminView() }
                MoreLink(icon: "dumbbell", title: t("Thiết bị", "Equipment")) { EquipmentAdminView() }
                if auth.user?.role == .admin { MoreLink(icon: "list.bullet.clipboard", title: t("Nhật ký hệ thống", "Audit logs")) { AuditLogsView() } }
            }.padding(Metrics.pad)
        }.navigationTitle(t("Quản trị", "Administration")).navigationBarTitleDisplayMode(.inline).screenBackground()
    }
}

// MARK: - Users

struct UsersAdminView: View {
    @State private var loader = Loader { try await AdminAPI.users() }
    @State private var query = ""
    @State private var error: String?
    @State private var creating = false
    @State private var confirmDelete: AdminUser?

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                ErrorBanner(message: error)
                LoadView(loader) { all in
                    let list = all.filter { query.isEmpty || $0.fullName.localizedCaseInsensitiveContains(query) || ($0.email ?? "").localizedCaseInsensitiveContains(query) }
                    if list.isEmpty { EmptyState(icon: "person.slash", title: t("Không có người dùng", "No users")).card() }
                    ForEach(list.filter { $0.deletedAt == nil }) { u in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 12) { Avatar(name: u.fullName, size: 40)
                                VStack(alignment: .leading) { Text(u.fullName).font(.headline).foregroundStyle(Theme.text); Text(u.email ?? "").font(.caption).foregroundStyle(Theme.textMuted) }
                                Spacer(); Pill(text: roleName(u.roleCode), tone: .accent) }
                            HStack { Pill(text: u.locked ? t("Đã khoá", "Locked") : t("Hoạt động", "Active"), tone: u.locked ? .danger : .success); Spacer()
                                Button(u.locked ? t("Mở khoá", "Unlock") : t("Khoá", "Lock")) { Task { await run { _ = try await AdminAPI.toggleLock(u) } } }.buttonStyle(.solSecondary)
                                Button(role: .destructive) { confirmDelete = u } label: { Image(systemName: "trash") }.foregroundStyle(Theme.danger) }
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .searchable(text: $query, prompt: t("Tìm người dùng", "Search users"))
        .refreshable { await loader.load(silent: true) }
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { creating = true } label: { Image(systemName: "plus") } } }
        .navigationTitle(t("Người dùng", "Users")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .confirmationDialog(t("Xoá tài khoản này?", "Delete this account?"), isPresented: Binding(get: { confirmDelete != nil }, set: { if !$0 { confirmDelete = nil } }), titleVisibility: .visible) {
            Button(t("Xoá (có thể khôi phục)", "Delete (restorable)"), role: .destructive) { if let u = confirmDelete { Task { await run { try await AdminAPI.deleteUser(u.id) } } } }
        }
        .sheet(isPresented: $creating, onDismiss: { Task { await loader.load(silent: true) } }) { CreateUserSheet() }
    }
    private func run(_ a: () async throws -> Void) async { error = nil; do { try await a(); await loader.load(silent: true) } catch { self.error = error.localizedDescription } }
}

struct CreateUserSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var password = ""
    @State private var role = "MEMBER"
    @State private var roles: [RoleDto] = []
    @State private var error: String?
    @State private var busy = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    SOLField(label: t("Họ và tên", "Full name"), text: $name)
                    SOLField(label: "Email", text: $email, keyboard: .emailAddress)
                    SOLField(label: t("Số điện thoại", "Phone"), text: $phone, keyboard: .phonePad)
                    SOLField(label: t("Mật khẩu", "Password"), text: $password, secure: true)
                    Picker(t("Vai trò", "Role"), selection: $role) { ForEach(roles, id: \.code) { Text(roleName($0.code)).tag($0.code) } }
                    ErrorBanner(message: error)
                    Button { Task { await create() } } label: { if busy { ProgressView() } else { Text(t("TẠO TÀI KHOẢN", "CREATE ACCOUNT")) } }.buttonStyle(.solPrimary).disabled(busy || name.count < 2 || !Validate.email(email) || password.count < 6)
                }.padding(Metrics.pad)
            }.screenBackground()
            .navigationTitle(t("Tài khoản mới", "New account")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
            .task { roles = (try? await AdminAPI.roles()) ?? [] }
        }
    }
    private func create() async {
        guard let rid = roles.first(where: { $0.code == role })?.id else { return }
        busy = true; error = nil
        defer { busy = false }
        do { _ = try await AdminAPI.createUser(name: name, email: email, phone: phone.nilIfEmpty, password: password, roleId: rid); dismiss() } catch { self.error = error.localizedDescription }
    }
}

struct StaffAccountsView: View {
    @State private var loader = Loader { try await AdminAPI.staff() }
    @State private var error: String?
    @State private var creating = false
    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                ErrorBanner(message: error)
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "person.slash", title: t("Chưa có tài khoản nhân viên", "No staff accounts")).card() }
                    ForEach(list) { s in
                        HStack { VStack(alignment: .leading, spacing: 3) { Text(s.fullName).font(.headline).foregroundStyle(Theme.text); Text(roleName(s.roleCode) + (s.email.map { " · \($0)" } ?? "")).font(.caption).foregroundStyle(Theme.textMuted) }
                            Spacer()
                            Button(s.status == "active" ? t("Khoá", "Lock") : t("Mở khoá", "Unlock")) { Task { do { _ = try await AdminAPI.setStaffLock(s.id, locked: s.status == "active"); await loader.load(silent: true) } catch { self.error = error.localizedDescription } } }.buttonStyle(.solSecondary) }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { creating = true } label: { Image(systemName: "plus") } } }
        .navigationTitle(t("Tài khoản nhân viên", "Staff accounts")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .sheet(isPresented: $creating, onDismiss: { Task { await loader.load(silent: true) } }) { CreateStaffSheet() }
    }
}

struct CreateStaffSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var password = ""
    @State private var gender = "other"
    @State private var role = "RECEPTIONIST"
    @State private var error: String?
    @State private var busy = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    SOLField(label: t("Họ và tên", "Full name"), text: $name)
                    SOLField(label: "Email", text: $email, keyboard: .emailAddress)
                    SOLField(label: t("Số điện thoại", "Phone"), text: $phone, keyboard: .phonePad)
                    SOLField(label: t("Mật khẩu", "Password"), text: $password, secure: true)
                    Picker(t("Vai trò", "Role"), selection: $role) { Text(roleName("RECEPTIONIST")).tag("RECEPTIONIST"); Text(roleName("COACH")).tag("COACH") }.pickerStyle(.segmented)
                    Picker(t("Giới tính", "Gender"), selection: $gender) { Text(t("Nam", "Male")).tag("male"); Text(t("Nữ", "Female")).tag("female"); Text(t("Khác", "Other")).tag("other") }.pickerStyle(.segmented)
                    ErrorBanner(message: error)
                    Button { Task { busy = true; defer { busy = false }; do { _ = try await AdminAPI.createStaff(name: name, email: email, phone: phone.nilIfEmpty, password: password, gender: gender, role: role); dismiss() } catch { self.error = error.localizedDescription } } } label: { if busy { ProgressView() } else { Text(t("TẠO TÀI KHOẢN", "CREATE ACCOUNT")) } }.buttonStyle(.solPrimary).disabled(busy || name.count < 2 || !Validate.email(email) || password.count < 6)
                }.padding(Metrics.pad)
            }.screenBackground()
            .navigationTitle(t("Nhân viên mới", "New staff")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
        }
    }
}

// MARK: - Catalogs

struct PackagesAdminView: View {
    @State private var loader = Loader { try await AdminAPI.packages() }
    @State private var editing: PackageAdmin?
    @State private var creating = false
    @State private var error: String?
    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                ErrorBanner(message: error)
                LoadView(loader) { list in
                    ForEach(list) { p in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Text(p.name).font(.headline).foregroundStyle(Theme.text); Spacer(); Pill(text: p.status == "active" ? t("Đang bán", "Active") : t("Tạm ngưng", "Inactive"), tone: p.status == "active" ? .success : .neutral) }
                            LabeledRow(label: t("Giá", "Price"), value: Fmt.money(p.price))
                            LabeledRow(label: t("Thời hạn", "Duration"), value: t("\(p.durationDays) ngày", "\(p.durationDays) days"))
                            if let c = p.classCreditLimit { LabeledRow(label: t("Khoá học miễn phí", "Free courses"), value: "\(c)") }
                            HStack { Button(t("Sửa", "Edit")) { editing = p }.buttonStyle(.solSecondary)
                                Button(p.status == "active" ? t("Ngưng bán", "Deactivate") : t("Mở bán", "Activate")) { Task { do { _ = try await AdminAPI.setPackageStatus(p.id, p.status == "active" ? "inactive" : "active"); await loader.load(silent: true) } catch { self.error = error.localizedDescription } } }.buttonStyle(.solSecondary) }
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { creating = true } label: { Image(systemName: "plus") } } }
        .navigationTitle(t("Gói tập", "Membership plans")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .sheet(item: $editing, onDismiss: { Task { await loader.load(silent: true) } }) { PackageEditSheet(existing: $0) }
        .sheet(isPresented: $creating, onDismiss: { Task { await loader.load(silent: true) } }) { PackageEditSheet(existing: nil) }
    }
}

struct PackageEditSheet: View {
    let existing: PackageAdmin?
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var desc = ""
    @State private var price = ""
    @State private var days = "30"
    @State private var credits = ""
    @State private var error: String?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    SOLField(label: t("Tên gói", "Plan name"), text: $name)
                    SOLField(label: t("Mô tả", "Description"), text: $desc)
                    SOLField(label: t("Giá (₫)", "Price (₫)"), text: $price, keyboard: .numberPad)
                    SOLField(label: t("Số ngày", "Days"), text: $days, keyboard: .numberPad)
                    SOLField(label: t("Số khoá học miễn phí", "Free course credits"), text: $credits, keyboard: .numberPad)
                    ErrorBanner(message: error)
                    Button(t("LƯU", "SAVE")) { Task { do { _ = try await AdminAPI.savePackage(id: existing?.id, name: name, description: desc.nilIfEmpty, price: Double(price) ?? 0, days: Int(days) ?? 30, credits: Int(credits)); dismiss() } catch { self.error = error.localizedDescription } } }.buttonStyle(.solPrimary).disabled(name.count < 2 || (Double(price) ?? 0) <= 0 || (Int(days) ?? 0) <= 0)
                }.padding(Metrics.pad)
            }.screenBackground()
            .navigationTitle(existing == nil ? t("Gói mới", "New plan") : t("Sửa gói", "Edit plan")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
            .onAppear { if let e = existing { name = e.name; desc = e.description ?? ""; price = String(Int(e.price)); days = String(e.durationDays); credits = e.classCreditLimit.map(String.init) ?? "" } }
        }
    }
}

struct RoomsAdminView: View {
    @State private var rooms = Loader { try await AdminAPI.rooms() }
    @State private var disciplines = Loader { try await AdminAPI.disciplines() }
    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                SectionTitle(t("Phòng / sân", "Rooms & courts"))
                LoadView(rooms) { list in
                    ForEach(list) { r in
                        HStack { VStack(alignment: .leading, spacing: 3) { Text(r.name).font(.headline).foregroundStyle(Theme.text); Text([r.disciplineName, r.location].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(Theme.textMuted) }
                            Spacer(); if let c = r.capacity { Label("\(c)", systemImage: "person.2").font(.caption) }
                            Pill(text: r.status, tone: r.status == "available" ? .success : .warning) }.card()
                    }
                }
                SectionTitle(t("Môn tập", "Disciplines"))
                LoadView(disciplines) { list in ForEach(list) { d in VStack(alignment: .leading, spacing: 3) { Text(d.name).font(.headline).foregroundStyle(Theme.text); if let x = d.description { Text(x).font(.caption).foregroundStyle(Theme.textMuted) } }.card() } }
            }.padding(Metrics.pad)
        }
        .refreshable { await rooms.load(silent: true); await disciplines.load(silent: true) }
        .navigationTitle(t("Phòng & môn tập", "Rooms & disciplines")).navigationBarTitleDisplayMode(.inline).screenBackground()
    }
}

struct EquipmentAdminView: View {
    @State private var loader = Loader { try await AdminAPI.equipment() }
    @State private var error: String?
    private let statuses = ["active", "maintenance", "broken", "retired"]
    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                ErrorBanner(message: error)
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "dumbbell", title: t("Chưa có thiết bị", "No equipment")).card() }
                    ForEach(list) { e in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Text(e.name).font(.headline).foregroundStyle(Theme.text); Spacer(); Text("×\(e.quantity)").foregroundStyle(Theme.textMuted) }
                            Text([e.category, e.roomName, e.code].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(Theme.textMuted)
                            Picker("", selection: Binding(get: { e.status }, set: { s in Task { do { _ = try await AdminAPI.setEquipmentStatus(e.id, s); await loader.load(silent: true) } catch { self.error = error.localizedDescription } } })) { ForEach(statuses, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu)
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Thiết bị", "Equipment")).navigationBarTitleDisplayMode(.inline).screenBackground()
    }
}

struct AuditLogsView: View {
    @State private var loader = Loader { try await AdminAPI.auditLogs() }
    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "list.bullet", title: t("Chưa có nhật ký", "No audit logs")).card() }
                    ForEach(list) { l in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(l.action ?? "—").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                            Text([l.userFullName, l.entityType.map { "\($0)#\(l.entityId ?? 0)" }, l.createdAt.map { Fmt.dayTime($0) }].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(Theme.textMuted)
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Nhật ký hệ thống", "Audit logs")).navigationBarTitleDisplayMode(.inline).screenBackground()
    }
}

// MARK: - Role permissions

struct PermissionDto: Decodable, Identifiable, Hashable { let id: Int; let code: String; let name: String? }

struct RolePermissionsView: View {
    @State private var roles: [RoleDto] = []
    @State private var perms: [PermissionDto] = []
    @State private var granted: [Int: Set<Int>] = [:]
    @State private var role: RoleDto?
    @State private var loaded = false
    @State private var error: String?

    private let core = ["MEMBER", "COACH", "RECEPTIONIST", "CENTER_MANAGER"]

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if !loaded { ProgressView().frame(minHeight: 160) }
                ErrorBanner(message: error)
                if loaded {
                    Picker("", selection: $role) { ForEach(roles, id: \.id) { Text(roleName($0.code)).tag(Optional($0)) } }.pickerStyle(.menu)
                    if let role {
                        ForEach(perms) { p in
                            Toggle(isOn: Binding(get: { granted[role.id]?.contains(p.id) == true }, set: { on in Task { await toggle(role, p, on: on) } })) {
                                VStack(alignment: .leading, spacing: 2) { Text(p.name ?? p.code).foregroundStyle(Theme.text); Text(p.code).font(.caption).foregroundStyle(Theme.textMuted) }
                            }.tint(Theme.accent).card()
                        }
                    }
                }
            }.padding(Metrics.pad)
        }
        .navigationTitle(t("Phân quyền vai trò", "Role permissions")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task { await load() }
    }

    private func load() async {
        do {
            let all = try await AdminAPI.roles()
            roles = all.filter { core.contains($0.code) }
            perms = try await APIClient.shared.get("/roles/permissions")
            for r in roles { let list: [PermissionDto] = try await APIClient.shared.get("/roles/\(r.id)/permissions"); granted[r.id] = Set(list.map(\.id)) }
            role = roles.first; loaded = true
        } catch { self.error = error.localizedDescription; loaded = true }
    }

    private func toggle(_ r: RoleDto, _ p: PermissionDto, on: Bool) async {
        error = nil
        do {
            let _: Empty? = on ? try await APIClient.shared.put("/roles/\(r.id)/permissions/\(p.id)") : try await APIClient.shared.delete("/roles/\(r.id)/permissions/\(p.id)")
            if on { granted[r.id, default: []].insert(p.id) } else { granted[r.id]?.remove(p.id) }
        } catch { self.error = error.localizedDescription }
    }
}
extension RoleDto: Hashable {}

// MARK: - Coach assignments

struct AssignedStudent: Decodable, Identifiable, Hashable {
    let memberId: Int; let membershipCode: String?; let fullName: String
    let assignmentType: String; let assignmentTypeLabel: String?; let detail: String?; let status: String?; let referenceId: Int
    var id: String { "\(memberId)-\(assignmentType)-\(referenceId)" }
}
struct CoachOverview: Decodable, Identifiable, Hashable {
    let coachId: Int; let coachName: String; let specialization: String?; let employmentStatus: String?
    let totalStudentsCount: Int; let students: [AssignedStudent]
    var id: Int { coachId }
}
struct CoachAssignmentData: Decodable { let coaches: [CoachOverview] }
private struct ReassignBody: Encodable { let memberId: Int; let fromCoachId: Int; let toCoachId: Int; let referenceId: Int; let assignmentType: String; let reason: String? }

struct CoachAssignmentsView: View {
    @State private var loader = Loader { try await APIClient.shared.get("/manager/coach-assignments") as CoachAssignmentData }
    @State private var moving: (AssignedStudent, CoachOverview)?
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ErrorBanner(message: error)
                LoadView(loader) { d in
                    if d.coaches.isEmpty { EmptyState(icon: "person.2", title: t("Chưa có huấn luyện viên", "No coaches")).card() }
                    ForEach(d.coaches) { c in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Avatar(name: c.coachName, size: 38); VStack(alignment: .leading) { Text(c.coachName).font(.headline).foregroundStyle(Theme.text); Text(c.specialization ?? "").font(.caption).foregroundStyle(Theme.textMuted) }
                                Spacer(); Pill(text: t("\(c.totalStudentsCount) học viên", "\(c.totalStudentsCount) members"), tone: .accent) }
                            ForEach(c.students) { s in
                                Divider()
                                HStack { VStack(alignment: .leading, spacing: 2) { Text(s.fullName).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text); Text((s.assignmentTypeLabel ?? s.assignmentType) + (s.detail.map { " · \($0)" } ?? "")).font(.caption).foregroundStyle(Theme.textMuted) }
                                    Spacer()
                                    if s.assignmentType != "CLASS" { Button(t("Chuyển", "Move")) { moving = (s, c) }.font(.footnote.weight(.semibold)).foregroundStyle(Theme.accentText) }
                                    if s.assignmentType == "TRAINING_PLAN" { Button(role: .destructive) { Task { await remove(s) } } label: { Image(systemName: "trash") }.foregroundStyle(Theme.danger) } }
                            }
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Phân công huấn luyện viên", "Coach assignments")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .confirmationDialog(t("Chuyển học viên sang huấn luyện viên", "Move member to coach"), isPresented: Binding(get: { moving != nil }, set: { if !$0 { moving = nil } }), titleVisibility: .visible) {
            if let (s, from) = moving { ForEach((loader.value?.coaches ?? []).filter { $0.coachId != from.coachId }) { c in Button(c.coachName) { Task { await move(s, from: from, to: c) } } } }
        }
    }

    private func move(_ s: AssignedStudent, from: CoachOverview, to: CoachOverview) async {
        error = nil
        do { let _: Empty? = try await APIClient.shared.post("/manager/coach-assignments/reassign", body: ReassignBody(memberId: s.memberId, fromCoachId: from.coachId, toCoachId: to.coachId, referenceId: s.referenceId, assignmentType: s.assignmentType, reason: nil)); await loader.load(silent: true) }
        catch { self.error = error.localizedDescription }
    }
    private func remove(_ s: AssignedStudent) async {
        error = nil
        do { let _: Empty? = try await APIClient.shared.delete("/manager/coach-assignments/\(s.referenceId)"); await loader.load(silent: true) } catch { self.error = error.localizedDescription }
    }
}
