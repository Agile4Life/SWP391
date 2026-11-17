import SwiftUI
import AuthenticationServices
import CryptoKit

private struct HandoffBody: Encodable { let code: String; let verifier: String }
private struct GoogleOtpBody: Encodable { let email: String; let otpCode: String }

/// Đăng nhập Google qua `ASWebAuthenticationSession` (Google chặn WebView nhúng): mở `/auth/google/authorize?client=ios`,
/// backend chuyển về `solapp://login#google_login_code=…`; đổi mã một lần bằng PKCE verifier giữ trong app.
@MainActor
final class GoogleSignIn: NSObject, ASWebAuthenticationPresentationContextProviding {
    enum Outcome { case signedIn(AuthResponse), needsOtp(email: String), failed(String), cancelled }

    private var session: ASWebAuthenticationSession?

    func start() async -> Outcome {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let verifier = Self.b64url(Data(bytes))
        let challenge = Self.b64url(Data(SHA256.hash(data: Data(verifier.utf8))))
        var comps = URLComponents(url: Config.apiBase.appendingPathComponent("/auth/google/authorize"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "code_challenge", value: challenge), URLQueryItem(name: "client", value: "ios")]

        let callback: URL? = await withCheckedContinuation { cont in
            let s = ASWebAuthenticationSession(url: comps.url!, callbackURLScheme: "solapp") { url, _ in cont.resume(returning: url) }
            s.presentationContextProvider = self
            s.prefersEphemeralWebBrowserSession = true
            session = s
            if !s.start() { cont.resume(returning: nil) }
        }
        session = nil
        guard let callback, let comps = URLComponents(url: callback, resolvingAgainstBaseURL: false) else { return .cancelled }
        let q = Dictionary(uniqueKeysWithValues: (comps.queryItems ?? []).compactMap { i in i.value.map { (i.name, $0) } })
        switch q["google_oauth"] {
        case "authenticated":
            guard let frag = comps.fragment, frag.hasPrefix("google_login_code=") else { return .failed(t("Phản hồi Google không hợp lệ.", "Invalid Google response.")) }
            let code = String(frag.dropFirst("google_login_code=".count))
            do { return .signedIn(try await APIClient.shared.post("/auth/google/handoff", body: HandoffBody(code: code, verifier: verifier))) }
            catch { return .failed(error.localizedDescription) }
        case "callback": return q["email"].map { .needsOtp(email: $0) } ?? .failed(t("Phản hồi Google không hợp lệ.", "Invalid Google response."))
        case "not_configured": return .failed(t("Máy chủ chưa cấu hình đăng nhập Google.", "Google sign-in is not configured on the server."))
        default: return .failed(q["error"] ?? t("Đăng nhập Google thất bại.", "Google sign-in failed."))
        }
    }

    static func verifyOtp(email: String, code: String) async throws -> AuthResponse {
        try await APIClient.shared.post("/auth/google/verify-otp", body: GoogleOtpBody(email: email, otpCode: code))
    }

    private static func b64url(_ d: Data) -> String { d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
    }
}

struct GoogleOtpSheet: View {
    let email: String
    let onSignedIn: (AuthResponse) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                Text(t("Chúng tôi đã gửi mã OTP tới \(email). Nhập mã để kích hoạt tài khoản.", "We sent an OTP to \(email). Enter it to activate your account.")).font(.subheadline).foregroundStyle(Theme.textMuted)
                SOLField(label: t("Mã OTP", "OTP code"), text: $code, keyboard: .numberPad, contentType: .oneTimeCode)
                ErrorBanner(message: error)
                Button { Task { await verify() } } label: { if busy { ProgressView() } else { Text(t("XÁC NHẬN", "VERIFY")) } }.buttonStyle(.solPrimary).disabled(busy || code.count != 6)
                Spacer()
            }.padding(Metrics.pad).screenBackground()
            .navigationTitle(t("Xác nhận Gmail", "Confirm Gmail")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
        }
    }
    private func verify() async {
        busy = true; error = nil
        defer { busy = false }
        do { onSignedIn(try await GoogleSignIn.verifyOtp(email: email, code: code)); dismiss() } catch { self.error = error.localizedDescription }
    }
}
