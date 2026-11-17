import SwiftUI

/// Cài đặt chung mọi role: ngôn ngữ, giao diện, đăng xuất.
struct SettingsSection: View {
    @Environment(AuthStore.self) private var auth
    @State private var lang = Lang.shared
    @State private var appearance = Appearance.shared
    @State private var confirmLogout = false

    var body: some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                Text(t("Ngôn ngữ", "Language")).font(.subheadline.weight(.semibold))
                Picker("", selection: $lang.code) { Text("Tiếng Việt").tag("vi"); Text("English").tag("en") }.pickerStyle(.segmented)
                Text(t("Giao diện", "Appearance")).font(.subheadline.weight(.semibold))
                Picker("", selection: $appearance.mode) {
                    Text(t("Theo hệ thống", "System")).tag("system"); Text(t("Sáng", "Light")).tag("light"); Text(t("Tối", "Dark")).tag("dark")
                }.pickerStyle(.segmented)
            }.card()
            Button(role: .destructive) { confirmLogout = true } label: {
                Label(t("Đăng xuất", "Sign out"), systemImage: "rectangle.portrait.and.arrow.right").frame(maxWidth: .infinity, minHeight: 44)
            }
            .foregroundStyle(Theme.danger).card()
            .confirmationDialog(t("Đăng xuất khỏi SÖL?", "Sign out of SÖL?"), isPresented: $confirmLogout, titleVisibility: .visible) {
                Button(t("Đăng xuất", "Sign out"), role: .destructive) { auth.signOut() }
            }
        }
    }
}
