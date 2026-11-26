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

/** Nhãn vai trò theo ngôn ngữ. */
export function getRoleLabel(role: UserSession['role'], lang: Language = 'vi'): string {
  return lang === 'en' ? ROLE_LABELS_EN[role] : ROLE_LABELS[role];
}

/** Một tab con của mục sidebar gộp; mỗi tab vẫn là một route riêng nên URL cũ không đổi. */
export interface PortalNavTab { to: string; label: string; en: string }

/**
 * Một mục điều hướng của portal: đường dẫn, nhãn, biểu tượng, các vai trò được thấy và tùy chọn gộp nhiều màn
 * con.
 */
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
  { to: '/member/packages', label: 'Gói tập & bảo lưu', icon: 'package', roles: ['MEMBER'], tabs: [
    { to: '/member/packages', label: 'Gói tập', en: 'Memberships' },
    { to: '/member/hold', label: 'Bảo lưu', en: 'Hold' },
  ] },
  { to: '/member/classes', label: 'Lịch học & đặt PT', icon: 'calendar', roles: ['MEMBER'] },
  { to: '/member/card', label: 'Thẻ & check-in', icon: 'card', roles: ['MEMBER'], tabs: [
    { to: '/member/card', label: 'Thẻ hội viên', en: 'Member card' },
    { to: '/member/check-in', label: 'Quét QR cổng', en: 'Gate QR' },
  ] },
  { to: '/member/invoices', label: 'Giao dịch & hóa đơn', icon: 'receipt', roles: ['MEMBER'] },
  { to: '/member/progress', label: 'Giáo án', icon: 'dumbbell', roles: ['MEMBER'] },
  { to: '/member/notifications', label: 'Thông báo', icon: 'bell', roles: ['MEMBER', 'COACH', 'MANAGER', 'STAFF', 'ADMIN'] },
  { to: '/coach/pt-attendance', label: 'Điểm danh', icon: 'check', roles: ['COACH'], tabs: [
    { to: '/coach/pt-attendance', label: 'Điểm danh PT 1:1', en: '1:1 PT attendance' },
    { to: '/coach/attendance', label: 'Điểm danh lớp nhóm', en: 'Group class attendance' },
  ] },
  { to: '/coach/classes', label: 'Lịch dạy & học viên', icon: 'calendar', roles: ['COACH'] },
  { to: '/coach/training-plans', label: 'Giáo án huấn luyện', icon: 'dumbbell', roles: ['COACH'], tabs: [
    { to: '/coach/training-plans', label: 'Soạn giáo án', en: 'Plan builder' },
    { to: '/coach/saved-plans', label: 'Giáo án đã lưu', en: 'Saved plans' },
  ] },
  { to: '/staff/reception', label: 'Quầy lễ tân & check-in', icon: 'card', roles: ['STAFF'], tabs: [
    { to: '/staff/reception', label: 'Quầy lễ tân', en: 'Front desk' },
    { to: '/staff/check-in', label: 'Check-in', en: 'Check-in' },
    { to: '/staff/check-out', label: 'Check-out', en: 'Check-out' },
    { to: '/staff/reception-history', label: 'Lịch sử giao dịch', en: 'Transaction history' },
  ] },
  { to: '/staff/kyc', label: 'Duyệt hồ sơ & bảo lưu', icon: 'shield', roles: ['STAFF'], tabs: [
    { to: '/staff/kyc', label: 'Hồ sơ định danh', en: 'Identity review' },
    { to: '/staff/holds', label: 'Bảo lưu gói tập', en: 'Membership holds' },
  ] },
  { to: '/staff/requests', label: 'Đơn từ nội bộ', icon: 'file', roles: ['STAFF', 'COACH'] },
  { to: '/admin/users', label: 'Tài khoản & phân quyền', icon: 'users', roles: ['ADMIN'] },
  { to: '/admin/audit-logs', label: 'Nhật ký & lấp đầy', icon: 'chart', roles: ['ADMIN'] },
  { to: '/admin/payments', label: 'Đối soát thanh toán', icon: 'receipt', roles: ['ADMIN'] },
  { to: '/manager/reports', label: 'Báo cáo & doanh thu', icon: 'chart', roles: ['MANAGER'] },
  { to: '/manager/classes', label: 'Lớp học & xếp lịch', icon: 'calendar', roles: ['MANAGER'] },
  { to: '/manager/catalogs', label: 'Danh mục vận hành', icon: 'catalog', roles: ['MANAGER'] },
  { to: '/manager/coach-assignments', label: 'Phân công HLV', icon: 'users', roles: ['MANAGER'] },
  // Khiếu nại chuyển lên nằm trong khung Tin nhắn (Hỗ trợ & Khiếu nại), sidebar chỉ còn đơn nội bộ.
  { to: '/manager/requests', label: 'Duyệt đơn từ nội bộ', icon: 'inbox', roles: ['MANAGER'] },
  { to: '/manager/staff-accounts', label: 'Tài khoản nhân sự', icon: 'badge', roles: ['MANAGER'] },
  { to: '/member/profile', label: 'Hồ sơ cá nhân', icon: 'profile', roles: ['MEMBER', 'STAFF', 'COACH', 'MANAGER', 'ADMIN'] },
];

/** Mọi route thuộc một mục sidebar: chính nó và các tab con. */
export function portalNavRoutes(item: Pick<PortalNavItem, 'to' | 'tabs'>): string[] {
  return item.tabs ? item.tabs.map(tab => tab.to) : [item.to];
}

/** Mục sidebar đang chọn khi đường dẫn nằm ở một tab con hoặc route con (vd. /member/packages/checkout). */
export function isPortalNavActive(item: Pick<PortalNavItem, 'to' | 'tabs'>, pathname: string): boolean {
  return portalNavRoutes(item).some(route => pathname === route || pathname.startsWith(`${route}/`));
}

/** Nhãn của một tab con theo ngôn ngữ. */
export function getTabLabel(tab: PortalNavTab, lang: Language = 'vi'): string {
  return lang === 'en' ? tab.en : tab.label;
}

export const PORTAL_NAV_EN_LABELS: Record<string, string> = {
  '/member/dashboard': 'Dashboard',
  '/member/packages': 'Memberships & hold',
  '/member/classes': 'Classes & 1:1 PT',
  '/member/card': 'Card & check-in',
  '/member/invoices': 'Transactions & invoices',
  '/member/progress': 'Training plans',
  '/member/notifications': 'Notifications',
  '/coach/pt-attendance': 'Attendance',
  '/coach/classes': 'Teaching schedule & trainees',
  '/coach/training-plans': 'Training plans',
  '/staff/reception': 'Front desk & check-in',
  '/staff/requests': 'Internal requests',
  '/admin/users': 'Accounts & permissions',
  '/admin/audit-logs': 'Audit & occupancy',
  '/admin/payments': 'Payment reconciliation',
  '/manager/reports': 'Reports & revenue',
  '/manager/classes': 'Classes & schedule',
  '/manager/catalogs': 'Operational catalogs',
  '/manager/coach-assignments': 'Coach assignments',
  '/staff/kyc': 'Identity & holds',
  '/manager/requests': 'Review internal requests',
  '/manager/staff-accounts': 'Staff accounts',
  '/member/profile': 'My profile',
};

/** Nhãn mục điều hướng theo ngôn ngữ (tiếng Anh tra bảng, không có thì dùng nhãn tiếng Việt). */
export function getNavLabel(to: string, fallbackVi: string, lang: Language = 'vi'): string {
  if (lang === 'en') {
    return PORTAL_NAV_EN_LABELS[to] ?? fallbackVi;
  }
  return fallbackVi;
}

/** Nhãn ngắn cho ba tác vụ thường dùng; quyền truy cập vẫn lấy từ PORTAL_NAV. */
export const MOBILE_PRIMARY_NAV: Record<UserSession['role'], { to: string; label: string }[]> = {
  ADMIN: [
    { to: '/admin/users', label: 'Tài khoản' },
    { to: '/admin/audit-logs', label: 'Nhật ký' },
    { to: '/admin/payments', label: 'Đối soát' },
  ],
  MEMBER: [
    { to: '/member/dashboard', label: 'Tổng quan' },
    { to: '/member/classes', label: 'Lịch học' },
    { to: '/member/check-in', label: 'Quét QR' },
  ],
  STAFF: [
    { to: '/staff/reception', label: 'Lễ tân' },
    { to: '/staff/check-in', label: 'Check-in' },
    { to: '/staff/requests', label: 'Đơn từ' },
  ],
  COACH: [
    { to: '/coach/pt-attendance', label: 'Điểm danh' },
    { to: '/coach/classes', label: 'Lịch dạy' },
    { to: '/coach/training-plans', label: 'Giáo án' },
  ],
  MANAGER: [
    { to: '/manager/reports', label: 'Báo cáo' },
    { to: '/manager/classes', label: 'Lớp học' },
    { to: '/manager/coach-assignments', label: 'Phân công' },
  ],
};

export const MOBILE_PRIMARY_NAV_EN_LABELS: Record<string, string> = {
  '/admin/users': 'Accounts',
  '/admin/audit-logs': 'Audit',
  '/admin/payments': 'Payments',
  '/member/dashboard': 'Overview',
  '/member/classes': 'Classes',
  '/member/check-in': 'QR scan',
  '/staff/reception': 'Desk',
  '/staff/check-in': 'Check-in',
  '/coach/pt-attendance': 'Attendance',
  '/coach/classes': 'Schedule',
  '/coach/training-plans': 'Plans',
  '/manager/reports': 'Reports',
  '/manager/classes': 'Classes',
  '/manager/coach-assignments': 'Assignments',
  '/staff/requests': 'Requests',
};

/** Nhãn ngắn của mục điều hướng trên di động theo ngôn ngữ. */
export function getMobileNavLabel(to: string, fallbackVi: string, lang: Language = 'vi'): string {
  if (lang === 'en') {
    return MOBILE_PRIMARY_NAV_EN_LABELS[to] ?? fallbackVi;
  }
  return fallbackVi;
}
