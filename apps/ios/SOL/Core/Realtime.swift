import Foundation

private struct RealtimeSession: Decodable {
    let enabled: Bool
    let url: String?
    let publishableKey: String?
    let topic: String?
    let token: String?
    let expiresAt: String?
}

/// Realtime của chat/hỗ trợ qua Supabase Realtime (giao thức Phoenix trên WebSocket), giống `chatRealtime.ts`:
/// broadcast `changed` chỉ báo "dữ liệu đã đổi", không bao giờ dùng payload; app tải lại qua REST.
/// Khi realtime tắt hoặc lỗi, rơi về thăm dò 4 giây.
@MainActor
final class RealtimeSubscription {
    private let sessionPath: String
    private let changed: () -> Void
    private var task: Task<Void, Never>?
    private var socket: URLSessionWebSocketTask?
    private var failures = 0

    private let isPrivate: Bool

    /// `isPrivate: false` cho kênh công khai (trạng thái gói tập): không cần token riêng.
    init(sessionPath: String, isPrivate: Bool = true, changed: @escaping () -> Void) { self.sessionPath = sessionPath; self.isPrivate = isPrivate; self.changed = changed }

    func start() {
        guard task == nil else { return }
        task = Task { [weak self] in await self?.run() }
    }

    func stop() { task?.cancel(); task = nil; socket?.cancel(with: .goingAway, reason: nil); socket = nil }

    private func run() async {
        while !Task.isCancelled {
            do {
                let session: RealtimeSession = try await APIClient.shared.post(sessionPath)
                guard session.enabled else { await pollForever(); return }
                guard let base = session.url, let key = session.publishableKey, key.hasPrefix("sb_publishable_"), let topic = session.topic, (!isPrivate || session.token != nil) else { throw URLError(.badServerResponse) }
                try await listen(base: base, key: key, topic: topic, token: session.token, expires: session.expiresAt.flatMap { Fmt.date($0) })
                failures = 0
            } catch is CancellationError { return }
            catch { failures += 1 }
            if Task.isCancelled { return }
            // Trong lúc chờ kết nối lại vẫn làm mới dữ liệu để không bị trễ.
            changed()
            try? await Task.sleep(for: .seconds(min(30, 3 * pow(2, Double(min(failures, 4))))))
        }
    }

    private func pollForever() async {
        while !Task.isCancelled { try? await Task.sleep(for: .seconds(4)); if !Task.isCancelled { changed() } }
    }

    private func listen(base: String, key: String, topic: String, token: String?, expires: Date?) async throws {
        var comps = URLComponents(string: base)!
        comps.scheme = comps.scheme == "http" ? "ws" : "wss"
        comps.path = "/realtime/v1/websocket"
        comps.queryItems = [URLQueryItem(name: "apikey", value: key), URLQueryItem(name: "vsn", value: "1.0.0")]
        guard let url = comps.url else { throw URLError(.badURL) }
        let ws = URLSession.shared.webSocketTask(with: url)
        socket = ws
        ws.resume()
        defer { ws.cancel(with: .goingAway, reason: nil); socket = nil }

        let channel = "realtime:\(topic)"
        try await send(ws, ["topic": channel, "event": "phx_join", "ref": "1", "join_ref": "1",
                            "payload": ["config": ["broadcast": ["ack": false, "self": false], "presence": ["key": ""], "postgres_changes": [], "private": isPrivate], "access_token": token ?? key]])
        let heartbeat = Task { var n = 2; while !Task.isCancelled { try? await Task.sleep(for: .seconds(25)); n += 1; try? await self.send(ws, ["topic": "phoenix", "event": "heartbeat", "payload": [String: String](), "ref": String(n)]) } }
        defer { heartbeat.cancel() }
        // Làm mới token trước khi hết hạn: thoát vòng nghe để `run` mở phiên mới.
        let renewAt = (expires ?? Date().addingTimeInterval(600)).addingTimeInterval(-60)

        while !Task.isCancelled, Date() < renewAt {
            let message = try await withThrowingTaskGroup(of: URLSessionWebSocketTask.Message?.self) { group in
                group.addTask { try await ws.receive() }
                group.addTask { try await Task.sleep(for: .seconds(max(1, renewAt.timeIntervalSinceNow))); return nil }
                defer { group.cancelAll() }
                return try await group.next() ?? nil
            }
            guard let message else { return }
            var text: String?
            switch message { case .string(let s): text = s; case .data(let d): text = String(data: d, encoding: .utf8); @unknown default: break }
            guard let text, let obj = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any] else { continue }
            let event = obj["event"] as? String
            if event == "phx_reply", (obj["payload"] as? [String: Any])?["status"] as? String == "ok", obj["topic"] as? String == channel { changed() }
            if event == "broadcast", (obj["payload"] as? [String: Any])?["event"] as? String == "changed" { changed() }
            if event == "phx_error" || event == "phx_close" { throw URLError(.networkConnectionLost) }
        }
    }

    private func send(_ ws: URLSessionWebSocketTask, _ object: [String: Any]) async throws {
        let data = try JSONSerialization.data(withJSONObject: object)
        try await ws.send(.string(String(data: data, encoding: .utf8)!))
    }
}
