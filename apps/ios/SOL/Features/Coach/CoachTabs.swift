import SwiftUI

private struct BatchBody: Encodable { let publishEvaluations: Bool; let records: [Record]
    struct Record: Encodable { let memberId: Int; let status: String; let progressScore: Int; let notes: String } }
struct RosterEntry: Identifiable, Hashable {
    let memberId: Int; let fullName: String; let code: String
    var status: String; var score: Int; var notes: String
    var id: Int { memberId }
}
private struct RosterResponse: Decodable {
    struct M: Decodable { let memberId: Int; let fullName: String; let memberCode: String?; let membershipCode: String?; let status: String?; let attendanceStatus: String?; let notes: String?; let progressScore: Int? }
    let members: [M]?
}

enum CoachAPI {
    static func sessions(from: String, to: String) async throws -> [ClassSession] {
        let p: Profile = try await MemberAPI.profile()
        return try await APIClient.shared.get("/classes/sessions", query: ["coachId": String(p.userId), "fromDate": from, "toDate": to])
    }
    static func roster(_ sessionId: Int) async throws -> [RosterEntry] {
        let r: RosterResponse = try await APIClient.shared.get("/attendance/sessions/\(sessionId)")
        return (r.members ?? []).map { RosterEntry(memberId: $0.memberId, fullName: $0.fullName, code: $0.membershipCode ?? $0.memberCode ?? "MB-\($0.memberId)", status: $0.attendanceStatus ?? $0.status ?? "present", score: $0.progressScore ?? 80, notes: $0.notes ?? "") }
    }
    static func save(_ sessionId: Int, _ entries: [RosterEntry]) async throws {
        let _: Empty? = try await APIClient.shared.post("/attendance/sessions/\(sessionId)/batch", body: BatchBody(publishEvaluations: false, records: entries.map { .init(memberId: $0.memberId, status: $0.status, progressScore: $0.score, notes: $0.notes) }))
    }
}

struct CoachTabs: View {
    @State private var tab = Demo.initialTab
    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { CoachScheduleView() }.tabItem { Label(t("Lịch dạy", "Schedule"), systemImage: "calendar") }
                .tag(0)
            NavigationStack { StaffMoreView() }.tabItem { Label(t("Thêm", "More"), systemImage: "ellipsis.circle") }
                .tag(1)
        }
    }
}

struct CoachScheduleView: View {
    @State private var loader = Loader<[ClassSession]> {
        let from = Fmt.todayString()
        let to = Fmt.dayString(Calendar.current.date(byAdding: .day, value: 14, to: Date()) ?? Date())
        return try await CoachAPI.sessions(from: from, to: to)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "calendar", title: t("Chưa có buổi dạy trong 14 ngày tới", "No sessions in the next 14 days")).card() }
                    let groups = Dictionary(grouping: list, by: \.sessionDate).sorted { $0.key < $1.key }
                    ForEach(groups, id: \.key) { day, items in
                        SectionTitle(Fmt.weekdayDay(day))
                        ForEach(items.sorted { $0.startTime < $1.startTime }) { s in
                            NavigationLink { AttendanceView(session: s) } label: { SessionCard(session: s) }.buttonStyle(.plain)
                        }
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Lịch dạy", "Teaching schedule")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }
}

struct AttendanceView: View {
    let session: ClassSession
    @State private var loader: Loader<[RosterEntry]>
    @State private var entries: [RosterEntry] = []
    @State private var seeded = false
    @State private var busy = false
    @State private var message: String?
    @State private var isError = false

    init(session: ClassSession) {
        self.session = session
        _loader = State(initialValue: Loader { try await CoachAPI.roster(session.id) })
    }

    private let statuses = ["present", "late", "absent", "excused"]
    private func label(_ s: String) -> String { switch s { case "present": t("Có mặt", "Present"); case "late": t("Trễ", "Late"); case "absent": t("Vắng", "Absent"); default: t("Có phép", "Excused") } }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                SessionCard(session: session)
                LoadView(loader) { list in
                    Color.clear.frame(height: 0).onAppear { if !seeded { entries = list; seeded = true } }
                    if list.isEmpty { EmptyState(icon: "person.2.slash", title: t("Chưa có học viên", "No members enrolled")).card() }
                    ForEach($entries) { $e in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Avatar(name: e.fullName, size: 36); VStack(alignment: .leading) { Text(e.fullName).font(.headline); Text(e.code).font(.caption).foregroundStyle(Theme.textMuted) } }
                            Picker("", selection: $e.status) { ForEach(statuses, id: \.self) { Text(label($0)).tag($0) } }.pickerStyle(.segmented)
                            Stepper(value: $e.score, in: 0...100, step: 5) { Text(t("Điểm tiến bộ: \(e.score)", "Progress score: \(e.score)")).font(.subheadline) }
                            TextField(t("Ghi chú", "Notes"), text: $e.notes).textFieldStyle(.roundedBorder)
                        }.card()
                    }
                }
                if let message { if isError { ErrorBanner(message: message) } else { Text(message).foregroundStyle(Theme.success) } }
                if seeded && !entries.isEmpty { Button { Task { await save() } } label: { if busy { ProgressView() } else { Text(t("LƯU ĐIỂM DANH", "SAVE ATTENDANCE")) } }.buttonStyle(.solPrimary).disabled(busy) }
            }.padding(Metrics.pad)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle(t("Điểm danh", "Attendance")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }

    private func save() async {
        busy = true; message = nil
        defer { busy = false }
        do { try await CoachAPI.save(session.id, entries); isError = false; message = t("Đã lưu điểm danh.", "Attendance saved.") }
        catch { isError = true; message = error.localizedDescription }
    }
}
