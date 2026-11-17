import SwiftUI

/// Ngôn ngữ giao diện: mặc định tiếng Việt, đồng bộ header Accept-Language với backend.
@Observable
final class Lang {
    static let shared = Lang()
    var code: String {
        didSet { UserDefaults.standard.set(code, forKey: "sol_lang") }
    }
    private init() { code = UserDefaults.standard.string(forKey: "sol_lang") ?? "vi" }
    var isEnglish: Bool { code == "en" }
}

/// Chọn chuỗi theo ngôn ngữ hiện tại. Không trộn hai ngôn ngữ trong một chuỗi.
func t(_ vi: String, _ en: String) -> String { Lang.shared.isEnglish ? en : vi }
