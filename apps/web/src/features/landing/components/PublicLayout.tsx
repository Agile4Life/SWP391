import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCurrentUser, homePath } from '../../../shared/api/client';
import { LiquidGlassChatbot } from '../../../shared/liquid-glass/LiquidGlassChatbot';
import { useComponentReveal } from '../hooks/useComponentReveal';
import '../fitness-public.css';

const links = [
  { to: '/#about', hash: 'about', label: 'Về SÖL' },
  { to: '/swimming', label: 'Hồ bơi' },
  { to: '/tennis', label: 'Tennis' },
  { to: '/#trainers', hash: 'trainers', label: 'Huấn luyện viên' },
  { to: '/#packages', hash: 'packages', label: 'Gói tập' },
  { to: '/#stories', hash: 'stories', label: 'Câu chuyện' },
];

export function RoundArrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span className="fit-round-arrow" aria-hidden="true">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {diagonal ? <path d="M4.5 11.5L11.5 4.5M6 4.5h5.5V10" /> : <path d="M3.5 8h9M8.5 4l4 4-4 4" />}
    </svg>
  </span>;
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, hash } = useLocation();
  const user = getCurrentUser();
  const root = useRef<HTMLDivElement>(null);
  useComponentReveal(root, pathname);

  useEffect(() => {
    document.title = `${pathname === '/login' ? 'Đăng nhập' : pathname === '/register' ? 'Đăng ký hội viên' : 'Build your body. Find your balance.'} · SÖL Fitness`;
    if (hash) {
      const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return <div className="fit-site" ref={root}>
    <div className="fit-scroll-progress" aria-hidden="true" />
    <a className="fit-skip" href="#public-main">Đến nội dung chính</a>
    <div className="fit-canvas">
      <header className="fit-header">
        <Link className="fit-brand" to="/" aria-label="SÖL Fitness · Trang chủ"><span>SÖL</span>Fitness<span className="fit-brand-dot" aria-hidden="true">®</span></Link>
        <nav className={`fit-nav ${menuOpen ? 'is-open' : ''}`} id="public-navigation" aria-label="Điều hướng chính">
          {links.map(({ to, hash: target, label }) => <Link key={label} to={to} data-nav-target={target} className={pathname === to ? 'is-active' : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>)}
        </nav>
        <div className="fit-header-actions">
          <Link to={user ? homePath(user.role) : pathname === '/login' ? '/register' : '/login'} className="fit-pill fit-header-cta">
            {user ? 'Vào portal' : pathname === '/login' ? 'Tham gia ngay' : 'Đăng nhập'}<RoundArrow />
          </Link>
          <button type="button" className="fit-menu" aria-controls="public-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} onClick={() => setMenuOpen(!menuOpen)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /> : <path d="M3.5 5h9M3.5 8h9M3.5 11h9" />}
            </svg>
          </button>
        </div>
      </header>
      {children}
      <footer className="fit-footer" id="contact">
        <div className="fit-footer-main">
          <div><Link to="/" className="fit-brand"><span>SÖL</span>Fitness<span className="fit-brand-dot" aria-hidden="true">®</span></Link><p>Mạnh mẽ hơn mỗi ngày.<br />Cân bằng theo cách của bạn.</p></div>
          <nav aria-label="Điều hướng chân trang">{links.map(({ to, label }) => <Link key={label} to={to}>{label}</Link>)}</nav>
          <address><span>120 Hai Bà Trưng, Quận 1, TP.HCM</span><a href="tel:19006868">1900 6868 ↗</a><a href="mailto:concierge@sol-wellness.vn">concierge@sol-wellness.vn</a></address>
        </div>
        <div className="fit-footer-bottom"><span>© 2026 SÖL Fitness</span><span>06:00 — 22:00 mỗi ngày</span><Link to={user ? homePath(user.role) : '/login'}>{user ? 'Không gian hội viên' : 'Đăng nhập hội viên'} ↗</Link></div>
        <div className="fit-footer-watermark" aria-hidden="true">SÖL FITNESS</div>
      </footer>
    </div>
    {pathname === '/' && <LiquidGlassChatbot />}
  </div>;
}

export function AuthLayout({ children, mode }: { children: ReactNode; mode: 'login' | 'register' }) {
  return <PublicLayout>
    <main id="public-main" className="fit-auth">
      <div className="fit-auth-story" data-reveal="soft">
        <h1>{mode === 'login' ? <>Trở lại<br /><em>lịch tập của bạn.</em></> : <>Bắt đầu<br /><em>cùng SÖL.</em></>}</h1>
        <p>{mode === 'login' ? 'Đăng nhập để xem gói tập, đặt lịch lớp và theo dõi lịch tập của bạn.' : 'Tạo tài khoản và xác thực email để bắt đầu chọn gói tập.'}</p>
        <div className="fit-auth-photo"><img src="/images/fitness/strength-session.jpg" alt="Vận động viên tập luyện sức mạnh với tạ tại phòng gym" /><span>SHOW UP FOR YOURSELF.<RoundArrow diagonal /></span></div>
      </div>
      <div className="fit-auth-form" data-reveal="lift">{children}</div>
    </main>
  </PublicLayout>;
}
