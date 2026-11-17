import SwiftUI

@Observable
final class Appearance {
    static let shared = Appearance()
    /// "system" | "light" | "dark"
    var mode: String { didSet { UserDefaults.standard.set(mode, forKey: "sol_appearance") } }
    private init() { mode = UserDefaults.standard.string(forKey: "sol_appearance") ?? "system" }
    var scheme: ColorScheme? { mode == "light" ? .light : mode == "dark" ? .dark : nil }
}

@main
struct SOLApp: App {
    @State private var auth = AuthStore()
    @State private var lang = Lang.shared
    @State private var appearance = Appearance.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .id(lang.code) // đổi ngôn ngữ → dựng lại toàn bộ chuỗi
                .preferredColorScheme(appearance.scheme)
                .tint(Theme.accent)
        }
    }
}

struct RootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.scenePhase) private var phase

    var body: some View {
        Group {
            if let user = auth.user {
                RoleShell(user: user)
                    .task { await auth.syncWithServer() }
            } else {
                AuthFlow()
            }
        }
        .onChange(of: phase) { _, new in if new == .active, auth.user != nil { Task { await auth.syncWithServer() } } }
        .animation(.default, value: auth.user)
    }
}

/// Chọn bộ tab theo role; kiểm tra quyền thật vẫn ở backend.
struct RoleShell: View {
    let user: SessionUser
    var body: some View {
        switch user.role {
        case .member: MemberTabs()
        case .staff: StaffTabs()
        case .coach: CoachTabs()
        case .manager, .admin: ManagerTabs()
        }
    }
}
