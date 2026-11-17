import Foundation
import SwiftUI

enum Role: String, Codable {
    case member = "MEMBER", staff = "RECEPTIONIST", coach = "COACH", manager = "CENTER_MANAGER", admin = "ADMIN"
}

struct SessionUser: Codable, Equatable {
    var username: String
    var fullName: String
    var role: Role
}

private struct LoginRequest: Encodable { let username: String; let password: String }
struct AuthResponse: Decodable { let token: String; let username: String; let role: String; let fullName: String? }
private struct MeResponse: Decodable { let username: String?; let role: String?; let fullName: String? }

/// Trạng thái đăng nhập toàn app. Token trong Keychain, thông tin hiển thị trong UserDefaults.
@MainActor @Observable
final class AuthStore {
    var user: SessionUser?
    var expired = false

    init() {
        if APIClient.shared.token != nil, let data = UserDefaults.standard.data(forKey: "sol_user"),
           let saved = try? JSONDecoder().decode(SessionUser.self, from: data) { user = saved }
        #if DEBUG
        if let role = Demo.role { user = SessionUser(username: "demo", fullName: "Nguyễn Minh Anh", role: role) }
        #endif
        APIClient.shared.onUnauthorized = { [weak self] in Task { @MainActor in self?.signOut(expired: true) } }
    }

    func signIn(identifier: String, password: String) async throws {
        let res: AuthResponse = try await APIClient.shared.post("/auth/login", body: LoginRequest(username: identifier.trimmingCharacters(in: .whitespaces), password: password))
        try apply(res)
    }

    func apply(_ res: AuthResponse) throws {
        guard let role = Role(rawValue: res.role) else {
            throw APIError(status: 403, code: nil, message: t("Vai trò tài khoản chưa được hỗ trợ trên ứng dụng.", "This account role is not supported in the app."))
        }
        APIClient.shared.token = res.token
        let u = SessionUser(username: res.username, fullName: res.fullName?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? res.username, role: role)
        UserDefaults.standard.set(try? JSONEncoder().encode(u), forKey: "sol_user")
        expired = false
        user = u
    }

    /// Đối chiếu role với server (admin có thể đổi vai trò); lỗi mạng bị bỏ qua.
    func syncWithServer() async {
        guard let current = user, let me: MeResponse = try? await APIClient.shared.get("/auth/me") else { return }
        guard let raw = me.role, let role = Role(rawValue: raw) else { signOut(expired: false); return }
        let updated = SessionUser(username: me.username ?? current.username, fullName: me.fullName?.nilIfEmpty ?? current.fullName, role: role)
        if updated != current {
            user = updated
            UserDefaults.standard.set(try? JSONEncoder().encode(updated), forKey: "sol_user")
        }
    }

    func signOut(expired: Bool = false) {
        APIClient.shared.token = nil
        UserDefaults.standard.removeObject(forKey: "sol_user")
        self.expired = expired
        user = nil
    }
}

extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
