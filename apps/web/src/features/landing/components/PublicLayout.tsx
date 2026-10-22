import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCurrentUser, homePath } from '../../../shared/api/client';
import { LiquidGlassChatbot } from '../../../shared/liquid-glass/LiquidGlassChatbot';
import { useComponentReveal } from '../hooks/useComponentReveal';
import '../fitness-public.css';

const links = [
  { hash: 'about', label: 'Về SÖL' },
  { hash: 'trainers', label: 'Huấn luyện viên' },
  { hash: 'packages', label: 'Gói tập' },
  { hash: 'stories', label: 'Câu chuyện' },
];

export function RoundArrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span className="fit-round-arrow" aria-hidden="true">{diagonal ? '↗' : '→'}</span>;
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
    <a className="fit-skip" href="#public-main">Đến nội dung chính</a>
    <div className="fit-canvas">
      <header className="fit-header">
        <Link className="fit-brand" to="/" aria-label="SÖL Fitness · Trang chủ"><span>SÖL</span>Fitness<span className="fit-brand-dot">®</span></Link>
        <nav className={`fit-nav ${menuOpen ? 'is-open' : ''}`} id="public-navigation" aria-label="Điều hướng chính">
          {links.map(({ hash: target, label }) => <Link key={target} to={`/#${target}`} onClick={() => setMenuOpen(false)}>{label}</Link>)}
        </nav>
        <div className="fit-header-actions">
          <Link to={user ? homePath(user.role) : pathname === '/login' ? '/register' : '/login'} className="fit-pill fit-header-cta">
            {user ? 'Vào portal' : pathname === '/login' ? 'Tham gia ngay' : 'Đăng nhập'}<RoundArrow />
          </Link>
          <button type="button" className="fit-menu" aria-controls="public-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '✕' : '☰'}</button>
        </div>
      </header>
      {children}
      <footer className="fit-footer" id="contact">
        <div className="fit-footer-main">
          <div><Link to="/" className="fit-brand"><span>SÖL</span>Fitness<span className="fit-brand-dot">®</span></Link><p>Mạnh mẽ hơn mỗi ngày.<br />Cân bằng theo cách của bạn.</p></div>
          <nav aria-label="Điều hướng chân trang">{links.map(({ hash: target, label }) => <Link key={target} to={`/#${target}`}>{label}</Link>)}</nav>
          <address><span>120 Hai Bà Trưng, Quận 1, TP.HCM</span><a href="tel:19006868">1900 6868 ↗</a><a href="mailto:concierge@sol-wellness.vn">concierge@sol-wellness.vn</a></address>
        </div>
        <div className="fit-footer-bottom"><span>© 2026 SÖL Wellness Sanctuary</span><span>06:00 — 22:00 mỗi ngày</span><Link to={user ? homePath(user.role) : '/login'}>{user ? 'Không gian hội viên' : 'Đăng nhập hội viên'} ↗</Link></div>
      </footer>
    </div>
    {pathname === '/' && <LiquidGlassChatbot />}
  </div>;
}

export function AuthLayout({ children, mode }: { children: ReactNode; mode: 'login' | 'register' }) {
  return <PublicLayout>
    <main id="public-main" className="fit-auth">
      <div className="fit-auth-story" data-reveal="soft">
        <span className="fit-kicker">YOUR NEXT CHAPTER STARTS HERE</span>
        <h1>{mode === 'login' ? <>GOOD TO HAVE<br />YOU <em>BACK.</em></> : <>STRONGER.<br />TOGETHER.<br /><em>START HERE.</em></>}</h1>
        <p>{mode === 'login' ? 'Trở lại nhịp tập luyện của bạn. Lịch học, gói tập và hành trình tiến bộ — tất cả trong một không gian.' : 'Một tài khoản. Nhiều cách để chuyển động. Bắt đầu hành trình tập luyện và tìm phiên bản khỏe hơn của chính mình.'}</p>
        <div className="fit-auth-photo"><img src="/images/fitness/strength-session.jpg" alt="Vận động viên tập luyện sức mạnh với tạ tại phòng gym" /><span>SHOW UP FOR YOURSELF.<RoundArrow diagonal /></span></div>
        <div className="fit-auth-note"><span className="fit-small-star">✳</span> Mỗi buổi tập là một khởi đầu mới.</div>
      </div>
      <div className="fit-auth-form" data-reveal="lift">{children}</div>
    </main>
  </PublicLayout>;
}
