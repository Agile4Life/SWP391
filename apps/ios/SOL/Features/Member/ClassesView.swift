import SwiftUI

struct ClassesData { var classes: [GymClass]; var mine: [ClassEnrollment]; var quota: Quota? }

struct ClassesView: View {
    @State private var tab = 0
    @State private var loader = Loader<ClassesData> {
        async let classes = MemberAPI.classes()
        async let mine = MemberAPI.myCourseEnrollments()
        async let quota = try? MemberAPI.quota()
        return ClassesData(classes: try await classes, mine: try await mine, quota: await quota)
    }
    @State private var busy: Int?
    @State private var message: String?
    @State private var isError = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Picker("", selection: $tab) { Text(t("Khoá học", "Courses")).tag(0); Text(t("Lịch của tôi", "My schedule")).tag(1) }.pickerStyle(.segmented)
                if let message { if isError { ErrorBanner(message: message) } else { Text(message).font(.subheadline).foregroundStyle(Theme.success).frame(maxWidth: .infinity, alignment: .leading).padding(12).background(Theme.success.opacity(0.12), in: RoundedRectangle(cornerRadius: 12)) } }
                LoadView(loader) { d in
                    if tab == 0 { courses(d) } else { schedule(d) }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Lớp học", "Classes")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }

    private func enrolled(_ d: ClassesData, _ c: GymClass) -> ClassEnrollment? { d.mine.first { $0.classId == c.id && $0.status != "cancelled" } }

    @ViewBuilder private func courses(_ d: ClassesData) -> some View {
        if let q = d.quota {
            Text(q.unlimited == true ? t("Gói của bạn: khoá học miễn phí không giới hạn.", "Your plan: unlimited free courses.") : t("Còn \(q.remainingCredits ?? 0)/\(q.totalCredits ?? 0) lượt khoá học miễn phí.", "\(q.remainingCredits ?? 0)/\(q.totalCredits ?? 0) free course credits left."))
                .font(.subheadline).foregroundStyle(Theme.textMuted).frame(maxWidth: .infinity, alignment: .leading)
            if let until = q.enrollBlockedUntil { ErrorBanner(message: t("Bạn chưa thể đăng ký khoá mới đến \(Fmt.day(until)) do vắng quá nhiều buổi.", "You cannot join a new course until \(Fmt.day(until)) after missing too many sessions.")) }
        }
        if d.classes.isEmpty { EmptyState(icon: "calendar", title: t("Chưa có khoá học", "No courses available")).card() }
        ForEach(d.classes) { c in
            VStack(alignment: .leading, spacing: 8) {
                HStack { Text(c.name).font(.headline).foregroundStyle(Theme.text); Spacer(); if let l = c.level { Pill(text: l.capitalized, tone: .accent) } }
                if let desc = c.description, !desc.isEmpty { Text(desc).font(.subheadline).foregroundStyle(Theme.textMuted).lineLimit(3) }
                LabeledRow(label: t("Huấn luyện viên", "Coach"), value: c.coachName ?? "—")
                LabeledRow(label: t("Giờ học", "Time"), value: "\(Fmt.time(c.startTime)) – \(Fmt.time(c.endTime))")
                if let days = c.recurringDays { LabeledRow(label: t("Ngày", "Days"), value: days) }
                if let s = c.startDate, let e = c.endDate { LabeledRow(label: t("Thời gian", "Period"), value: "\(Fmt.day(s)) – \(Fmt.day(e))") }
                if let p = c.price { LabeledRow(label: t("Học phí", "Fee"), value: Fmt.money(p)) }
                if let e = enrolled(d, c) {
                    HStack { Pill(text: t("Đã đăng ký", "Enrolled"), tone: .success); Spacer()
                        Button(t("Huỷ", "Cancel")) { Task { await run(c.id) { _ = try await MemberAPI.leave(c.id) } } }.buttonStyle(.solSecondary).disabled(busy == c.id) }
                    if let a = e.attendedSessions, let total = e.totalSessions { Text(t("Đã học \(a)/\(total) buổi", "Attended \(a)/\(total) sessions")).font(.caption).foregroundStyle(Theme.textMuted) }
                } else {
                    Button(t("Đăng ký", "Enroll")) { Task { await run(c.id) { _ = try await MemberAPI.enroll(c.id) } } }.buttonStyle(.solPrimary).disabled(busy == c.id)
                }
            }.card()
        }
    }

    @ViewBuilder private func schedule(_ d: ClassesData) -> some View {
        let upcoming = d.mine.filter { $0.status == "booked" }
        if upcoming.isEmpty { EmptyState(icon: "calendar.badge.clock", title: t("Chưa có lịch học", "No scheduled classes"), subtitle: t("Đăng ký khoá học để thấy lịch tại đây.", "Enroll in a course to see it here.")).card() }
        ForEach(upcoming) { ClassRow(enrollment: $0) }
    }

    private func run(_ id: Int, _ action: @escaping () async throws -> Void) async {
        busy = id; message = nil
        defer { busy = nil }
        do { try await action(); isError = false; message = t("Đã cập nhật.", "Updated."); await loader.load(silent: true) }
        catch { isError = true; message = error.localizedDescription }
    }
}
