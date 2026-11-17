import SwiftUI

struct DashboardData {
    var subscription: Subscription?
    var classes: [ClassEnrollment]
    var streak: WorkoutStreak?
    var wallet: Wallet?
}

struct DashboardView: View {
    @Environment(AuthStore.self) private var auth
    @State private var realtime: RealtimeSubscription?
    @State private var loader = Loader<DashboardData> {
        async let sub = MemberAPI.currentSubscription()
        async let classes = MemberAPI.upcomingEnrollments()
        async let streak = try? MemberAPI.streak()
        async let wallet = try? MemberAPI.wallet()
        return DashboardData(subscription: try await sub, classes: try await classes, streak: await streak, wallet: await wallet)
    }

    var body: some View {
        ScrollView {
            LoadView(loader) { d in
                VStack(spacing: 16) {
                    HStack(spacing: 14) {
                        Avatar(name: auth.user?.fullName ?? "?", size: 56)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(t("Xin chào,", "Hello,")).foregroundStyle(Theme.textMuted)
                            Text(auth.user?.fullName ?? "").font(.title2.weight(.bold)).foregroundStyle(Theme.text)
                        }
                        Spacer()
                    }
                    membershipCard(d.subscription)
                    HStack(spacing: 12) {
                        StatTile(label: t("Chuỗi hiện tại", "Current streak"), value: t("\(d.streak?.currentStreak ?? 0) ngày", "\(d.streak?.currentStreak ?? 0) days"), icon: "flame")
                        StatTile(label: t("Số dư ví", "Wallet"), value: Fmt.money(d.wallet?.balance), icon: "wallet.bifold")
                    }
                    SectionTitle(t("Lớp sắp tới", "Upcoming classes"))
                    if d.classes.isEmpty {
                        EmptyState(icon: "calendar.badge.plus", title: t("Chưa có lớp nào", "No upcoming classes"), subtitle: t("Đăng ký lớp ở tab Lớp học.", "Enroll in the Classes tab.")).card()
                    } else {
                        ForEach(d.classes.prefix(5)) { c in ClassRow(enrollment: c) }
                    }
                }.padding(Metrics.pad)
            }
        }
        .onAppear { let rt = RealtimeSubscription(sessionPath: "/memberships/subscriptions/realtime-session", isPrivate: false) { Task { await loader.load(silent: true) } }; realtime = rt; rt.start() }
        .onDisappear { realtime?.stop(); realtime = nil }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Tổng quan", "Overview"))
        .navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }

    @ViewBuilder private func membershipCard(_ s: Subscription?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let s, s.isActive {
                HStack { Text(s.packageName).font(.title3.weight(.bold)); Spacer(); Pill(text: t("Đang hoạt động", "Active"), tone: .success) }
                let left = Fmt.daysLeft(until: s.endDate)
                Text(left.map { $0 >= 0 ? t("Còn \($0) ngày", "\($0) days left") : t("Đã hết hạn", "Expired") } ?? "").font(.title.weight(.heavy)).foregroundStyle(Theme.accentText)
                LabeledRow(label: t("Hiệu lực", "Valid"), value: "\(Fmt.day(s.startDate)) – \(Fmt.day(s.endDate))")
                if s.holdStatus == "approved" || s.holdStatus == "active" { Pill(text: t("Đang bảo lưu", "On hold"), tone: .warning) }
            } else {
                Text(t("Chưa có gói tập đang hoạt động", "No active plan")).font(.headline)
                Text(t("Chọn gói ở tab Gói tập để bắt đầu.", "Pick a plan in the Plans tab to start.")).font(.subheadline).foregroundStyle(Theme.textMuted)
            }
        }.card()
    }
}

struct ClassRow: View {
    let enrollment: ClassEnrollment
    var body: some View {
        HStack(spacing: 14) {
            VStack(spacing: 2) {
                Text(Fmt.date(enrollment.sessionDate).map { String(Calendar.current.component(.day, from: $0)) } ?? "–").font(.title2.weight(.bold))
                Text(Fmt.date(enrollment.sessionDate).map { $0.formatted(.dateTime.month(.abbreviated)) } ?? "").font(.caption).foregroundStyle(Theme.textMuted)
            }.frame(width: 52).foregroundStyle(Theme.accentText)
            VStack(alignment: .leading, spacing: 3) {
                Text(enrollment.className).font(.headline).foregroundStyle(Theme.text)
                Text("\(Fmt.time(enrollment.startTime)) – \(Fmt.time(enrollment.endTime))" + (enrollment.roomName.map { " · \($0)" } ?? "")).font(.subheadline).foregroundStyle(Theme.textMuted)
                if let coach = enrollment.coachName { Text(coach).font(.caption).foregroundStyle(Theme.textMuted) }
            }
            Spacer()
        }.card()
    }
}
