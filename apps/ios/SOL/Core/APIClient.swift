import Foundation

struct APIError: LocalizedError {
    let status: Int
    let code: String?
    let message: String
    var errorDescription: String? { message }
}

/// Phản hồi rỗng cho endpoint chỉ trả success.
struct Empty: Decodable {
    init() {}
    init(from decoder: Decoder) throws {}
}

private struct Envelope<T: Decodable>: Decodable {
    let data: T?
}

private struct ErrorBody: Decodable {
    let message: String?
    let code: String?
}

/// Client gọi REST `/api/v1` của VPS: Bearer token, bóc `ApiResponse.data`, ném `APIError` có thông báo đã dịch theo Accept-Language.
final class APIClient {
    static let shared = APIClient()
    private let session: URLSession
    private let decoder = JSONDecoder()
    /// Được AuthStore gán: gọi khi token hiện tại bị 401.
    var onUnauthorized: (() -> Void)?

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = false
        session = URLSession(configuration: config)
    }

    /// Bản nhớ trong bộ nhớ làm dự phòng khi Keychain không ghi được (bản build không ký, môi trường test).
    private var memoryToken: String?
    private var memoryLoaded = false

    var token: String? {
        get {
            if !memoryLoaded { memoryToken = Keychain.get("jwt"); memoryLoaded = true }
            return memoryToken
        }
        set { memoryToken = newValue; memoryLoaded = true; Keychain.set(newValue, for: "jwt") }
    }

    private func makeRequest(_ method: String, _ path: String, query: [String: String?], body: Data?) -> URLRequest {
        var comps = URLComponents(url: Config.apiBase.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        let items = query.compactMap { k, v in v.map { URLQueryItem(name: k, value: $0) } }.sorted { $0.name < $1.name }
        if !items.isEmpty { comps.queryItems = items }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        req.setValue(Lang.shared.code, forHTTPHeaderField: "Accept-Language")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body { req.httpBody = body; req.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.cachePolicy = .reloadIgnoringLocalCacheData
        return req
    }

    private func send(_ method: String, _ path: String, query: [String: String?], body: Data?) async throws -> Data {
        #if DEBUG
        if method == "GET", let demo = Demo.response(method, path) { return demo }
        #endif
        let req = makeRequest(method, path, query: query, body: body)
        let sentToken = token
        let data: Data, resp: URLResponse
        do { (data, resp) = try await session.data(for: req) }
        catch {
            if (error as? URLError)?.code == .cancelled { throw error }
            throw APIError(status: 0, code: "NETWORK", message: t("Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.", "Unable to connect to the server. Check your connection and try again."))
        }
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401, sentToken != nil, !path.hasPrefix("/auth/") || path == "/auth/me" {
            // Chỉ kết thúc phiên nếu token gây ra 401 vẫn là token đang lưu.
            if token == sentToken { onUnauthorized?() }
        }
        if !(200..<300).contains(status) {
            let err = try? decoder.decode(ErrorBody.self, from: data)
            let fallback = t("Yêu cầu thất bại (HTTP \(status))", "Request failed (HTTP \(status))")
            throw APIError(status: status, code: err?.code, message: err?.message ?? fallback)
        }
        return data
    }

    func get<T: Decodable>(_ path: String, query: [String: String?] = [:]) async throws -> T {
        try decode(try await send("GET", path, query: query, body: nil))
    }

    func send<T: Decodable>(_ method: String, _ path: String, query: [String: String?] = [:], body: (any Encodable)? = nil) async throws -> T {
        let data = try body.map { try JSONEncoder().encode(AnyEncodable($0)) }
        return try decode(try await send(method, path, query: query, body: data))
    }

    func post<T: Decodable>(_ path: String, body: (any Encodable)? = nil) async throws -> T { try await send("POST", path, body: body) }
    func put<T: Decodable>(_ path: String, body: (any Encodable)? = nil) async throws -> T { try await send("PUT", path, body: body) }
    func patch<T: Decodable>(_ path: String, body: (any Encodable)? = nil) async throws -> T { try await send("PATCH", path, body: body) }
    func delete<T: Decodable>(_ path: String) async throws -> T { try await send("DELETE", path) }

    /// PDF/ảnh nhị phân có xác thực.
    func download(_ path: String) async throws -> Data { try await send("GET", path, query: [:], body: nil) }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        if data.isEmpty, let empty = try? decoder.decode(T.self, from: Data("null".utf8)) { return empty }
        if let env = try? decoder.decode(Envelope<T>.self, from: data), let value = env.data { return value }
        // Envelope không có `data` (Jackson NON_NULL): endpoint thành công, không có nội dung.
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], obj["success"] as? Bool == true, obj["data"] == nil,
           let empty = try? decoder.decode(T.self, from: Data("null".utf8)) { return empty }
        do { return try decoder.decode(T.self, from: data) }
        catch {
            #if DEBUG
            print("Decode \(T.self) failed:", error)
            #endif
            throw APIError(status: 0, code: "DECODE", message: t("Dữ liệu máy chủ trả về không hợp lệ.", "The server returned invalid data."))
        }
    }
}

private struct AnyEncodable: Encodable {
    let value: any Encodable
    init(_ v: any Encodable) { value = v }
    func encode(to encoder: Encoder) throws { try value.encode(to: encoder) }
}

