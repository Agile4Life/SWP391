import type { UserSession } from '../../shared/api/client';
import type { Language } from '../../shared/i18n';
import type { PortalIconName } from './PortalIcon';

export const ROLE_LABELS: Record<UserSession['role'], string> = {
  ADMIN: 'Quản trị hệ thống',
  MEMBER: 'Hội viên', STAFF: 'Lễ tân', COACH: 'Huấn luyện viên', MANAGER: 'Quản lý trung tâm',
};

export const ROLE_LABELS_EN: Record<UserSession['role'], string> = {
  ADMIN: 'System Administrator',
  MEMBER: 'Member',
  STAFF: 'Receptionist',
  COACH: 'Coach',
  MANAGER: 'Center Manager',
};

export function getRoleLabel(role: UserSession['role'], lang: Language = 'vi'): string {
  return lang === 'en' ? ROLE_LABELS_EN[role] : ROLE_LABELS[role];
}

/** Một tab con của mục sidebar gộp; mỗi tab vẫn là một route riêng nên URL cũ không đổi. */
export interface PortalNavTab { to: string; label: string; en: string }

export interface PortalNavItem {
  to: string;
  label: string;
  icon: PortalIconName;
  roles: UserSession['role'][];
  /** Mục gộp: sidebar chỉ hiện một icon, các màn con chuyển qua thanh tab ở đầu trang. */
  tabs?: PortalNavTab[];
}

export const PORTAL_NAV: PortalNavItem[] = [
  { to: '/member/dashboard', label: 'Bảng điều khiển', icon: 'board', roles: ['MEMBER'] },
  { to: '/member/packages', label: 'Gói tập & Bảo lưu', icon: 'package', roles: ['MEMBER'], tabs: [
    { to: '/member/packages', label: 'Gói tập', en: 'Memberships' },
    { to: '/member/hold', label: 'Bảo lưu', en: 'Hold' },
  ] },
  { to: '/member/classes', label: 'Lịch học & Đặt chỗ', icon: 'calendar', roles: ['MEMBER'] },
  { to: '/member/courts', label: 'Đặt sân', icon: 'court', roles: ['MEMBER'] },
  { to: '/member/card', label: 'Thẻ & Check-in', icon: 'card', roles: ['MEMBER'], tabs: [
    { to: '/member/card', label: 'Thẻ hội viên', en: 'Member card' },
    { to: '/member/check-in', label: 'Quét QR cổng', en: 'Gate QR' },
  ] },
  { to: '/member/invoices', label: 'Giao dịch & Hóa đơn', icon: 'receipt', roles: ['MEMBER'] },
  { to: '/member/orders', label: 'Sản phẩm & Đơn hàng', icon: 'bag', roles: ['MEMBER'] },
  { to: '/member/progress', label: 'Tiến độ & Giáo án', icon: 'chart', roles: ['MEMBER'] },
  { to: '/member/support', label: 'Hỗ trợ & Khiếu nại', icon: 'support', roles: ['MEMBER'] },
  { to: '/member/explore', label: 'Tham quan 3D', icon: 'compass', roles: ['MEMBER'] },
  { to: '/member/notifications', label: 'Thông báo', icon: 'bell', roles: ['MEMBER', 'COACH', 'MANAGER', 'STAFF'] },
  { to: '/coach/classes', label: 'Lịch dạy & Học viên HLV', icon: 'calendar', roles: ['COACH'] },
  { to: '/staff/attendance', label: 'Điểm danh', icon: 'check', roles: ['COACH'], tabs: [
    { to: '/staff/attendance', label: 'Lớp học', en: 'Classes' },
    { to: '/coach/pt-attendance', label: 'Buổi PT 1:1', en: '1:1 sessions' },
  ] },
  { to: '/coach/training-plans', label: 'Giáo án & Đánh giá', icon: 'dumbbell', roles: ['COACH'], tabs: [
    { to: '/coach/training-plans', label: 'Soạn giáo án', en: 'Plan builder' },
    { to: '/coach/health-metrics', label: 'Chỉ số sức khỏe', en: 'Health metrics' },
    { to: '/coach/saved-plans', label: 'Giáo án đã lưu', en: 'Saved plans' },
    { to: '/coach/first-assessment', label: 'Đánh giá lần đầu', en: 'First assessment' },
  ] },
  { to: '/staff/reception', label: 'Quầy lễ tân & Check-in', icon: 'card', roles: ['STAFF'], tabs: [
    { to: '/staff/reception', label: 'Quầy & POS', en: 'Front desk & POS' },
    { to: '/staff/check-in', label: 'Check-in', en: 'Check-in' },
    { to: '/staff/check-out', label: 'Check-out', en: 'Check-out' },
    { to: '/staff/reception-history', label: 'Lịch sử', en: 'History' },
  ] },
  { to: '/staff/kyc', label: 'Duyệt hồ sơ & Bảo lưu', icon: 'shield', roles: ['STAFF'], tabs: [
    { to: '/staff/kyc', label: 'Hồ sơ định danh', en: 'Identity review' },
    { to: '/staff/holds', label: 'Bảo lưu gói tập', en: 'Membership holds' },
  ] },
  { to: '/staff/courts', label: 'Đặt sân & Đơn hàng', icon: 'court', roles: ['STAFF'], tabs: [
    { to: '/staff/courts', label: 'Lượt đặt sân', en: 'Court bookings' },
    { to: '/staff/orders', label: 'Đơn hàng sản phẩm', en: 'Product orders' },
  ] },
  { to: '/staff/support', label: 'Hộp thư hỗ trợ', icon: 'inbox', roles: ['STAFF'] },
  { to: '/staff/requests', label: 'Đơn từ nội bộ', icon: 'file', roles: ['STAFF', 'COACH'] },
  { to: '/admin/users', label: 'Tài khoản & Phân quyền', icon: 'users', roles: ['ADMIN'] },
  { to: '/manager/reports', label: 'Báo cáo & Nhật ký', icon: 'chart', roles: ['MANAGER'], tabs: [
    { to: '/manager/reports', label: 'Doanh thu', en: 'Revenue' },
    { to: '/manager/audit-logs', label: 'Nhật ký & Lấp đầy', en: 'Audit & occupancy' },
  ] },
  { to: '/manager/catalogs', label: 'Danh mục vận hành', icon: 'catalog', roles: ['MANAGER'] },
  { to: '/manager/products', label: 'Sản phẩm & Đơn hàng', icon: 'bag', roles: ['MANAGER'] },
  { to: '/manager/equipment', label: 'Quản lý máy móc thiết bị', icon: 'dumbbell', roles: ['MANAGER'] },
  { to: '/manager/coach-assignments', label: 'Huấn luyện viên', icon: 'users', roles: ['MANAGER'], tabs: [
    { to: '/manager/coach-assignments', label: 'Phân công học viên', en: 'Assignments' },
    { to: '/manager/coach-reviews', label: 'Xếp hạng & đánh giá', en: 'Ratings & reviews' },
  ] },
  { to: '/staff/classes', label: 'Quản lý Lớp học & Xếp lịch', icon: 'calendar', roles: ['STAFF', 'MANAGER'] },
  { to: '/staff/pt-attendance', label: 'Điểm danh buổi PT', icon: 'check', roles: ['STAFF'] },
  { to: '/staff/kyc', label: 'Duyệt hồ sơ & Bảo lưu', icon: 'shield', roles: ['MANAGER'], tabs: [
    { to: '/staff/kyc', label: 'Hồ sơ định danh', en: 'Identity review' },
    { to: '/staff/holds', label: 'Bảo lưu gói tập', en: 'Membership holds' },
  ] },
  { to: '/manager/support', label: 'Khiếu nại & Đơn từ', icon: 'inbox', roles: ['MANAGER'], tabs: [
    { to: '/manager/support', label: 'Khiếu nại chuyển lên', en: 'Escalated tickets' },
    { to: '/manager/requests', label: 'Đơn nội bộ chờ duyệt', en: 'Internal requests' },
  ] },
  { to: '/manager/staff-accounts', label: 'Tài khoản nhân sự', icon: 'badge', roles: ['MANAGER'] },
  { to: '/member/profile', label: 'Hồ sơ & Sức khỏe', icon: 'profile', roles: ['MEMBER', 'STAFF', 'COACH', 'MANAGER', 'ADMIN'] },
];

/** Mọi route thuộc một mục sidebar: chính nó và các tab con. */
export function portalNavRoutes(item: Pick<PortalNavItem, 'to' | 'tabs'>): string[] {
  return item.tabs ? item.tabs.map(tab => tab.to) : [item.to];
}

/** Mục sidebar đang chọn khi đường dẫn nằm ở một tab con hoặc route con (vd. /member/orders/:id). */
export function isPortalNavActive(item: Pick<PortalNavItem, 'to' | 'tabs'>, pathname: string): boolean {
  return portalNavRoutes(item).some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export function getTabLabel(tab: PortalNavTab, lang: Language = 'vi'): string {
  return lang === 'en' ? tab.en : tab.label;
}

export const PORTAL_NAV_EN_LABELS: Record<string, string> = {
  '/member/dashboard': 'Dashboard',
  '/member/explore': 'Explore 3D',
  '/member/packages': 'Memberships & Hold',
  '/member/classes': 'Schedule & Booking',
  '/member/courts': 'Court Booking',
  '/member/card': 'Card & Check-in',
  '/member/invoices': 'Transactions & Invoices',
  '/member/orders': 'Shop & Orders',
  '/member/progress': 'Progress & Plans',
  '/member/notifications': 'Notifications',
  '/member/support': 'Support & Tickets',
  '/coach/classes': 'Coach Schedule & Members',
  '/staff/attendance': 'Attendance',
  '/coach/training-plans': 'Plans & Assessment',
  '/staff/reception': 'Front Desk & Check-in',
  '/staff/courts': 'Courts & Orders',
  '/staff/support': 'Support Inbox',
  '/staff/requests': 'Internal Requests',
  '/admin/users': 'Accounts & Permissions',
  '/manager/reports': 'Reports & Logs',
  '/manager/catalogs': 'Operations Catalogs',
  '/manager/products': 'Products & Orders',
  '/manager/equipment': 'Equipment Management',
  '/manager/coach-assignments': 'Coaches',
  '/staff/classes': 'Classes & Scheduling',
  '/staff/kyc': 'Reviews & Holds',
  '/staff/pt-attendance': '1:1 Attendance',
  '/manager/support': 'Escalations & Requests',
  '/manager/staff-accounts': 'Staff Accounts',
  '/member/profile': 'Profile & Health',
};

export function getNavLabel(to: string, fallbackVi: string, lang: Language = 'vi'): string {
  if (lang === 'en') {
    return PORTAL_NAV_EN_LABELS[to] ?? fallbackVi;
  }
  return fallbackVi;
}

/** Short labels for the three frequent tasks; permissions still come from PORTAL_NAV. */
export const MOBILE_PRIMARY_NAV: Record<UserSession['role'], { to: string; label: string }[]> = {
  ADMIN: [
    { to: '/admin/users', label: 'Tài khoản' },
    { to: '/member/profile', label: 'Hồ sơ' },
  ],
  MEMBER: [
    { to: '/member/dashboard', label: 'Tổng quan' },
    { to: '/member/classes', label: 'Lịch học' },
    { to: '/member/check-in', label: 'Quét QR' },
  ],
  STAFF: [
    { to: '/staff/reception', label: 'Lễ tân' },
    { to: '/staff/classes', label: 'Lớp học' },
    { to: '/staff/check-in', label: 'Check-in' },
  ],
  COACH: [
    { to: '/coach/classes', label: 'Lịch dạy' },
    { to: '/staff/attendance', label: 'Điểm danh' },
    { to: '/coach/training-plans', label: 'Giáo án' },
  ],
  MANAGER: [
    { to: '/manager/reports', label: 'Báo cáo' },
    { to: '/manager/catalogs', label: 'Danh mục' },
    { to: '/staff/classes', label: 'Lớp học' },
  ],
};

export const MOBILE_PRIMARY_NAV_EN_LABELS: Record<string, string> = {
  '/admin/users': 'Accounts',
  '/member/profile': 'Profile',
  '/member/dashboard': 'Overview',
  '/member/classes': 'Classes',
  '/member/check-in': 'QR Scan',
  '/staff/reception': 'Desk',
  '/staff/classes': 'Classes',
  '/staff/check-in': 'Check-in',
  '/coach/classes': 'Schedule',
  '/staff/attendance': 'Attendance',
  '/coach/training-plans': 'Plans',
  '/manager/reports': 'Reports',
  '/manager/catalogs': 'Catalogs',
};

export function getMobileNavLabel(to: string, fallbackVi: string, lang: Language = 'vi'): string {
  if (lang === 'en') {
    return MOBILE_PRIMARY_NAV_EN_LABELS[to] ?? fallbackVi;
  }
  return fallbackVi;
}
