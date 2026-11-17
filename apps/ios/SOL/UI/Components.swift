import SwiftUI
import CoreImage.CIFilterBuiltins

// MARK: - Loader

/// Nạp dữ liệu bất đồng bộ với đủ trạng thái loading / lỗi / dữ liệu (AGENTS.md: luôn có loading, empty, error).
@MainActor @Observable
final class Loader<T> {
    enum State { case idle, loading, loaded(T), failed(String) }
    var state: State = .idle
    private let fetch: () async throws -> T
    init(_ fetch: @escaping () async throws -> T) { self.fetch = fetch }

    var value: T? { if case .loaded(let v) = state { return v } else { return nil } }

    func load(silent: Bool = false) async {
        if !silent || value == nil { state = .loading }
        do { state = .loaded(try await fetch()) }
        catch is CancellationError { }
        catch let e as URLError where e.code == .cancelled { }
        catch { state = .failed(error.localizedDescription) }
    }
}

struct LoadView<T, Content: View>: View {
    let loader: Loader<T>
    let content: (T) -> Content
    init(_ loader: Loader<T>, @ViewBuilder content: @escaping (T) -> Content) { self.loader = loader; self.content = content }

    var body: some View {
        Group {
            switch loader.state {
            case .idle, .loading:
                ProgressView().frame(maxWidth: .infinity, minHeight: 200)
            case .failed(let msg):
                ErrorState(message: msg) { Task { await loader.load() } }
            case .loaded(let v):
                content(v)
            }
        }
        .task { if case .idle = loader.state { await loader.load() } }
    }
}

struct ErrorState: View {
    let message: String
    let retry: () -> Void
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle").font(.title).foregroundStyle(Theme.danger)
            Text(message).font(.subheadline).multilineTextAlignment(.center).foregroundStyle(Theme.textMuted)
            Button(t("Thử lại", "Retry"), action: retry).buttonStyle(.solSecondary)
        }
        .padding(24).frame(maxWidth: .infinity)
    }
}

struct EmptyState: View {
    let icon: String
    let title: String
    var subtitle: String? = nil
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 34)).foregroundStyle(Theme.textMuted)
            Text(title).font(.headline).foregroundStyle(Theme.text)
            if let subtitle { Text(subtitle).font(.subheadline).foregroundStyle(Theme.textMuted).multilineTextAlignment(.center) }
        }
        .padding(32).frame(maxWidth: .infinity)
    }
}

// MARK: - Styling

struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.padding(Metrics.pad).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: Metrics.radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Metrics.radius, style: .continuous).stroke(Theme.border, lineWidth: 1))
    }
}
extension View {
    func card() -> some View { modifier(CardModifier()) }
    func screenBackground() -> some View { background(Theme.background.ignoresSafeArea()) }
}

struct SOLButtonStyle: ButtonStyle {
    var prominent: Bool
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(.body, weight: .semibold))
            .frame(maxWidth: prominent ? .infinity : nil, minHeight: 44)
            .padding(.horizontal, 20)
            .foregroundStyle(prominent ? Theme.onAccent : Theme.accentText)
            .background(prominent ? Theme.accent : Color.clear, in: Capsule())
            .overlay(Capsule().stroke(Theme.accent, lineWidth: prominent ? 0 : 1.5))
            .opacity(enabled ? (configuration.isPressed ? 0.8 : 1) : 0.45)
    }
}
extension ButtonStyle where Self == SOLButtonStyle {
    static var solPrimary: SOLButtonStyle { SOLButtonStyle(prominent: true) }
    static var solSecondary: SOLButtonStyle { SOLButtonStyle(prominent: false) }
}

struct Pill: View {
    enum Tone { case neutral, success, warning, danger, accent }
    let text: String
    var tone: Tone = .neutral
    private var color: Color {
        switch tone { case .neutral: Theme.textMuted; case .success: Theme.success; case .warning: Theme.warning; case .danger: Theme.danger; case .accent: Theme.accentText }
    }
    var body: some View {
        Text(text).font(.caption.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 4)
            .foregroundStyle(color).background(color.opacity(0.14), in: Capsule())
    }
}

struct SectionTitle: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(.title3.weight(.bold)).foregroundStyle(Theme.text).frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct StatTile: View {
    let label: String
    let value: String
    var icon: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack { if let icon { Image(systemName: icon).foregroundStyle(Theme.accent) }; Text(label).font(.caption).foregroundStyle(Theme.textMuted) }
            Text(value).font(.title2.weight(.bold)).foregroundStyle(Theme.text).minimumScaleFactor(0.6).lineLimit(1)
        }.card()
    }
}

struct LabeledRow: View {
    let label: String
    let value: String
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).foregroundStyle(Theme.textMuted)
            Spacer(minLength: 12)
            Text(value).multilineTextAlignment(.trailing).foregroundStyle(Theme.text)
        }.font(.subheadline)
    }
}

struct Avatar: View {
    let name: String
    var url: String? = nil
    var size: CGFloat = 44
    var body: some View {
        Group {
            if let url, let u = URL(string: url) {
                AsyncImage(url: u) { img in img.resizable().scaledToFill() } placeholder: { initials }
            } else { initials }
        }
        .frame(width: size, height: size).clipShape(Circle())
    }
    private var initials: some View {
        ZStack {
            Circle().fill(Theme.accent.opacity(0.25))
            Text(String(name.split(separator: " ").last?.prefix(1) ?? "?").uppercased()).font(.system(size: size * 0.4, weight: .bold)).foregroundStyle(Theme.accentText)
        }
    }
}

struct ErrorBanner: View {
    let message: String?
    var body: some View {
        if let message {
            Text(message).font(.subheadline).foregroundStyle(Theme.danger).padding(12).frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.danger.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

struct SOLField: View {
    let label: String
    @Binding var text: String
    var secure = false
    var keyboard: UIKeyboardType = .default
    var contentType: UITextContentType? = nil
    @State private var reveal = false
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
            HStack {
                Group {
                    if secure && !reveal { SecureField(label, text: $text) } else { TextField(label, text: $text) }
                }
                .textContentType(contentType).keyboardType(keyboard)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                if secure {
                    Button { reveal.toggle() } label: { Image(systemName: reveal ? "eye.slash" : "eye").foregroundStyle(Theme.textMuted) }
                }
            }
            .padding(.horizontal, 14).frame(minHeight: 48)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border))
        }
    }
}

// MARK: - QR

enum QRCode {
    static func image(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let out = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)),
              let cg = CIContext().createCGImage(out, from: out.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

struct QRCodeView: View {
    let text: String
    var body: some View {
        if let img = QRCode.image(text) {
            Image(uiImage: img).interpolation(.none).resizable().scaledToFit().padding(12).background(Color.white, in: RoundedRectangle(cornerRadius: 16))
        }
    }
}
