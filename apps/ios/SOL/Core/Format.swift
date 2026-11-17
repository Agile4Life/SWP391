import Foundation

enum Fmt {
    private static let vnd: NumberFormatter = {
        let f = NumberFormatter(); f.numberStyle = .decimal; f.groupingSeparator = "."; f.maximumFractionDigits = 0; return f
    }()
    static func money(_ v: Double?) -> String { "\(vnd.string(from: NSNumber(value: v ?? 0)) ?? "0") ₫" }

    private static let center = TimeZone(identifier: "Asia/Ho_Chi_Minh")!
    private static func parser(_ f: String) -> DateFormatter {
        let d = DateFormatter(); d.locale = Locale(identifier: "en_US_POSIX"); d.timeZone = center; d.dateFormat = f; return d
    }
    private static let dayParser = parser("yyyy-MM-dd")
    private static let isoLocal = parser("yyyy-MM-dd'T'HH:mm:ss")
    private static let isoLocalFrac = parser("yyyy-MM-dd'T'HH:mm:ss.SSSSSS")
    private static let isoZ = ISO8601DateFormatter()
    private static let isoZFrac: ISO8601DateFormatter = { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f }()

    /// Parse `yyyy-MM-dd`, `yyyy-MM-ddTHH:mm:ss[.frac]` (giờ trung tâm) hoặc ISO có múi giờ.
    static func date(_ s: String?) -> Date? {
        guard let s, !s.isEmpty else { return nil }
        if s.count == 10 { return dayParser.date(from: s) }
        if s.hasSuffix("Z") || s.contains("+") { return isoZFrac.date(from: s) ?? isoZ.date(from: s) }
        return isoLocalFrac.date(from: s) ?? isoLocal.date(from: String(s.prefix(19)))
    }

    private static func out(_ f: String) -> DateFormatter {
        let d = DateFormatter(); d.timeZone = center; d.dateFormat = f; return d
    }
    static func day(_ s: String?) -> String {
        guard let d = date(s) else { return s ?? "—" }
        let f = out("dd/MM/yyyy"); f.locale = Locale(identifier: Lang.shared.code); return f.string(from: d)
    }
    static func dayTime(_ s: String?) -> String {
        guard let d = date(s) else { return s ?? "—" }
        let f = out("HH:mm dd/MM/yyyy"); f.locale = Locale(identifier: Lang.shared.code); return f.string(from: d)
    }
    static func weekdayDay(_ s: String?) -> String {
        guard let d = date(s) else { return s ?? "—" }
        let f = out("EEEE, dd/MM"); f.locale = Locale(identifier: Lang.shared.code); return f.string(from: d).capitalized
    }
    /// `HH:mm:ss` → `HH:mm`.
    static func time(_ s: String?) -> String { s.map { String($0.prefix(5)) } ?? "—" }

    static func todayString() -> String { dayParser.string(from: Date()) }
    static func dayString(_ d: Date) -> String { dayParser.string(from: d) }

    static func daysLeft(until end: String?) -> Int? {
        guard let e = date(end) else { return nil }
        var cal = Calendar(identifier: .gregorian); cal.timeZone = center
        return cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: e)).day
    }
}
