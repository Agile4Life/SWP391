import type { UserSession } from '../../shared/api/client';
import type { PortalIconName } from './PortalIcon';

export const ROLE_LABELS: Record<UserSession['role'], string> = {
  MEMBER: 'Hội viên', STAFF: 'Lễ tân', COACH: 'Huấn luyện viên', MANAGER: 'Quản lý trung tâm',
};

export const PORTAL_NAV: { to: string; label: string; icon: PortalIconName; roles: UserSession['role'][] }[] = [
  { to: '/member/dashboard', label: 'Bảng điều khiển', icon: 'board', roles: ['MEMBER'] },
  { to: '/member/packages', label: 'Gói tập', icon: 'package', roles: ['MEMBER'] },
  { to: '/member/classes', label: 'Lịch học & Đặt chỗ', icon: 'calendar', roles: ['MEMBER'] },
  { to: '/member/card', label: 'Thẻ hội viên & Hóa đơn', icon: 'card', roles: ['MEMBER'] },
  { to: '/member/support', label: 'Hỗ trợ', icon: 'support', roles: ['MEMBER'] },
  { to: '/staff/attendance', label: 'Điểm danh học viên', icon: 'check', roles: ['COACH'] },
  { to: '/staff/classes', label: 'Quản lý Lớp học & Xếp lịch', icon: 'calendar', roles: ['COACH', 'STAFF', 'MANAGER'] },
  { to: '/staff/reception', label: 'Quầy Lễ tân & POS', icon: 'card', roles: ['STAFF', 'MANAGER'] },
  { to: '/staff/check-in', label: 'Cổng quét QR Check-in', icon: 'scan', roles: ['STAFF', 'MANAGER'] },
  { to: '/manager/users', label: 'Tài khoản & Phân quyền', icon: 'users', roles: ['MANAGER'] },
  { to: '/manager/catalogs', label: 'Danh mục vận hành', icon: 'catalog', roles: ['MANAGER'] },
  { to: '/manager/cancellations', label: 'Yêu cầu hủy gói', icon: 'package', roles: ['MANAGER'] },
  { to: '/manager/reports', label: 'Báo cáo & Doanh thu', icon: 'chart', roles: ['MANAGER'] },
  { to: '/member/profile', label: 'Hồ sơ & Sức khỏe', icon: 'profile', roles: ['MEMBER', 'STAFF', 'COACH', 'MANAGER'] },
];
