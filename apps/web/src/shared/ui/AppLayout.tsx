import { useState, useRef, useLayoutEffect, type CSSProperties } from 'react';
import { Navigate, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { clearAuthSession, getCurrentUser, UserSession } from '../api/client';
import { CustomCursor } from '../../features/landing/components/CustomCursor';
import './portal.css';

const ROLE_LABELS: Record<UserSession['role'], string> = {
  MEMBER: 'Hội viên',
  STAFF: 'Lễ tân',
  COACH: 'Huấn luyện viên',
  MANAGER: 'Quản lý trung tâm',
};

// Danh sách màn hình theo phân quyền vai trò
const NAV_ITEMS: { to: string; label: string; roles: UserSession['role'][] }[] = [
  // Hội viên
  { to: '/member/dashboard', label: 'Bảng điều khiển', roles: ['MEMBER'] },
  { to: '/member/classes', label: 'Lịch học & Đặt chỗ', roles: ['MEMBER'] },
  { to: '/member/card', label: 'Thẻ hội viên & Hóa đơn', roles: ['MEMBER'] },

  // Huấn luyện viên
  { to: '/staff/attendance', label: 'Điểm danh học viên', roles: ['COACH'] },

  // Nhân viên & Quản lý & HLV (Quản lý lớp học, Lễ tân, Check-in)
  { to: '/staff/classes', label: 'Quản lý Lớp học & Xếp lịch', roles: ['COACH', 'STAFF', 'MANAGER'] },
  { to: '/staff/reception', label: 'Quầy Lễ tân & POS', roles: ['STAFF', 'MANAGER'] },
  { to: '/staff/check-in', label: 'Cổng quét QR Check-in', roles: ['STAFF', 'MANAGER'] },

  // Quản lý trung tâm
  { to: '/manager/users', label: 'Tài khoản & Phân quyền', roles: ['MANAGER'] },
  { to: '/manager/catalogs', label: 'Danh mục vận hành', roles: ['MANAGER'] },
  { to: '/manager/reports', label: 'Báo cáo & Doanh thu', roles: ['MANAGER'] },

  // Dùng chung cho tất cả vai trò
  { to: '/member/profile', label: 'Hồ sơ & Sức khỏe', roles: ['MEMBER', 'STAFF', 'COACH', 'MANAGER'] },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();

  const navRef = useRef<HTMLElement>(null);
  const [indicatorPos, setIndicatorPos] = useState({ y: 0, h: 0 });
  const [isReady, setIsReady] = useState(false);

  // Measure and align the sidebar indicator
  useLayoutEffect(() => {
    const updateIndicator = () => {
      if (!navRef.current) return;
      const activeEl = navRef.current.querySelector('a.active') as HTMLElement | null;
      if (activeEl) {
        const navRect = navRef.current.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        setIndicatorPos({ y: activeRect.top - navRect.top, h: activeRect.height });
      }
    };

    updateIndicator();
    const rafId = requestAnimationFrame(() => setIsReady(true));

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && navRef.current) {
      ro = new ResizeObserver(() => updateIndicator());
      ro.observe(navRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
    };
  }, [location.pathname, currentUser?.role]);

  if (!currentUser) return <Navigate to="/login" replace />;

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role));
  const pageTitle = navItems.find((item) => location.pathname.startsWith(item.to))?.label ?? '';

  const logout = () => {
    if (!window.confirm('Bạn có chắc muốn đăng xuất?')) return;
    clearAuthSession();
    navigate('/login', { replace: true, viewTransition: true });
  };

  return (
    <div className="app-shell">
      <CustomCursor />
      <a href="#portal-main" className="skip-link">Bỏ qua tới nội dung chính</a>

      <aside className="app-sidebar">
        <div>
          <NavLink to="/" viewTransition className="app-brand">
            SÖL
            <span className="app-brand__sub">Wellness Sanctuary</span>
          </NavLink>

          <div className="app-role-card">
            <div className="app-role-card__label">VAI TRÒ HIỆN TẠI</div>
            <div className="app-role-card__name">{ROLE_LABELS[currentUser.role]}</div>
          </div>

          <nav ref={navRef} className="app-nav" aria-label="Điều hướng portal">
            <div
              className={`nav-indicator ${isReady ? 'is-ready' : ''}`}
              style={{ '--y': `${indicatorPos.y}px`, '--h': `${indicatorPos.h}px` } as CSSProperties}
            />
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="app-sidebar__footer">
          <NavLink to="/" viewTransition>
            ← Quay lại Trang Chủ
          </NavLink>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <p className="app-topbar__title">
            <span>Portal</span>
            {pageTitle && <span className="app-topbar__crumb">{pageTitle}</span>}
          </p>

          <div className="app-user">
            <span className="app-user__avatar" aria-hidden="true">
              {currentUser.name.trim().charAt(0).toUpperCase() || 'S'}
            </span>
            <div>
              <div className="app-user__name">{currentUser.name}</div>
              <div className="app-user__role">{ROLE_LABELS[currentUser.role]}</div>
            </div>
            <button type="button" className="app-logout" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        </header>

        <main id="portal-main" tabIndex={-1} style={{ flex: 1, outline: 'none' }}>
          <div key={location.pathname} className="route-fade">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
