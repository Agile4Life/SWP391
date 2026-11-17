import SwiftUI
import Charts

struct ProgressData { var metrics: [HealthMetric]; var plans: [TrainingPlan] }

struct ProgressPlansView: View {
    @State private var loader = Loader<ProgressData> {
        async let m = MemberAPI.healthMetrics()
        async let p = MemberAPI.trainingPlans()
        return ProgressData(metrics: try await m, plans: try await p)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                LoadView(loader) { d in
                    SectionTitle(t("Chỉ số sức khoẻ", "Health metrics"))
                    if d.metrics.isEmpty { EmptyState(icon: "heart.text.square", title: t("Chưa có chỉ số", "No metrics yet"), subtitle: t("Huấn luyện viên sẽ cập nhật chỉ số của bạn.", "Your coach will record your metrics.")).card() }
                    let groups = Dictionary(grouping: d.metrics, by: \.metricName).sorted { $0.key < $1.key }
                    ForEach(groups, id: \.key) { name, items in
                        let sorted = items.sorted { $0.recordedAt < $1.recordedAt }
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Text(name).font(.headline).foregroundStyle(Theme.text); Spacer()
                                if let last = sorted.last { Text("\(last.metricValue.formatted()) \(last.unit ?? "")").font(.title3.weight(.bold)).foregroundStyle(Theme.accentText) } }
                            if sorted.count > 1 {
                                Chart(sorted) { m in
                                    LineMark(x: .value("t", Fmt.date(m.recordedAt) ?? Date()), y: .value(name, m.metricValue)).foregroundStyle(Theme.accent)
                                    PointMark(x: .value("t", Fmt.date(m.recordedAt) ?? Date()), y: .value(name, m.metricValue)).foregroundStyle(Theme.accent)
                                }.frame(height: 120)
                            }
                        }.card()
                    }
                    SectionTitle(t("Giáo án tập luyện", "Training plans"))
                    if d.plans.isEmpty { EmptyState(icon: "list.clipboard", title: t("Chưa có giáo án", "No training plans")).card() }
                    ForEach(d.plans) { plan in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Text(plan.goal ?? t("Giáo án", "Plan")).font(.headline); Spacer(); Pill(text: plan.status, tone: .accent) }
                            if let c = plan.coachName { Text(t("HLV: ", "Coach: ") + c).font(.subheadline).foregroundStyle(Theme.textMuted) }
                            if let s = plan.startDate, let e = plan.endDate { Text("\(Fmt.day(s)) – \(Fmt.day(e))").font(.caption).foregroundStyle(Theme.textMuted) }
                            ForEach(plan.items.sorted { ($0.dayOfWeek ?? 0, $0.orderIndex ?? 0) < ($1.dayOfWeek ?? 0, $1.orderIndex ?? 0) }) { it in
                                HStack(alignment: .top) {
                                    Text(it.dayOfWeek.map { dayName($0) } ?? "").font(.caption.weight(.bold)).frame(width: 36, alignment: .leading).foregroundStyle(Theme.accentText)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(it.exerciseName).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                                        Text(detail(it)).font(.caption).foregroundStyle(Theme.textMuted)
                                    }
                                }
                            }
                        }.card()
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true) }
        .navigationTitle(t("Tiến độ & giáo án", "Progress & plans")).navigationBarTitleDisplayMode(.inline)
        .screenBackground()
    }

    private func dayName(_ d: Int) -> String {
        let vi = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"], en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        return (Lang.shared.isEnglish ? en : vi)[((d % 7) + 7) % 7]
    }
    private func detail(_ i: TrainingItem) -> String {
        var parts: [String] = []
        if let s = i.sets, let r = i.reps { parts.append("\(s) × \(r)") }
        if let m = i.durationMinutes { parts.append(t("\(m) phút", "\(m) min")) }
        if let r = i.restSeconds { parts.append(t("nghỉ \(r)s", "rest \(r)s")) }
        return parts.joined(separator: " · ")
    }
}
