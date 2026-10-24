import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAuthSession, getCurrentUser } from '../../shared/api/client';
import { Modal } from '../../shared/ui/Modal';
import { ThemeToggle } from '../../shared/ui/ThemeToggle';
import { PortalIcon } from './PortalIcon';
import { PORTAL_NAV, ROLE_LABELS } from './portalNavigation';
import { getUnreadCount } from '../member/notificationsApi';

function searchable(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function PortalShell() {
  const user = getCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'search' | 'menu' | 'logout' | null>(null);
  const [query, setQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [notificationError, setNotificationError] = useState(false);
  const previousPath = useRef(location.pathname);
  const mainRef = useRef<HTMLElement>(null);
  const isMember = user?.role === 'MEMBER';
  const profileLabel = isMember ? 'Hồ sơ & Sức khỏe' : 'Hồ sơ cá nhân';
  const navItems = PORTAL_NAV.filter((item) => user && item.roles.includes(user.role)).map((item) => item.to === '/member/profile' ? { ...item, label: profileLabel } : item);
  const pageTitle = navItems.find((item) => item.to === location.pathname)?.label ?? 'Không gian của bạn';
  const results = navItems.filter((item) => searchable(item.label).includes(searchable(query.trim())));

  useEffect(() => {
    if (!isMember) return;
    let active = true;
    const refresh = () => {
      void getUnreadCount().then((count) => {
        if (active) { setUnreadCount(count); setNotificationError(false); }
      }).catch(() => {
        if (active) { setUnreadCount(null); setNotificationError(true); }
      });
    };
    refresh();
    window.addEventListener('member-notifications-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('member-notifications-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [isMember]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${pageTitle} · SÖL Portal`;
    return () => { document.title = previousTitle; };
  }, [pageTitle]);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      mainRef.current?.focus();
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

  if (!user) return <Navigate to="/login" replace />;

  const initials = user.name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase() || 'S';
  const openNavigation = (mode: 'search' | 'menu') => {
    setQuery('');
    setDialog(mode);
  };

  return <div className="portal-backdrop">
    <div className="app-shell portal-v2">
      <a href="#portal-main" className="skip-link">Bỏ qua tới nội dung chính</a>
      <aside className="app-sidebar" aria-label="Thanh công cụ SÖL">
        <Link to="/" className="portal-logo" aria-label="SÖL · Về trang chủ"><span>S</span><i /></Link>
        <nav className="portal-rail-nav" aria-label="Điều hướng portal">
          {navItems.filter((item) => item.to !== '/member/profile').map((item) => <NavLink
            key={item.to} to={item.to} className="portal-rail-link" aria-label={item.label}>
            <PortalIcon name={item.icon} /><span className="portal-rail-tooltip">{item.label}</span>
          </NavLink>)}
        </nav>
        <div className="portal-rail-footer">
          <NavLink to="/member/profile" className="portal-rail-link portal-rail-profile" aria-label={profileLabel}>
            <span className="portal-avatar">{initials}</span><span className="portal-rail-tooltip">{profileLabel}</span>
          </NavLink>
          <Link to="/" className="portal-rail-link" aria-label="Về trang chủ"><PortalIcon name="home" /><span className="portal-rail-tooltip">Về trang chủ</span></Link>
          <button type="button" className="portal-rail-link" aria-label="Đăng xuất" onClick={() => setDialog('logout')}>
            <PortalIcon name="logout" /><span className="portal-rail-tooltip">Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="portal-workspace">
            <button type="button" className="portal-icon-button portal-mobile-menu" aria-label="Mở điều hướng" onClick={() => openNavigation('menu')}><PortalIcon name="menu" /></button>
            <Link to="/portal" className="portal-wordmark">SÖL<span>Wellness Sanctuary</span></Link>
            <span className="portal-workspace-divider" />
            <span className="portal-workspace-role"><PortalIcon name="building" size={15} />{ROLE_LABELS[user.role]}</span>
          </div>
          <div className="portal-topbar-actions">
            <ThemeToggle />
            {isMember && <Link to="/member/notifications" className="member-notification-bell" aria-label={notificationError ? 'Thông báo · Không thể cập nhật số chưa đọc' : `Thông báo · ${unreadCount ?? 0} chưa đọc`} title={notificationError ? 'Không thể cập nhật số thông báo' : 'Thông báo'}>
              <PortalIcon name="bell" size={19} />
              {unreadCount !== null && unreadCount > 0 && <span className="member-notification-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>}
            <button type="button" className="portal-search-trigger" aria-label="Tìm màn hình" onClick={() => openNavigation('search')}>
              <PortalIcon name="search" size={17} /><span>Tìm màn hình…</span>
            </button>
            <Link to="/member/profile" className="portal-account" aria-label={`Hồ sơ của ${user.name}`}>
              <span className="portal-avatar">{initials}</span>
              <span className="portal-account-name">{user.name}<small>{ROLE_LABELS[user.role]}</small></span>
            </Link>
            <button type="button" className="portal-icon-button portal-mobile-logout" aria-label="Đăng xuất" onClick={() => setDialog('logout')}><PortalIcon name="logout" size={18} /></button>
          </div>
        </header>
        <main ref={mainRef} id="portal-main" tabIndex={-1}>
          <div key={location.pathname} className="route-fade"><Outlet /></div>
        </main>
        <footer className="portal-workspace-footer"><span>SÖL · Không gian của bạn</span><span>Chuyển động mỗi ngày. Cân bằng mỗi khoảnh khắc.</span></footer>
      </div>

      {dialog === 'logout' && <Modal title="Đăng xuất khỏi SÖL?" onClose={() => setDialog(null)}>
        <p className="portal-subtitle">Bạn có thể đăng nhập lại bất cứ lúc nào để tiếp tục hành trình.</p>
        <div className="form-actions" style={{ marginTop: 24 }}>
          <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>Ở lại</button>
          <button type="button" className="btn-primary" onClick={() => { clearAuthSession(); navigate('/login', { replace: true }); }}>Đăng xuất</button>
        </div>
      </Modal>}
      {(dialog === 'menu' || dialog === 'search') && <Modal title={dialog === 'menu' ? 'Không gian của bạn' : 'Tìm màn hình'} onClose={() => setDialog(null)}>
        <label className="portal-label" htmlFor="portal-screen-search">Tên màn hình</label>
        <input id="portal-screen-search" className="portal-input" type="search" placeholder="Ví dụ: lịch học, gói tập…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <nav className="portal-screen-results" aria-label="Các màn hình của bạn">
          {results.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setDialog(null)}>
            <PortalIcon name={item.icon} /><span>{item.label}</span><PortalIcon name="arrow" size={16} />
          </NavLink>)}
          {results.length === 0 && <p className="portal-search-empty" role="status">Không tìm thấy màn hình. Hãy thử từ khóa khác.</p>}
        </nav>
        {dialog === 'menu' && <Link className="portal-menu-home" to="/" onClick={() => setDialog(null)}><PortalIcon name="home" size={16} />Về trang chủ SÖL</Link>}
      </Modal>}
    </div>
  </div>;
}
