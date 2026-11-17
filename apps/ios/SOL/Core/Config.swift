import Foundation

enum Config {
    /// Máy chủ VPS; có thể ghi đè khi chạy bằng biến môi trường SOL_API_BASE (vd. staging).
    static let apiBase: URL = {
        if let raw = ProcessInfo.processInfo.environment["SOL_API_BASE"], let url = URL(string: raw) { return url }
        return URL(string: "https://scms.bluesymphony.site/api/v1")!
    }()
}
