import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Navigate, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { clearAuthSession, getCurrentUser, type UserSession } from '../api/client';
import { PortalIcon, type PortalIconName } from './PortalIcon';
import './portal.css';
import './portal-reference.css';
import './portal-motion.css';
import './portal-dark.css';

type PortalTheme = 'light' | 'dark';
const THEME_KEY = 'scms_portal_theme';

function readPortalTheme(): PortalTheme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* The switch also works when storage is unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function ThemeToggle({ theme, onToggle }: { theme: PortalTheme; onToggle: () => void }) {
  const label = theme === 'dark' ? 'Bật chế độ sáng' : 'Bật chế độ tối';
  return <button type="button" className="icon-button portal-theme-toggle" aria-label={label} aria-pressed={theme === 'dark'} title={label} onClick={onToggle}><PortalIcon name={theme === 'dark' ? 'sun' : 'moon'} /></button>;
}

const ROLE_LABELS: Record<UserSession['role'], string> = {
  MEMBER: 'Hội viên', STAFF: 'Lễ tân', COACH: 'Huấn luyện viên', MANAGER: 'Quản lý trung tâm',
};

const NAV_ITEMS: { to: string; label: string; shortLabel: string; icon: PortalIconName; roles: UserSession['role'][] }[] = [
  { to: '/member/dashboard', label: 'Tổng quan', shortLabel: 'Tổng quan', icon: 'overview', roles: ['MEMBER'] },
  { to: '/manager/dashboard', label: 'Tổng quan', shortLabel: 'Tổng quan', icon: 'overview', roles: ['MANAGER'] },
  { to: '/member/classes', label: 'Lịch học & Đặt chỗ', shortLabel: 'Lịch học', icon: 'calendar', roles: ['MEMBER'] },
  { to: '/member/card', label: 'Thẻ hội viên & Hóa đơn', shortLabel: 'Thẻ hội viên', icon: 'card', roles: ['MEMBER'] },
  { to: '/staff/attendance', label: 'Điểm danh học viên', shortLabel: 'Điểm danh', icon: 'check', roles: ['COACH'] },
  { to: '/staff/classes', label: 'Quản lý Lớp học & Xếp lịch', shortLabel: 'Lớp học', icon: 'calendar', roles: ['COACH', 'STAFF', 'MANAGER'] },
  { to: '/staff/reception', label: 'Quầy Lễ tân & POS', shortLabel: 'Lễ tân', icon: 'wallet', roles: ['STAFF', 'MANAGER'] },
  { to: '/staff/check-in', label: 'Cổng quét QR Check-in', shortLabel: 'Check-in', icon: 'scan', roles: ['STAFF', 'MANAGER'] },
  { to: '/manager/users', label: 'Tài khoản & Phân quyền', shortLabel: 'Tài khoản', icon: 'users', roles: ['MANAGER'] },
  { to: '/manager/catalogs', label: 'Danh mục vận hành', shortLabel: 'Danh mục', icon: 'layers', roles: ['MANAGER'] },
  { to: '/manager/reports', label: 'Báo cáo & Doanh thu', shortLabel: 'Báo cáo', icon: 'chart', roles: ['MANAGER'] },
  { to: '/member/profile', label: 'Hồ sơ & Sức khỏe', shortLabel: 'Hồ sơ', icon: 'profile', roles: ['MEMBER', 'STAFF', 'COACH', 'MANAGER'] },
];

function moveNavIndicator(nav: HTMLElement | null, link: HTMLElement | null) {
  if (!nav || !link) return;
  const target = link.getBoundingClientRect();
  const bounds = nav.getBoundingClientRect();
  nav.style.setProperty('--nav-x', `${target.left - bounds.left}px`);
  nav.style.setProperty('--nav-y', `${target.top - bounds.top}px`);
  nav.style.setProperty('--nav-width', `${target.width}px`);
  nav.style.setProperty('--nav-height', `${target.height}px`);
  nav.style.setProperty('--nav-opacity', target.width ? '1' : '0');
}

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentUser = getCurrentUser();
  const [collapsed, setCollapsed] = useState(false);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [theme, setTheme] = useState<PortalTheme>(readPortalTheme);
  const toggleTheme = () => setTheme((value) => value === 'dark' ? 'light' : 'dark');
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-portal-theme');
    root.setAttribute('data-portal-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* Keep the in-memory choice. */ }
    return () => {
      if (previous === null) root.removeAttribute('data-portal-theme');
      else root.setAttribute('data-portal-theme', previous);
    };
  }, [theme]);
  const menuOpen = openPath === pathname;
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const sync = () => moveNavIndicator(nav, nav.querySelector('a[aria-current="page"]'));
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname, collapsed, menuOpen, currentUser?.role]);
  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const toggle = menuToggleRef.current;
    document.body.style.overflow = 'hidden';
    closeMenuRef.current?.focus();
    const desktop = window.matchMedia('(min-width: 901px) and (min-height: 561px)');
    const closeOnDesktop = () => { if (desktop.matches) setOpenPath(null); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener('change', closeOnDesktop);
      toggle?.focus();
    };
  }, [menuOpen]);
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!menuOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpenPath(null);
    }
    if (event.key === 'Tab') {
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')].filter((item) => item.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }
  };
  if (!currentUser) return <Navigate to="/login" replace />;
  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role));
  const pageTitle = navItems.find((item) => pathname.startsWith(item.to))?.label ?? 'Portal';
  const logout = () => {
    if (!window.confirm('Bạn có chắc muốn đăng xuất?')) return;
    clearAuthSession();
    navigate('/login', { replace: true });
  };

  return (
    <div data-theme={theme} className={`app-shell reference-portal${collapsed ? ' sidebar-collapsed' : ''}`}>
      <a href="#portal-main" className="skip-link">Bỏ qua tới nội dung chính</a>
      <header className="portal-mobile-header" inert={menuOpen}>
        <NavLink to="/portal" className="mobile-brand">SÖL <span>WELLNESS</span></NavLink>
        <div className="portal-mobile-actions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button ref={menuToggleRef} type="button" className="icon-button" aria-label="Mở điều hướng" aria-expanded={menuOpen} aria-controls="portal-sidebar" onClick={() => setOpenPath(menuOpen ? null : pathname)}><PortalIcon name={menuOpen ? 'close' : 'menu'} /></button>
        </div>
      </header>
      {menuOpen && <button type="button" tabIndex={-1} className="sidebar-scrim" aria-label="Đóng điều hướng" onClick={() => setOpenPath(null)} />}
      <aside id="portal-sidebar" role={menuOpen ? 'dialog' : undefined} aria-modal={menuOpen || undefined} aria-label="Điều hướng portal" onKeyDown={handleMenuKeyDown} className={`app-sidebar${menuOpen ? ' is-open' : ''}`}>
        <div className="sidebar-brand-row">
          <NavLink to="/" className="app-brand" aria-label="SÖL Wellness — Trang chủ">
            <svg className="portal-brand-symbol" width="30" height="34" viewBox="0 0 30 34" fill="none" aria-hidden="true"><path d="M15 2 27 8v10c0 7-12 14-12 14S3 25 3 18V8L15 2Z" stroke="currentColor" strokeWidth="2" /><path d="m20 10-5-3-5 3v6l10 3v6l-5 3-5-3 M15 7v21" stroke="currentColor" strokeWidth="1.7" /></svg>
            <span className="sidebar-brand-text">SÖL <span>WELLNESS</span></span>
          </NavLink>
          <button type="button" className="icon-button sidebar-collapse" aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}><PortalIcon name="chevron" /></button>
          <button ref={closeMenuRef} type="button" className="icon-button sidebar-mobile-close" aria-label="Đóng menu" onClick={() => setOpenPath(null)}><PortalIcon name="close" /></button>
        </div>
        <div className="sidebar-navigation">
          <p className="sidebar-section-label">KHÔNG GIAN CỦA BẠN</p>
          <nav ref={navRef} className="app-nav" aria-label="Điều hướng portal" onPointerLeave={() => moveNavIndicator(navRef.current, navRef.current?.querySelector('a[aria-current="page"]') ?? null)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) moveNavIndicator(navRef.current, navRef.current?.querySelector('a[aria-current="page"]') ?? null); }}>
            <span className="portal-nav-indicator" aria-hidden="true" />
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} title={item.label} aria-label={item.label}
                onPointerEnter={(event) => moveNavIndicator(navRef.current, event.currentTarget)}
                onFocus={(event) => moveNavIndicator(navRef.current, event.currentTarget)}
                onClick={() => setOpenPath(null)} className={({ isActive }) => isActive ? 'active' : ''}>
                <PortalIcon name={item.icon} /><span className="sidebar-link-label">{item.label}</span><span className="sidebar-short-label" aria-hidden="true">{item.shortLabel}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <NavLink to={currentUser.role === 'MEMBER' ? '/member/card' : currentUser.role === 'MANAGER' ? '/manager/reports' : '/member/profile'} className="sidebar-plan-link"><span>{currentUser.role === 'MEMBER' ? 'Gói tập của tôi' : currentUser.role === 'MANAGER' ? 'Báo cáo trung tâm' : 'Hồ sơ của tôi'}</span><PortalIcon name="chevron" /></NavLink>
          <NavLink to="/" className="sidebar-home-link" aria-label="Quay lại trang chủ"><PortalIcon name="home" /><span>Quay lại trang chủ</span></NavLink>
          <div className="sidebar-account">
            <NavLink to="/member/profile" className="sidebar-account-profile" aria-label="Xem hồ sơ cá nhân">
              <span className="app-user__avatar" aria-hidden="true">{currentUser.name.trim().charAt(0).toUpperCase() || 'S'}</span>
              <span className="sidebar-account-text"><span className="app-user__name">{currentUser.name}</span><span className="app-user__role">{ROLE_LABELS[currentUser.role]}</span></span>
            </NavLink>
            <button type="button" className="icon-button" onClick={logout} aria-label="Đăng xuất" title="Đăng xuất"><PortalIcon name="logout" /></button>
          </div>
        </div>
      </aside>
      <div className="app-main" inert={menuOpen}>
        <div className="portal-desktop-actions"><ThemeToggle theme={theme} onToggle={toggleTheme} /></div>
        {!pathname.endsWith('/dashboard') && <div className="portal-breadcrumb"><NavLink to="/portal">Tổng quan</NavLink><PortalIcon name="chevron" /><span>{pageTitle}</span></div>}
        <main id="portal-main" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  );
}
