import SwiftUI

struct StaffTabs: View {
    @State private var tab = Demo.initialTab
    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { ReceptionView() }.tabItem { Label(t("Lễ tân", "Reception"), systemImage: "person.badge.clock") }
                .tag(0)
            NavigationStack { StaffCheckInView() }.tabItem { Label(t("Check-in", "Check-in"), systemImage: "qrcode.viewfinder") }
                .tag(1)
            NavigationStack { TodaySessionsView(title: t("Lớp hôm nay", "Today's classes"), coachOnly: false) }.tabItem { Label(t("Lớp học", "Classes"), systemImage: "calendar") }
                .tag(2)
            NavigationStack { StaffMoreView() }.tabItem { Label(t("Thêm", "More"), systemImage: "ellipsis.circle") }
                .tag(3)
        }
    }
}

struct StaffMoreView: View {
    @Environment(AuthStore.self) private var auth
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                RoleHeader()
                MoreLink(icon: "bell", title: t("Thông báo", "Notifications")) { NotificationsView() }
                SettingsSection()
            }.padding(Metrics.pad)
        }.navigationTitle(t("Thêm", "More")).screenBackground()
    }
}

struct RoleHeader: View {
    @Environment(AuthStore.self) private var auth
    var body: some View {
        NavigationLink { ProfileView() } label: {
            HStack(spacing: 14) {
                Avatar(name: auth.user?.fullName ?? "?", size: 52)
                VStack(alignment: .leading) {
                    Text(auth.user?.fullName ?? "").font(.headline).foregroundStyle(Theme.text)
                    Text(roleName).font(.subheadline).foregroundStyle(Theme.textMuted)
                }
                Spacer(); Image(systemName: "chevron.right").foregroundStyle(Theme.textMuted)
            }.card()
        }.buttonStyle(.plain)
    }
    private var roleName: String {
        switch auth.user?.role { case .staff: t("Lễ tân", "Receptionist"); case .coach: t("Huấn luyện viên", "Coach"); case .manager: t("Quản lý trung tâm", "Center manager"); case .admin: "Admin"; default: t("Hội viên", "Member") }
    }
}

// MARK: - Reception

struct ReceptionData { var pending: [PendingSubscription]; var holds: [HoldRequest] }

struct ReceptionView: View {
    @State private var loader = Loader<ReceptionData> {
        async let p = StaffAPI.pending()
        async let h = StaffAPI.holds()
        return ReceptionData(pending: try await p, holds: try await h)
    }
    @State private var message: String?
    @State private var isError = false
    @State private var busy: Int?
    @State private var query = ""
    @State private var results: [MemberLookup] = []

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if let message { if isError { ErrorBanner(message: message) } else { Text(message).foregroundStyle(Theme.success).frame(maxWidth: .infinity, alignment: .leading).padding(12).background(Theme.success.opacity(0.12), in: RoundedRectangle(cornerRadius: 12)) } }
                if query.count >= 2 { lookup }
                else {
                    LoadView(loader) { d in
                        SectionTitle(t("Yêu cầu gói chờ thu tiền", "Plan requests awaiting payment"))
                        if d.pending.isEmpty { EmptyState(icon: "checkmark.circle", title: t("Không có yêu cầu chờ", "No pending requests")).card() }
                        ForEach(d.pending) { p in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack { Text(p.memberName).font(.headline); Spacer(); if let c = p.membershipCode { Pill(text: c, tone: .accent) } }
                                LabeledRow(label: t("Gói", "Plan"), value: p.packageName)
                                LabeledRow(label: t("Số tiền", "Amount"), value: Fmt.money(p.packagePrice))
                                LabeledRow(label: t("Hiệu lực", "Valid"), value: "\(Fmt.day(p.startDate)) – \(Fmt.day(p.endDate))")
                                HStack {
                                    Button(t("Thu tiền mặt", "Collect cash")) { Task { await run(p.id) { try await StaffAPI.collect(p, method: "cash") } } }.buttonStyle(.solPrimary)
                                    Button(t("Huỷ", "Cancel")) { Task { await run(p.id) { try await StaffAPI.cancelPending(p.id) } } }.buttonStyle(.solSecondary)
                                }.disabled(busy == p.id)
                            }.card()
                        }
                        SectionTitle(t("Yêu cầu bảo lưu", "Hold requests"))
                        if d.holds.isEmpty { EmptyState(icon: "pause.circle", title: t("Không có yêu cầu bảo lưu", "No hold requests")).card() }
                        ForEach(d.holds) { h in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(h.memberName).font(.headline)
                                LabeledRow(label: t("Gói", "Plan"), value: h.packageName)
                                if let r = h.holdReason { LabeledRow(label: t("Lý do", "Reason"), value: r) }
                                if let n = h.cancelledEnrollmentsCount, n > 0 { Text(t("Duyệt sẽ huỷ \(n) lịch học tương lai.", "Approving cancels \(n) future classes.")).font(.caption).foregroundStyle(Theme.warning) }
                                HStack {
                                    Button(t("Duyệt", "Approve")) { Task { await run(h.id) { try await StaffAPI.approveHold(h.id) } } }.buttonStyle(.solPrimary)
                                    Button(t("Từ chối", "Reject")) { Task { await run(h.id) { try await StaffAPI.rejectHold(h.id) } } }.buttonStyle(.solSecondary)
                                }.disabled(busy == h.id)
                            }.card()
                        }
                    }
                }
            }.padding(Metrics.pad)
        }
        .searchable(text: $query, prompt: t("Tìm hội viên: SĐT, mã, tên", "Find member: phone, code, name"))
        .onChange(of: query) { _, q in Task { await search(q) } }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Lễ tân", "Reception")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }

    @ViewBuilder private var lookup: some View {
        if results.isEmpty { EmptyState(icon: "magnifyingglass", title: t("Không tìm thấy hội viên", "No members found")).card() }
        ForEach(results) { m in
            VStack(alignment: .leading, spacing: 6) {
                HStack { Avatar(name: m.fullName, size: 40); VStack(alignment: .leading) { Text(m.fullName).font(.headline); Text(m.membershipCode ?? "").font(.caption).foregroundStyle(Theme.textMuted) }; Spacer(); if let s = m.status { Pill(text: s, tone: s == "active" ? .success : .neutral) } }
                if let p = m.phone { LabeledRow(label: t("SĐT", "Phone"), value: p) }
                if let e = m.email { LabeledRow(label: "Email", value: e) }
                if let p = m.currentPackage { LabeledRow(label: t("Gói hiện tại", "Current plan"), value: p + (m.endDate.map { " · \(Fmt.day($0))" } ?? "")) }
            }.card()
        }
    }

    private func search(_ q: String) async {
        guard q.count >= 2 else { results = []; return }
        try? await Task.sleep(for: .milliseconds(350))
        guard q == query else { return }
        results = (try? await StaffAPI.lookup(q)) ?? []
    }

    private func run(_ id: Int, _ action: @escaping () async throws -> Void) async {
        busy = id; message = nil
        defer { busy = nil }
        do { try await action(); isError = false; message = t("Đã xử lý.", "Done."); await loader.load(silent: true) }
        catch { isError = true; message = error.localizedDescription }
    }
}

// MARK: - Staff check-in

struct StaffCheckInView: View {
    @State private var loader = Loader { try await StaffAPI.history(from: Fmt.todayString(), to: Fmt.todayString()) }
    @State private var scanning = false
    @State private var last: Checkin?
    @State private var error: String?
    @State private var manual = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Button { scanning = true } label: { Label(t("Quét QR hội viên", "Scan member QR"), systemImage: "qrcode.viewfinder") }.buttonStyle(.solPrimary)
                HStack { SOLField(label: t("Hoặc nhập mã QR", "Or enter QR code"), text: $manual) ; Button(t("Gửi", "Send")) { let m = manual; manual = ""; Task { await submit(m) } }.buttonStyle(.solSecondary).padding(.top, 22).disabled(manual.isEmpty) }
                ErrorBanner(message: error)
                if let c = last {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack { Image(systemName: c.granted ? "checkmark.circle.fill" : "xmark.octagon.fill").font(.title).foregroundStyle(c.granted ? Theme.success : Theme.danger)
                            Text(c.granted ? t("Cho vào", "Access granted") : t("Từ chối", "Denied")).font(.title3.weight(.bold)) }
                        Text(c.memberName ?? "").font(.headline)
                        if let p = c.packageName { LabeledRow(label: t("Gói", "Plan"), value: p) }
                        if let d = c.remainingDays { LabeledRow(label: t("Còn lại", "Remaining"), value: t("\(d) ngày", "\(d) days")) }
                        if let r = c.denialReason, !c.granted { Text(r).foregroundStyle(Theme.danger) }
                    }.card()
                }
                SectionTitle(t("Hôm nay", "Today"))
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "clock", title: t("Chưa có lượt check-in", "No check-ins yet")).card() }
                    ForEach(list) { c in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(c.memberName ?? "#\(c.memberId ?? 0)").font(.headline).foregroundStyle(Theme.text)
                                Text(Fmt.dayTime(c.checkInTime)).font(.caption).foregroundStyle(Theme.textMuted)
                            }
                            Spacer()
                            if c.checkOutTime == nil, c.granted { Button(t("Ra", "Out")) { Task { await out(c) } }.buttonStyle(.solSecondary) }
                            else { Pill(text: c.granted ? t("Hợp lệ", "OK") : t("Từ chối", "Denied"), tone: c.granted ? .success : .danger) }
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Check-in", "Check-in")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
        .fullScreenCover(isPresented: $scanning) {
            ZStack(alignment: .topTrailing) {
                QRScannerView { code in scanning = false; Task { await submit(code) } }.ignoresSafeArea()
                Button { scanning = false } label: { Image(systemName: "xmark.circle.fill").font(.largeTitle).foregroundStyle(.white).padding() }
            }
        }
    }

    private func submit(_ code: String) async {
        error = nil
        do { last = try await StaffAPI.scan(code); await loader.load(silent: true) }
        catch { self.error = error.localizedDescription }
    }

    private func out(_ c: Checkin) async {
        do { _ = try await StaffAPI.checkout(c.id); await loader.load(silent: true) }
        catch { self.error = error.localizedDescription }
    }
}

// MARK: - Sessions (staff & coach)

struct TodaySessionsView: View {
    let title: String
    let coachOnly: Bool
    @State private var day = Date()
    @State private var loader: Loader<[ClassSession]>

    init(title: String, coachOnly: Bool) {
        self.title = title; self.coachOnly = coachOnly
        _loader = State(initialValue: Loader { try await MemberAPI.sessions(from: Fmt.todayString(), to: Fmt.todayString()) })
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "calendar", title: t("Không có buổi học hôm nay", "No sessions today")).card() }
                    ForEach(list.sorted { $0.startTime < $1.startTime }) { s in SessionCard(session: s) }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(title).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }
}

struct SessionCard: View {
    let session: ClassSession
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack { Text(session.className).font(.headline).foregroundStyle(Theme.text); Spacer(); Pill(text: statusText, tone: session.status == "completed" ? .success : session.status == "cancelled" ? .danger : .accent) }
            Text("\(Fmt.time(session.startTime)) – \(Fmt.time(session.endTime))" + (session.roomName.map { " · \($0)" } ?? "")).font(.subheadline).foregroundStyle(Theme.textMuted)
            HStack {
                if let c = session.coachName { Label(c, systemImage: "person").font(.caption).foregroundStyle(Theme.textMuted) }
                Spacer()
                if let cap = session.capacity { Label("\(session.bookedCount ?? 0)/\(cap)", systemImage: "person.2").font(.caption).foregroundStyle(Theme.textMuted) }
            }
        }.card()
    }
    private var statusText: String {
        switch session.status { case "completed": t("Hoàn thành", "Completed"); case "cancelled": t("Đã huỷ", "Cancelled"); default: t("Sắp diễn ra", "Scheduled") }
    }
}
