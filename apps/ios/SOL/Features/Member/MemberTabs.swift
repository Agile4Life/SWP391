import SwiftUI

struct MemberTabs: View {
    @State private var tab = Demo.initialTab
    @Environment(AuthStore.self) private var auth
    @State private var unread = 0

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { DashboardView() }
                .tabItem { Label(t("Tổng quan", "Home"), systemImage: "square.grid.2x2") }
                .tag(0)
            NavigationStack { ClassesView() }
                .tabItem { Label(t("Lớp học", "Classes"), systemImage: "calendar") }
                .tag(1)
            NavigationStack { MemberCardView() }
                .tabItem { Label(t("Thẻ QR", "QR card"), systemImage: "qrcode") }
                .tag(2)
            NavigationStack { PackagesView() }
                .tabItem { Label(t("Gói tập", "Plans"), systemImage: "creditcard") }
                .tag(3)
            NavigationStack { MemberMoreView(unread: $unread) }
                .tabItem { Label(t("Thêm", "More"), systemImage: "ellipsis.circle") }
                .tag(4)
                .badge(unread)
        }
        .task { unread = (try? await MemberAPI.unreadCount()) ?? 0 }
    }
}

struct MemberMoreView: View {
    @Environment(AuthStore.self) private var auth
    @Binding var unread: Int

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                NavigationLink { ProfileView() } label: {
                    HStack(spacing: 14) {
                        Avatar(name: auth.user?.fullName ?? "?", size: 52)
                        VStack(alignment: .leading) {
                            Text(auth.user?.fullName ?? "").font(.headline).foregroundStyle(Theme.text)
                            Text(t("Hồ sơ cá nhân", "My profile")).font(.subheadline).foregroundStyle(Theme.textMuted)
                        }
                        Spacer(); Image(systemName: "chevron.right").foregroundStyle(Theme.textMuted)
                    }.card()
                }.buttonStyle(.plain)
                MoreLink(icon: "bell", title: t("Thông báo", "Notifications"), badge: unread) { NotificationsView(onChange: { unread = $0 }) }
                MoreLink(icon: "bubble.left.and.bubble.right", title: t("Tin nhắn", "Messages")) { ChatListView() }
                MoreLink(icon: "figure.strengthtraining.traditional", title: t("PT 1:1", "1:1 coaching")) { CoachBookingView() }
                MoreLink(icon: "sparkles", title: t("Trợ lý AI", "AI assistant")) { AIChatView() }
                MoreLink(icon: "lifepreserver", title: t("Hỗ trợ", "Support")) { SupportView() }
                MoreLink(icon: "person.badge.shield.checkmark", title: t("Xác minh danh tính", "Identity verification")) { KycView() }
                MoreLink(icon: "sportscourt", title: t("Đặt sân", "Courts")) { CourtsView() }
                MoreLink(icon: "bag", title: t("Cửa hàng", "Shop")) { ShopView() }
                MoreLink(icon: "checkmark.seal", title: t("Check-in & chuỗi tập", "Check-in & streak")) { CheckInView() }
                MoreLink(icon: "chart.line.uptrend.xyaxis", title: t("Tiến độ & giáo án", "Progress & plans")) { ProgressPlansView() }
                MoreLink(icon: "wallet.bifold", title: t("Ví SÖL", "SÖL wallet")) { WalletView() }
                MoreLink(icon: "doc.text", title: t("Thanh toán & hoá đơn", "Payments & invoices")) { PaymentsView() }
                SettingsSection()
            }.padding(Metrics.pad)
        }
        .navigationTitle(t("Thêm", "More"))
        .screenBackground()
    }
}

struct MoreLink<Destination: View>: View {
    let icon: String
    let title: String
    var badge: Int = 0
    @ViewBuilder let destination: () -> Destination
    var body: some View {
        NavigationLink(destination: destination) {
            HStack(spacing: 14) {
                Image(systemName: icon).frame(width: 28).foregroundStyle(Theme.accent)
                Text(title).foregroundStyle(Theme.text).font(.body.weight(.medium))
                Spacer()
                if badge > 0 { Text("\(badge)").font(.caption.bold()).padding(.horizontal, 8).padding(.vertical, 3).background(Theme.accent, in: Capsule()).foregroundStyle(Theme.onAccent) }
                Image(systemName: "chevron.right").font(.footnote).foregroundStyle(Theme.textMuted)
            }.card()
        }.buttonStyle(.plain)
    }
}
