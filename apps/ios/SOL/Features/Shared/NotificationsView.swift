import SwiftUI

/// Thông báo dùng chung mọi role (API `/notifications`).
struct NotificationsView: View {
    var onChange: (Int) -> Void = { _ in }
    @State private var loader = Loader { try await MemberAPI.notifications() }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                LoadView(loader) { list in
                    if list.isEmpty { EmptyState(icon: "bell.slash", title: t("Chưa có thông báo", "No notifications")).card() }
                    ForEach(list) { n in
                        Button { Task { await read(n) } } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack { if !n.isRead { Circle().fill(Theme.accent).frame(width: 8, height: 8) }
                                    Text(n.title).font(.headline).foregroundStyle(Theme.text); Spacer() }
                                Text(n.message).font(.subheadline).foregroundStyle(Theme.textMuted)
                                Text(Fmt.dayTime(n.createdAt)).font(.caption).foregroundStyle(Theme.textMuted)
                            }.card().opacity(n.isRead ? 0.75 : 1)
                        }.buttonStyle(.plain)
                    }
                }
            }.padding(Metrics.pad)
        }
        .refreshable { await loader.load(silent: true); report() }
        .navigationTitle(t("Thông báo", "Notifications")).navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .primaryAction) { Button(t("Đọc hết", "Mark all")) { Task { try? await MemberAPI.markAllRead(); await loader.load(silent: true); report() } } } }
        .screenBackground()
        .task { try? await Task.sleep(for: .milliseconds(600)); report() }
    }

    private func report() { onChange(loader.value?.filter { !$0.isRead }.count ?? 0) }
    private func read(_ n: AppNotification) async {
        guard !n.isRead else { return }
        try? await MemberAPI.markRead(n.id)
        await loader.load(silent: true); report()
    }
}
