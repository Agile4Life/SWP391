import SwiftUI

struct AuthFlow: View {
    @State private var path: [Route] = []
    enum Route: Hashable { case register, forgot }

    var body: some View {
        NavigationStack(path: $path) {
            LoginView(onRegister: { path.append(.register) }, onForgot: { path.append(.forgot) })
                .navigationDestination(for: Route.self) { r in
                    switch r {
                    case .register: RegisterView(onDone: { path.removeAll() })
                    case .forgot: ForgotPasswordView(onDone: { path.removeAll() })
                    }
                }
        }
    }
}

struct AuthHeader: View {
    let title: String
    let subtitle: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.largeTitle.weight(.heavy)).foregroundStyle(Theme.text)
            Text(subtitle).font(.body).foregroundStyle(Theme.accentText)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct BrandMark: View {
    var body: some View {
        HStack(spacing: 0) {
            Text("SÖL").foregroundStyle(Theme.accentText)
            Text(" Fitness").foregroundStyle(Theme.text)
        }.font(.system(size: 28, weight: .bold))
    }
}

struct AuthToolbar: View {
    @State private var lang = Lang.shared
    @State private var appearance = Appearance.shared
    var body: some View {
        HStack(spacing: 10) {
            Picker("", selection: $lang.code) { Text("VI").tag("vi"); Text("EN").tag("en") }.pickerStyle(.segmented).frame(width: 90)
            Button {
                appearance.mode = appearance.mode == "dark" ? "light" : "dark"
            } label: { Image(systemName: appearance.mode == "dark" ? "sun.max" : "moon").frame(width: 40, height: 40).background(Theme.surface, in: Circle()).overlay(Circle().stroke(Theme.border)) }
                .foregroundStyle(Theme.text)
        }
    }
}

struct LoginView: View {
    @Environment(AuthStore.self) private var auth
    let onRegister: () -> Void
    let onForgot: () -> Void
    @State private var identifier = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @State private var lockUntil: Date?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                HStack { BrandMark(); Spacer(); AuthToolbar() }
                AuthHeader(title: t("Trở lại", "Back to"), subtitle: t("lịch tập của bạn.", "your training."))
                if auth.expired { ErrorBanner(message: t("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "Your session has expired. Please sign in again.")) }
                VStack(spacing: 16) {
                    Text(t("Đăng nhập", "Sign in")).font(.title2.weight(.bold)).foregroundStyle(Theme.text)
                    SOLField(label: t("Tên đăng nhập hoặc Email", "Username or email"), text: $identifier, contentType: .username)
                    SOLField(label: t("Mật khẩu", "Password"), text: $password, secure: true, contentType: .password)
                    HStack { Spacer(); Button(t("Quên mật khẩu?", "Forgot password?"), action: onForgot).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.accentText) }
                    ErrorBanner(message: error)
                    Button { Task { await submit() } } label: {
                        if busy { ProgressView() } else { Text(t("ĐĂNG NHẬP", "SIGN IN")) }
                    }.buttonStyle(.solPrimary).disabled(busy || identifier.isEmpty || password.isEmpty)
                    HStack(spacing: 4) {
                        Text(t("Chưa có tài khoản?", "No account yet?")).foregroundStyle(Theme.textMuted)
                        Button(t("Đăng ký hội viên", "Become a member"), action: onRegister).foregroundStyle(Theme.accentText).fontWeight(.semibold)
                    }.font(.subheadline)
                }.card()
            }.padding(Metrics.pad)
        }
        .scrollDismissesKeyboard(.interactively)
        .screenBackground()
    }

    private func submit() async {
        busy = true; error = nil
        defer { busy = false }
        do { try await auth.signIn(identifier: identifier, password: password) }
        catch { self.error = error.localizedDescription }
    }
}

// MARK: - Register

private struct RegisterRequest: Encodable { let username, fullName, email, password: String; let phone: String? }
private struct EmailRequest: Encodable { let email: String }
private struct VerifyRequest: Encodable { let target, otpCode: String }
struct OtpResponse: Decodable { let debugOtp: String? }

struct Validate {
    static func email(_ s: String) -> Bool {
        s.range(of: #"^[A-Za-z0-9]+([._%+-][A-Za-z0-9]+)*@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$"#, options: .regularExpression) != nil
    }
    static func phone(_ raw: String) -> Bool {
        var p = raw.filter { !" .-()".contains($0) }
        if p.hasPrefix("+84") { p = "0" + p.dropFirst(3) } else if p.hasPrefix("84"), p.count == 11 { p = "0" + p.dropFirst(2) }
        return p.range(of: #"^0(3|5|7|8|9)[0-9]{8}$"#, options: .regularExpression) != nil
    }
}

struct RegisterView: View {
    let onDone: () -> Void
    @State private var fullName = ""
    @State private var username = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var password = ""
    @State private var otp = ""
    @State private var stage = 0 // 0 form, 1 OTP, 2 done
    @State private var busy = false
    @State private var error: String?
    @State private var cooldown = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                AuthHeader(title: t("Tạo tài khoản", "Create account"), subtitle: t("hội viên SÖL.", "SÖL membership."))
                VStack(spacing: 16) {
                    switch stage {
                    case 0: form
                    case 1: otpForm
                    default: done
                    }
                }.card()
            }.padding(Metrics.pad)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }

    private var formValid: String? {
        if fullName.trimmingCharacters(in: .whitespaces).count < 2 { return t("Vui lòng nhập họ và tên (tối thiểu 2 ký tự).", "Please enter your full name (at least 2 characters).") }
        if username.trimmingCharacters(in: .whitespaces).count < 3 { return t("Tên đăng nhập cần tối thiểu 3 ký tự.", "Username needs at least 3 characters.") }
        if !Validate.email(email.trimmingCharacters(in: .whitespaces)) { return t("Email không đúng định dạng (vd: user@example.com).", "Invalid email format (e.g. user@example.com).") }
        if !phone.isEmpty && !Validate.phone(phone) { return t("Số điện thoại không hợp lệ (vd: 0912 345 678).", "Invalid phone number (e.g. 0912 345 678).") }
        if password.count < 6 { return t("Mật khẩu cần tối thiểu 6 ký tự.", "Password needs at least 6 characters.") }
        return nil
    }

    @ViewBuilder private var form: some View {
        SOLField(label: t("Họ và tên", "Full name"), text: $fullName, contentType: .name)
        SOLField(label: t("Tên đăng nhập", "Username"), text: $username, contentType: .username)
        SOLField(label: "Email", text: $email, keyboard: .emailAddress, contentType: .emailAddress)
        SOLField(label: t("Số điện thoại (tuỳ chọn)", "Phone (optional)"), text: $phone, keyboard: .phonePad, contentType: .telephoneNumber)
        SOLField(label: t("Mật khẩu", "Password"), text: $password, secure: true, contentType: .newPassword)
        ErrorBanner(message: error)
        Button { Task { await submit() } } label: { if busy { ProgressView() } else { Text(t("ĐĂNG KÝ", "REGISTER")) } }
            .buttonStyle(.solPrimary).disabled(busy)
    }

    @ViewBuilder private var otpForm: some View {
        Text(t("Chúng tôi đã gửi mã OTP 6 chữ số tới \(email).", "We sent a 6-digit OTP to \(email).")).font(.subheadline).foregroundStyle(Theme.textMuted)
        SOLField(label: t("Mã OTP", "OTP code"), text: $otp, keyboard: .numberPad, contentType: .oneTimeCode)
        ErrorBanner(message: error)
        Button { Task { await verify() } } label: { if busy { ProgressView() } else { Text(t("XÁC NHẬN", "VERIFY")) } }
            .buttonStyle(.solPrimary).disabled(busy || otp.count != 6)
        Button(cooldown > 0 ? t("Gửi lại mã sau \(cooldown)s", "Resend code in \(cooldown)s") : t("Gửi lại mã OTP", "Resend OTP")) { Task { await sendOtp() } }
            .disabled(cooldown > 0 || busy).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.accentText)
    }

    @ViewBuilder private var done: some View {
        Image(systemName: "checkmark.circle.fill").font(.system(size: 54)).foregroundStyle(Theme.success)
        Text(t("Đăng ký thành công!", "Registration complete!")).font(.title3.weight(.bold)).foregroundStyle(Theme.text)
        Text(t("Bạn có thể đăng nhập ngay bây giờ.", "You can sign in now.")).foregroundStyle(Theme.textMuted)
        Button(t("Về đăng nhập", "Back to sign in"), action: onDone).buttonStyle(.solPrimary)
    }

    private func submit() async {
        if let msg = formValid { error = msg; return }
        busy = true; error = nil
        defer { busy = false }
        do {
            let _: Empty = try await APIClient.shared.post("/auth/register", body: RegisterRequest(username: username.trimmingCharacters(in: .whitespaces), fullName: fullName.trimmingCharacters(in: .whitespaces), email: email.trimmingCharacters(in: .whitespaces), password: password, phone: phone.isEmpty ? nil : phone.filter { !" ".contains($0) }))
            await sendOtp(); if error == nil { stage = 1 }
        } catch { self.error = error.localizedDescription }
    }

    private func sendOtp() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            let _: OtpResponse? = try await APIClient.shared.post("/auth/send-otp", body: EmailRequest(email: email.trimmingCharacters(in: .whitespaces)))
            cooldown = 60
            Task { while cooldown > 0 { try? await Task.sleep(for: .seconds(1)); cooldown -= 1 } }
        } catch { self.error = error.localizedDescription }
    }

    private func verify() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            let _: Empty = try await APIClient.shared.post("/auth/verify-otp", body: VerifyRequest(target: email.trimmingCharacters(in: .whitespaces), otpCode: otp))
            stage = 2
        } catch { self.error = error.localizedDescription }
    }
}

// MARK: - Forgot password

private struct ResetRequest: Encodable { let email, otpCode, newPassword: String }

struct ForgotPasswordView: View {
    let onDone: () -> Void
    @State private var email = ""
    @State private var otp = ""
    @State private var newPassword = ""
    @State private var stage = 0
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                AuthHeader(title: t("Quên mật khẩu", "Forgot password"), subtitle: t("đặt lại bằng OTP.", "reset with OTP."))
                VStack(spacing: 16) {
                    if stage == 0 {
                        SOLField(label: "Email", text: $email, keyboard: .emailAddress, contentType: .emailAddress)
                        ErrorBanner(message: error)
                        Button { Task { await send() } } label: { if busy { ProgressView() } else { Text(t("GỬI MÃ OTP", "SEND OTP")) } }.buttonStyle(.solPrimary).disabled(busy || !Validate.email(email))
                    } else if stage == 1 {
                        SOLField(label: t("Mã OTP", "OTP code"), text: $otp, keyboard: .numberPad, contentType: .oneTimeCode)
                        SOLField(label: t("Mật khẩu mới", "New password"), text: $newPassword, secure: true, contentType: .newPassword)
                        ErrorBanner(message: error)
                        Button { Task { await reset() } } label: { if busy { ProgressView() } else { Text(t("ĐẶT LẠI MẬT KHẨU", "RESET PASSWORD")) } }.buttonStyle(.solPrimary).disabled(busy || otp.count != 6 || newPassword.count < 6)
                    } else {
                        Image(systemName: "checkmark.circle.fill").font(.system(size: 54)).foregroundStyle(Theme.success)
                        Text(t("Đã đặt lại mật khẩu.", "Password reset.")).font(.title3.weight(.bold)).foregroundStyle(Theme.text)
                        Button(t("Về đăng nhập", "Back to sign in"), action: onDone).buttonStyle(.solPrimary)
                    }
                }.card()
            }.padding(Metrics.pad)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }

    private func send() async {
        busy = true; error = nil
        defer { busy = false }
        do { let _: OtpResponse? = try await APIClient.shared.post("/auth/password/send-otp", body: EmailRequest(email: email.trimmingCharacters(in: .whitespaces))); stage = 1 }
        catch { self.error = error.localizedDescription }
    }

    private func reset() async {
        busy = true; error = nil
        defer { busy = false }
        do { let _: Empty? = try await APIClient.shared.post("/auth/password/reset", body: ResetRequest(email: email.trimmingCharacters(in: .whitespaces), otpCode: otp, newPassword: newPassword)); stage = 2 }
        catch { self.error = error.localizedDescription }
    }
}
