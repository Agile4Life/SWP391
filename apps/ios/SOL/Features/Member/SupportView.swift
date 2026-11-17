import SwiftUI

/// Hỗ trợ (phiếu yêu cầu) dùng cho hội viên; nhân viên dùng cùng thread với hộp thư `/support/requests`.
struct SupportView: View {
    var staff = false
    @State private var loader: Loader<[SupportTicket]>
    @State private var creating = false

    init(staff: Bool = false) {
        self.staff = staff
        _loader = State(initialValue: Loader { staff ? try await ExtraAPI.inbox() : try await ExtraAPI.tickets() })
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "lifepreserver", title: t("Chưa có yêu cầu hỗ trợ", "No support requests")).card() }
                    ForEach(list) { tk in
                        NavigationLink { TicketThreadView(ticket: tk, staff: staff, onChange: { Task { await loader.load(silent: true) } }) } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack { Text(tk.subject).font(.headline).foregroundStyle(Theme.text); Spacer(); Pill(text: statusText(tk.status), tone: tk.status == "resolved" || tk.status == "closed" ? .success : .warning) }
                                if staff, let m = tk.memberName { Text(m).font(.subheadline).foregroundStyle(Theme.textMuted) }
                                Text(Fmt.dayTime(tk.createdAt)).font(.caption).foregroundStyle(Theme.textMuted)
                            }.card()
                        }.buttonStyle(.plain)
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Hỗ trợ", "Support")).navigationBarTitleDisplayMode(.inline)
        .toolbar { if !staff { ToolbarItem(placement: .primaryAction) { Button { creating = true } label: { Image(systemName: "plus") } } } }
        .screenBackground()
        .sheet(isPresented: $creating, onDismiss: { Task { await loader.load(silent: true) } }) { NewTicketSheet() }
    }

    private func statusText(_ s: String) -> String {
        switch s { case "open": t("Mới", "Open"); case "in_progress": t("Đang xử lý", "In progress"); case "resolved": t("Đã giải quyết", "Resolved"); default: t("Đã đóng", "Closed") }
    }
}

struct NewTicketSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var subject = ""
    @State private var detail = ""
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                SOLField(label: t("Tiêu đề", "Subject"), text: $subject)
                VStack(alignment: .leading, spacing: 6) {
                    Text(t("Nội dung", "Details")).font(.subheadline.weight(.semibold))
                    TextEditor(text: $detail).frame(minHeight: 140).padding(8).scrollContentBackground(.hidden)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border))
                }
                ErrorBanner(message: error)
                Button { Task { await submit() } } label: { if busy { ProgressView() } else { Text(t("GỬI YÊU CẦU", "SUBMIT")) } }.buttonStyle(.solPrimary).disabled(busy || subject.count < 3 || detail.count < 3)
                Spacer()
            }.padding(Metrics.pad).screenBackground()
            .navigationTitle(t("Yêu cầu hỗ trợ", "New request")).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(t("Đóng", "Close")) { dismiss() } } }
        }
    }
    private func submit() async {
        busy = true; error = nil
        defer { busy = false }
        do { _ = try await ExtraAPI.createTicket(subject: subject, description: detail); dismiss() } catch { self.error = error.localizedDescription }
    }
}

struct TicketThreadView: View {
    let ticket: SupportTicket
    var staff = false
    var onChange: () -> Void = {}
    @State private var messages: [SupportMessage] = []
    @State private var draft = ""
    @State private var error: String?
    @State private var realtime: RealtimeSubscription?
    @State private var escalating = false
    @State private var reason = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 10) {
                        if let d = ticket.description, !d.isEmpty { Text(d).font(.subheadline).foregroundStyle(Theme.textMuted).card() }
                        ForEach(messages) { m in
                            VStack(alignment: .leading, spacing: 3) {
                                Text((m.senderName ?? "—") + (m.senderRole.map { " · \($0)" } ?? "")).font(.caption.weight(.semibold)).foregroundStyle(Theme.accentText)
                                Text(m.message).foregroundStyle(Theme.text)
                                Text(Fmt.dayTime(m.createdAt)).font(.caption2).foregroundStyle(Theme.textMuted)
                            }.card().id(m.id)
                        }
                    }.padding(Metrics.pad)
                }.onChange(of: messages.last?.id) { _, id in if let id { proxy.scrollTo(id, anchor: .bottom) } }
            }
            if staff && ticket.status != "closed" {
                HStack { Button(t("Đang xử lý", "In progress")) { Task { await status("in_progress") } }.buttonStyle(.solSecondary)
                    Button(t("Đã giải quyết", "Resolve")) { Task { await status("resolved") } }.buttonStyle(.solSecondary) }.padding(.horizontal, Metrics.pad)
            }
            if let error { ErrorBanner(message: error).padding(.horizontal, Metrics.pad) }
            HStack(spacing: 8) {
                TextField(t("Nhập phản hồi…", "Reply…"), text: $draft, axis: .vertical).lineLimit(1...4).padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.border))
                Button { Task { await send() } } label: { Image(systemName: "arrow.up.circle.fill").font(.system(size: 34)).foregroundStyle(draft.isEmpty ? Theme.textMuted : Theme.accent) }.disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }.padding(Metrics.pad).background(Theme.background)
        }
        .navigationTitle(ticket.subject).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .task { await refresh() }
        .onAppear { let rt = RealtimeSubscription(sessionPath: "/support/requests/\(ticket.id)/realtime-session") { Task { await refresh() } }; realtime = rt; rt.start() }
        .onDisappear { realtime?.stop(); realtime = nil }
        .toolbar { if staff && ticket.status != "closed" { ToolbarItem(placement: .primaryAction) { Button { escalating = true } label: { Image(systemName: "arrow.up.forward.circle") } } } }
        .alert(t("Chuyển cấp lên quản lý", "Escalate to manager"), isPresented: $escalating) {
            TextField(t("Lý do", "Reason"), text: $reason)
            Button(t("Chuyển cấp", "Escalate")) { Task { await escalate() } }
            Button(t("Huỷ", "Cancel"), role: .cancel) { reason = "" }
        }
    }

    private func refresh() async { if let m = try? await ExtraAPI.ticketMessages(ticket.id), m.map(\.id) != messages.map(\.id) { messages = m } }
    private func escalate() async {
        let r = reason.trimmingCharacters(in: .whitespaces); guard !r.isEmpty else { return }
        do { try await ExtraAPI.escalate(ticket.id, reason: r); reason = ""; onChange() } catch { self.error = error.localizedDescription }
    }

    private func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines); guard !text.isEmpty else { return }
        draft = ""; error = nil
        do { let m = try await ExtraAPI.sendTicketMessage(ticket.id, text); if !messages.contains(where: { $0.id == m.id }) { messages.append(m) } }
        catch { self.error = error.localizedDescription; draft = text }
    }
    private func status(_ s: String) async { do { _ = try await ExtraAPI.setTicketStatus(ticket.id, s); onChange() } catch { self.error = error.localizedDescription } }
}

// MARK: - AI chat

struct AIChatView: View {
    @State private var session: AiSession?
    @State private var messages: [AiMessage] = []
    @State private var draft = ""
    @State private var sending = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if messages.isEmpty { EmptyState(icon: "sparkles", title: t("Trợ lý SÖL", "SÖL assistant"), subtitle: t("Hỏi về lịch tập, dinh dưỡng, gói tập…", "Ask about training, nutrition, plans…")) }
                        ForEach(messages) { m in
                            let mine = m.sender == "member"
                            HStack { if mine { Spacer(minLength: 48) }
                                Text(m.message).padding(.horizontal, 14).padding(.vertical, 9)
                                    .background(mine ? Theme.accent : Theme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(mine ? .clear : Theme.border))
                                    .foregroundStyle(mine ? Theme.onAccent : Theme.text)
                                if !mine { Spacer(minLength: 48) } }.id(m.id)
                        }
                        if sending { ProgressView().frame(maxWidth: .infinity, alignment: .leading) }
                    }.padding(Metrics.pad)
                }.onChange(of: messages.count) { _, _ in if let id = messages.last?.id { proxy.scrollTo(id, anchor: .bottom) } }
            }
            if let error { ErrorBanner(message: error).padding(.horizontal, Metrics.pad) }
            HStack(spacing: 8) {
                TextField(t("Hỏi trợ lý…", "Ask the assistant…"), text: $draft, axis: .vertical).lineLimit(1...4).padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.border))
                Button { Task { await send() } } label: { Image(systemName: "arrow.up.circle.fill").font(.system(size: 34)).foregroundStyle(draft.isEmpty || sending ? Theme.textMuted : Theme.accent) }.disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty || sending)
            }.padding(Metrics.pad).background(Theme.background)
        }
        .navigationTitle(t("Trợ lý AI", "AI assistant")).navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .primaryAction) { Button(t("Mới", "New")) { Task { await fresh() } } } }
        .screenBackground()
        .task { await open() }
    }

    private func open() async {
        do {
            if let latest = try await ExtraAPI.aiSessions().sorted(by: { $0.id > $1.id }).first { session = latest; messages = try await ExtraAPI.aiHistory(latest.id) }
        } catch { self.error = error.localizedDescription }
    }
    private func fresh() async { do { session = try await ExtraAPI.createAiSession(); messages = [] } catch { self.error = error.localizedDescription } }
    private func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines); guard !text.isEmpty else { return }
        draft = ""; error = nil; sending = true
        defer { sending = false }
        do {
            if session == nil { session = try await ExtraAPI.createAiSession() }
            let r = try await ExtraAPI.aiSend(session!.id, text)
            messages.append(r.memberMessage); messages.append(r.aiMessage)
        } catch { self.error = error.localizedDescription; draft = text }
    }
}
