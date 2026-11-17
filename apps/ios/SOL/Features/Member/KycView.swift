import SwiftUI
import PhotosUI

/// Xác minh danh tính (KYC): ảnh được thu nhỏ ≤1600px và mã hoá JPEG trước khi gửi (như web, tránh vượt giới hạn body 413).
enum ImagePrep {
    static func dataURL(from data: Data) -> String? {
        guard let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        let scale = min(1, 1600 / longest)
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        let resized = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        guard let jpeg = resized.jpegData(compressionQuality: 0.85) else { return nil }
        return "data:image/jpeg;base64," + jpeg.base64EncodedString()
    }
}

struct KycView: View {
    @Environment(AuthStore.self) private var auth
    @State private var profile: [String: JSONValue] = [:]
    @State private var type = "CCCD"
    @State private var citizenId = ""
    @State private var fullName = ""
    @State private var nationality = "Việt Nam"
    @State private var front: PhotosPickerItem?
    @State private var back: PhotosPickerItem?
    @State private var frontData: String?
    @State private var backData: String?
    @State private var busy = false
    @State private var message: String?
    @State private var isError = false

    private var status: String? { profile["kycStatus"]?.stringValue.nilIfEmpty }
    private var idLabel: String { type == "CCCD" ? t("Số CCCD", "Identity card number") : t("Số hộ chiếu", "Passport number") }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if let status {
                    HStack { Text(t("Trạng thái", "Status")).foregroundStyle(Theme.textMuted); Spacer()
                        Pill(text: statusText(status), tone: status == "APPROVED" ? .success : status == "REJECTED" ? .danger : .warning) }.card()
                    if status == "REJECTED", let r = profile["kycRejectReason"]?.stringValue.nilIfEmpty { ErrorBanner(message: r) }
                }
                if status != "APPROVED" {
                    VStack(spacing: 14) {
                        Picker("", selection: $type) { Text(t("CCCD", "Identity card")).tag("CCCD"); Text(t("Hộ chiếu", "Passport")).tag("PASSPORT") }.pickerStyle(.segmented)
                        SOLField(label: idLabel, text: $citizenId, keyboard: .asciiCapable)
                        SOLField(label: t("Họ tên trên giấy tờ", "Name on document"), text: $fullName, contentType: .name)
                        SOLField(label: t("Quốc tịch", "Nationality"), text: $nationality)
                        PhotosPicker(selection: $front, matching: .images) { photoLabel(t("Ảnh mặt trước", "Front photo"), done: frontData != nil) }
                        PhotosPicker(selection: $back, matching: .images) { photoLabel(t("Ảnh mặt sau (nếu có)", "Back photo (if any)"), done: backData != nil) }
                        if let message { if isError { ErrorBanner(message: message) } else { Text(message).foregroundStyle(Theme.success) } }
                        Button { Task { await submit() } } label: { if busy { ProgressView() } else { Text(t("GỬI XÁC MINH", "SUBMIT")) } }.buttonStyle(.solPrimary).disabled(busy || citizenId.count < 6 || fullName.count < 2 || frontData == nil)
                    }.card()
                }
            }.padding(Metrics.pad)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(t("Xác minh danh tính", "Identity verification")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task { profile = (try? await MemberAPI.rawProfile()) ?? [:]; if fullName.isEmpty { fullName = profile["fullName"]?.stringValue ?? "" } }
        .onChange(of: front) { _, item in Task { frontData = await load(item) } }
        .onChange(of: back) { _, item in Task { backData = await load(item) } }
    }

    private func photoLabel(_ text: String, done: Bool) -> some View {
        HStack { Image(systemName: done ? "checkmark.circle.fill" : "photo.on.rectangle").foregroundStyle(done ? Theme.success : Theme.accent); Text(text).foregroundStyle(Theme.text); Spacer() }
            .padding(14).background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 14))
    }
    private func statusText(_ s: String) -> String { switch s { case "APPROVED": t("Đã xác minh", "Verified"); case "REJECTED": t("Bị từ chối", "Rejected"); default: t("Chờ duyệt", "Pending") } }
    private func load(_ item: PhotosPickerItem?) async -> String? {
        guard let item, let data = try? await item.loadTransferable(type: Data.self) else { return nil }
        return ImagePrep.dataURL(from: data)
    }
    private func submit() async {
        guard let frontData else { return }
        busy = true; message = nil
        defer { busy = false }
        do {
            try await ExtraAPI.submitKyc(type: type, citizenId: citizenId.trimmingCharacters(in: .whitespaces), fullName: fullName.trimmingCharacters(in: .whitespaces), nationality: nationality.nilIfEmpty, front: frontData, back: backData)
            isError = false; message = t("Đã gửi. Lễ tân sẽ duyệt hồ sơ.", "Submitted. The front desk will review it.")
            profile = (try? await MemberAPI.rawProfile()) ?? profile
        } catch { isError = true; message = error.localizedDescription }
    }
}
