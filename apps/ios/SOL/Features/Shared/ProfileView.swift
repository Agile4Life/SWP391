import SwiftUI

/// Hồ sơ cá nhân dùng chung: đọc – sửa các trường cơ bản – đổi mật khẩu.
struct ProfileView: View {
    @Environment(AuthStore.self) private var auth
    @State private var values: [String: JSONValue] = [:]
    @State private var loaded = false
    @State private var loadError: String?
    @State private var busy = false
    @State private var message: String?
    @State private var isError = false
    @State private var currentPw = ""
    @State private var newPw = ""

    private func binding(_ key: String) -> Binding<String> {
        Binding(get: { values[key]?.stringValue ?? "" }, set: { values[key] = $0.isEmpty ? .null : .string($0) })
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if let loadError { ErrorState(message: loadError) { Task { await load() } } }
                else if !loaded { ProgressView().frame(minHeight: 200) }
                else {
                    VStack(spacing: 14) {
                        Avatar(name: values["fullName"]?.stringValue ?? "?", url: values["avatarUrl"]?.stringValue.nilIfEmpty, size: 84)
                        if let code = values["membershipCode"]?.stringValue.nilIfEmpty { Pill(text: code, tone: .accent) }
                        SOLField(label: t("Họ và tên", "Full name"), text: binding("fullName"), contentType: .name)
                        SOLField(label: "Email", text: binding("email"), keyboard: .emailAddress, contentType: .emailAddress)
                        SOLField(label: t("Số điện thoại", "Phone"), text: binding("phone"), keyboard: .phonePad, contentType: .telephoneNumber)
                        SOLField(label: t("Địa chỉ", "Address"), text: binding("address"), contentType: .fullStreetAddress)
                        if auth.user?.role == .member {
                            SOLField(label: t("Mục tiêu tập luyện", "Fitness goal"), text: binding("fitnessGoal"))
                            SOLField(label: t("Ghi chú sức khoẻ", "Health notes"), text: binding("healthNotes"))
                            SOLField(label: t("Người liên hệ khẩn cấp", "Emergency contact"), text: binding("emergencyContactName"))
                            SOLField(label: t("SĐT khẩn cấp", "Emergency phone"), text: binding("emergencyContactPhone"), keyboard: .phonePad)
                        }
                        if auth.user?.role == .coach {
                            SOLField(label: t("Chuyên môn", "Specialization"), text: binding("specialization"))
                            SOLField(label: t("Giới thiệu", "Bio"), text: binding("bio"))
                            SOLField(label: t("Chứng chỉ", "Certification"), text: binding("certification"))
                        }
                        message.map { m in Group { if isError { ErrorBanner(message: m) } else { Text(m).foregroundStyle(Theme.success).font(.subheadline) } } }
                        Button { Task { await save() } } label: { if busy { ProgressView() } else { Text(t("LƯU THAY ĐỔI", "SAVE CHANGES")) } }.buttonStyle(.solPrimary).disabled(busy)
                    }.card()
                    VStack(spacing: 12) {
                        Text(t("Đổi mật khẩu", "Change password")).font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                        SOLField(label: t("Mật khẩu hiện tại", "Current password"), text: $currentPw, secure: true, contentType: .password)
                        SOLField(label: t("Mật khẩu mới", "New password"), text: $newPw, secure: true, contentType: .newPassword)
                        Button(t("Đổi mật khẩu", "Change password")) { Task { await changePw() } }.buttonStyle(.solSecondary).disabled(busy || currentPw.isEmpty || newPw.count < 6)
                    }.card()
                }
                SettingsSection()
            }.padding(Metrics.pad)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(t("Hồ sơ", "Profile")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task { await load() }
    }

    private func load() async {
        loadError = nil
        do { values = try await MemberAPI.rawProfile(); loaded = true } catch { loadError = error.localizedDescription }
    }

    private func save() async {
        if let phone = values["phone"]?.stringValue.nilIfEmpty, !Validate.phone(phone) { isError = true; message = t("Số điện thoại không hợp lệ.", "Invalid phone number."); return }
        busy = true; message = nil
        defer { busy = false }
        do {
            values = try await MemberAPI.saveProfile(values)
            if let name = values["fullName"]?.stringValue.nilIfEmpty, var u = auth.user { u.fullName = name; auth.user = u; UserDefaults.standard.set(try? JSONEncoder().encode(u), forKey: "sol_user") }
            isError = false; message = t("Đã lưu hồ sơ.", "Profile saved.")
        } catch { isError = true; message = error.localizedDescription }
    }

    private func changePw() async {
        busy = true; message = nil
        defer { busy = false }
        do { try await MemberAPI.changePassword(current: currentPw, new: newPw); currentPw = ""; newPw = ""; isError = false; message = t("Đã đổi mật khẩu.", "Password changed.") }
        catch { isError = true; message = error.localizedDescription }
    }
}
