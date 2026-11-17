import SwiftUI

struct ChatContact: Decodable, Identifiable, Hashable { let id: Int; let name: String; let role: String?; let available: Bool?; let avatarUrl: String? }
struct ChatConversation: Decodable, Identifiable, Hashable {
    let id: Int; let peer: ChatContact; let lastActivityAt: String?
    let lastMessage: String?; let lastMessageMine: Bool?; let unreadCount: Int?
}
struct ChatMessage: Decodable, Identifiable, Hashable { let id: Int; let clientMessageId: String?; let mine: Bool; let message: String; let createdAt: String }
struct ChatHistory: Decodable { let items: [ChatMessage]; let hasMore: Bool? }
struct ChatPage<T: Decodable>: Decodable { let content: [T] }
private struct OpenBody: Encodable { let contactId: Int }
private struct SendBody: Encodable { let message: String; let clientMessageId: String }
private struct ReadBody: Encodable { let lastMessageId: Int }

enum ChatAPI {
    static func conversations() async throws -> [ChatConversation] { (try await APIClient.shared.get("/chat/conversations", query: ["page": "0"]) as ChatPage<ChatConversation>).content }
    static func contacts(_ q: String) async throws -> [ChatContact] { (try await APIClient.shared.get("/chat/contacts", query: ["query": q, "page": "0"]) as ChatPage<ChatContact>).content }
    static func open(_ contactId: Int) async throws -> ChatConversation { try await APIClient.shared.post("/chat/conversations", body: OpenBody(contactId: contactId)) }
    static func history(_ id: Int) async throws -> [ChatMessage] { (try await APIClient.shared.get("/chat/conversations/\(id)/messages") as ChatHistory).items }
    static func send(_ id: Int, _ text: String) async throws -> ChatMessage { try await APIClient.shared.post("/chat/conversations/\(id)/messages", body: SendBody(message: text, clientMessageId: UUID().uuidString)) }
    static func markRead(_ id: Int, last: Int) async { let _: Empty? = try? await APIClient.shared.post("/chat/conversations/\(id)/read", body: ReadBody(lastMessageId: last)) }
    static func unread() async -> Int { ((try? await APIClient.shared.get("/chat/unread-count")) as UnreadCount?)?.count ?? 0 }
}

struct ChatListView: View {
    @State private var loader = Loader { try await ChatAPI.conversations() }
    @State private var showContacts = false
    @State private var open: ChatConversation?
    @State private var realtime: RealtimeSubscription?

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "bubble.left.and.bubble.right", title: t("Chưa có hội thoại", "No conversations"), subtitle: t("Bấm + để nhắn tin cho huấn luyện viên hoặc nhân viên.", "Tap + to message a coach or staff member.")).card() }
                    ForEach(list) { c in
                        NavigationLink { ChatThreadView(conversation: c) } label: {
                            HStack(spacing: 12) {
                                Avatar(name: c.peer.name, url: c.peer.avatarUrl, size: 46)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(c.peer.name).font(.headline).foregroundStyle(Theme.text)
                                    Text((c.lastMessageMine == true ? t("Bạn: ", "You: ") : "") + (c.lastMessage ?? "")).font(.subheadline).foregroundStyle(Theme.textMuted).lineLimit(1)
                                }
                                Spacer()
                                if let u = c.unreadCount, u > 0 { Text("\(u)").font(.caption.bold()).padding(.horizontal, 8).padding(.vertical, 3).background(Theme.accent, in: Capsule()).foregroundStyle(Theme.onAccent) }
                            }.card()
                        }.buttonStyle(.plain)
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .onAppear { let rt = RealtimeSubscription(sessionPath: "/chat/realtime-session") { Task { await loader.load(silent: true) } }; realtime = rt; rt.start() }
        .onDisappear { realtime?.stop(); realtime = nil }
        .navigationTitle(t("Tin nhắn", "Messages")).navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { showContacts = true } label: { Image(systemName: "square.and.pencil") } } }
        .screenBackground()
        .sheet(isPresented: $showContacts, onDismiss: { Task { await loader.load(silent: true) } }) { ContactsSheet(onOpen: { open = $0; showContacts = false }) }
        .navigationDestination(item: $open) { ChatThreadView(conversation: $0) }
    }
}

struct ContactsSheet: View {
    let onOpen: (ChatConversation) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var contacts: [ChatContact] = []
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                if let error { Text(error).foregroundStyle(Theme.danger) }
                ForEach(contacts) { c in
                    Button { Task { await start(c) } } label: {
                        HStack { Avatar(name: c.name, url: c.avatarUrl, size: 36); VStack(alignment: .leading) { Text(c.name).foregroundStyle(Theme.text); Text(c.role ?? "").font(.caption).foregroundStyle(Theme.textMuted) } }
                    }
                }
            }
            .searchable(text: $query, prompt: t("Tìm người nhận", "Find a contact"))
            .onChange(of: query) { _, _ in Task { await load() } }
            .task { await load() }
            .navigationTitle(t("Tin nhắn mới", "New message")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
        }
    }

    private func load() async {
        do { contacts = try await ChatAPI.contacts(query); error = nil } catch { self.error = error.localizedDescription }
    }
    private func start(_ c: ChatContact) async {
        do { onOpen(try await ChatAPI.open(c.id)) } catch { self.error = error.localizedDescription }
    }
}

struct ChatThreadView: View {
    let conversation: ChatConversation
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var error: String?
    @State private var loaded = false
    @State private var realtime: RealtimeSubscription?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if loaded && messages.isEmpty { EmptyState(icon: "bubble.left", title: t("Hãy gửi lời chào", "Say hello")) }
                        ForEach(messages) { m in
                            HStack { if m.mine { Spacer(minLength: 48) }
                                Text(m.message).padding(.horizontal, 14).padding(.vertical, 9)
                                    .background(m.mine ? Theme.accent : Theme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(m.mine ? .clear : Theme.border))
                                    .foregroundStyle(m.mine ? Theme.onAccent : Theme.text)
                                if !m.mine { Spacer(minLength: 48) } }.id(m.id)
                        }
                    }.padding(Metrics.pad)
                }
                .onChange(of: messages.last?.id) { _, id in if let id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } } }
            }
            if let error { ErrorBanner(message: error).padding(.horizontal, Metrics.pad) }
            HStack(spacing: 8) {
                TextField(t("Nhập tin nhắn…", "Message…"), text: $draft, axis: .vertical).lineLimit(1...4).padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.border))
                Button { Task { await send() } } label: { Image(systemName: "arrow.up.circle.fill").font(.system(size: 34)).foregroundStyle(draft.trimmingCharacters(in: .whitespaces).isEmpty ? Theme.textMuted : Theme.accent) }
                    .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }.padding(Metrics.pad).background(Theme.background)
        }
        .navigationTitle(conversation.peer.name).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task { await refresh() }
        .onAppear { let rt = RealtimeSubscription(sessionPath: "/chat/realtime-session") { Task { await refresh() } }; realtime = rt; rt.start() }
        .onDisappear { realtime?.stop(); realtime = nil }
    }

    /// Tải lại lịch sử khi realtime báo có thay đổi (hoặc thăm dò 4 giây nếu realtime tắt).
    private func refresh() async {
        if let items = try? await ChatAPI.history(conversation.id) {
            let ordered = items.sorted { $0.id < $1.id }
            if ordered.map(\.id) != messages.map(\.id) { messages = ordered }
            if let last = ordered.last { await ChatAPI.markRead(conversation.id, last: last.id) }
        }
        loaded = true
    }

    private func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""; error = nil
        do { let m = try await ChatAPI.send(conversation.id, text); if !messages.contains(where: { $0.id == m.id }) { messages.append(m) } }
        catch { self.error = error.localizedDescription; draft = text }
    }
}
