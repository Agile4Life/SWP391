import { sourceText, useSourceLanguage } from "../../../shared/i18n/sourceText";
import { LoadingImage } from '../../../shared/ui/LoadingImage';
import { purchaseAuthPath } from '../../../shared/lib/purchaseIntent';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { homePath } from '../../../shared/api/client';
import { sessionIdentityKey, useCurrentUser } from '../../../shared/api/useCurrentUser';
import { LanguageSetting, useI18n } from '../../../shared/i18n';
import { useComponentReveal } from '../hooks/useComponentReveal';
import { ThemeToggle } from '../../../shared/ui/ThemeToggle';
import { ChatWidget } from '../../chat/ChatWidget';
import { SPORT_PAGES, sportIdFromPath } from '../sportPages';
import '../fitness-public.css';

const links: { to: string; hash?: string; labelVi: string; labelEn: string }[] = [
  { to: '/#about', hash: 'about', labelVi: 'Về SÖL', labelEn: 'About SÖL' },
  { to: '/#multisport', hash: 'multisport', labelVi: 'Bộ môn', labelEn: 'Disciplines' },
  { to: '/#trainers', hash: 'trainers', labelVi: 'Huấn luyện viên', labelEn: 'Coaches' },
  { to: '/#packages', hash: 'packages', labelVi: 'Gói tập', labelEn: 'Memberships' },
];

/** Chọn kiểu cuộn tôn trọng prefers-reduced-motion. */
const preferredScrollBehavior = (): ScrollBehavior =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';

/** Cuộn tới phần tử theo id (tôn trọng prefers-reduced-motion); trả false nếu không tìm thấy. */
const scrollToSection = (targetId: string) => {
  const element = document.getElementById(targetId);
  if (!element) return false;
  element.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
  return true;
};

/** Mũi tên tròn trang trí (thẳng hoặc chéo) cho các nút. */
export function RoundArrow({ diagonal = false }: { diagonal?: boolean }) {
  useSourceLanguage();
  return <span className="fit-round-arrow" aria-hidden="true">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {diagonal ? <path d="M4.5 11.5L11.5 4.5M6 4.5h5.5V10" /> : <path d="M3.5 8h9M8.5 4l4 4-4 4" />}
    </svg>
  </span>;
}

/**
 * Khung trang công khai: header, điều hướng (đánh dấu mục đang xem), menu di động, footer, đặt tiêu đề tab,
 * cuộn tới neo #hash và hiệu ứng xuất hiện theo component; minimal bỏ bớt phần phụ cho trang đăng nhập/đăng ký.
 */
export function PublicLayout({ children, minimal = false }: { children: ReactNode; minimal?: boolean }) {
  useSourceLanguage();
  const { lang, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, hash, search } = useLocation();
  const user = useCurrentUser();
  const root = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useComponentReveal(root, pathname);
  // Mục điều hướng có đang được chọn theo đường dẫn và neo hay không.
  const isNavActive = (to: string, target?: string) => {
    const sportTarget = sportIdFromPath(pathname);
    if (target === 'multisport' && sportTarget) return true;
    if (target === 'trainers') return pathname.startsWith('/trainers') || (pathname === '/' && hash === '#trainers');
    if (target) return pathname === '/' && hash === `#${target}`;
    return pathname === to;
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const onPointerDown = (event: Event) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const activeSport = sportIdFromPath(pathname);
    const pageTitle = pathname === '/login'
      ? (lang === 'en' ? 'Sign In' : 'Đăng nhập')
      : pathname === '/register'
        ? (lang === 'en' ? 'Member Registration' : 'Đăng ký hội viên')
        : activeSport
          ? SPORT_PAGES[activeSport].title
          : pathname.startsWith('/trainers')
            ? (lang === 'en' ? 'Coaches' : 'Huấn luyện viên')
            : (lang === 'en' ? 'Build your body. Find your balance.' : 'Xây dựng thể chất. Tìm lại cân bằng.');
    document.title = `${pageTitle} · SÖL Fitness`;
    if (hash) {
      const targetId = hash.slice(1);
      let attempts = 0;
      let timerId = 0;
      // Thử cuộn tới neo, lặp tối đa 10 lần mỗi 50ms vì nội dung có thể chưa render.
      const tryScroll = () => {
        if (scrollToSection(targetId) || attempts >= 10) return;
        attempts += 1;
        timerId = window.setTimeout(tryScroll, 50);
      };
      const frame = requestAnimationFrame(tryScroll);
      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(timerId);
      };
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, lang]);

  return <div data-i18n-managed className={`fit-site${pathname === '/' ? ' fit-site--landing' : ''}`} ref={root}>
    <div className="fit-scroll-progress" aria-hidden="true" />
    <a className="fit-skip" href="#public-main">{t('Đến nội dung chính', 'Skip to main content')}</a>
    <div className="fit-canvas">
      <header className="fit-header" ref={headerRef}>
        <Link className="fit-brand" to="/" aria-label={t('SÖL Fitness · Trang chủ', 'SÖL Fitness · Home')} onClick={() => window.scrollTo({ top: 0, behavior: preferredScrollBehavior() })}><span>{"SÖL"}</span>Fitness<span className="fit-brand-dot" aria-hidden="true">®</span></Link>
        {!minimal && (
          <nav className={`fit-nav ${menuOpen ? 'is-open' : ''}`} id="public-navigation" aria-label={t('Điều hướng chính', 'Main navigation')}>
            {links.map(({ to, hash: target, labelVi, labelEn }) => <Link
              key={to}
              to={to}
              data-nav-target={target}
              className={isNavActive(to, target) ? 'is-active' : undefined}
              onClick={(event) => {
                setMenuOpen(false);
                if (target && pathname === '/') {
                  if (hash === `#${target}`) {
                    event.preventDefault();
                  }
                  scrollToSection(target);
                } else if (!target && pathname === to) {
                  window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
                }
              }}
            >{lang === 'en' ? labelEn : labelVi}</Link>)}
          </nav>
        )}
        <div className="fit-header-actions">
          {minimal && <LanguageSetting variant="footer" className="fit-auth-lang" />}
          <ThemeToggle />
          <Link to={user ? homePath(user.role) : pathname === '/login' ? purchaseAuthPath('/register', search) : purchaseAuthPath('/login', search)} className="fit-pill fit-header-cta">
            <span className="fit-header-cta-label">{user ? t('Vào portal', 'Enter portal') : pathname === '/login' ? t('Tham gia ngay', 'Join now') : t('Đăng nhập', 'Sign in')}</span><RoundArrow />
          </Link>
          {!minimal && (
            <button ref={menuButtonRef} type="button" className="fit-menu" aria-controls="public-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? t('Đóng menu', 'Close menu') : t('Mở menu', 'Open menu')} onClick={() => setMenuOpen(!menuOpen)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /> : <path d="M3.5 5h9M3.5 8h9M3.5 11h9" />}
              </svg>
            </button>
          )}
        </div>
      </header>
      {children}
      {!minimal && (
        <footer className="fit-footer" id="contact">
          <div className="fit-footer-main">
            <div>
              <Link to="/" className="fit-brand" onClick={() => window.scrollTo({ top: 0, behavior: preferredScrollBehavior() })}><span>{"SÖL"}</span>Fitness<span className="fit-brand-dot" aria-hidden="true">®</span></Link>
            </div>
            <nav aria-label={t('Điều hướng chân trang', 'Footer navigation')}>{links.map(({ to, hash: target, labelVi, labelEn }) => <Link
              key={to}
              to={to}
              onClick={(event) => {
                if (target && pathname === '/') {
                  if (hash === `#${target}`) {
                    event.preventDefault();
                  }
                  scrollToSection(target);
                } else if (!target && pathname === to) {
                  window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
                }
              }}
            >{lang === 'en' ? labelEn : labelVi}</Link>)}</nav>
            <address><span>{"120 Hai Bà Trưng, Quận 1, TP.HCM"}</span><a href="tel:19006868">1900 6868 ↗</a><a href="mailto:concierge@sol-wellness.vn">concierge@sol-wellness.vn</a></address>
          </div>
          <div className="fit-footer-bottom">
            <span>{"© 2026 SÖL Fitness"}</span>
            <span>{t('06:00 — 22:00 mỗi ngày', '06:00 — 22:00 daily')}</span>
            <LanguageSetting variant="footer" />
            <Link to={user ? homePath(user.role) : '/login'}>{user ? (user.role === 'MEMBER' ? t('Không gian hội viên', 'Member workspace') : t('Vào portal', 'Enter portal')) : t('Đăng nhập', 'Sign in')} ↗</Link>
          </div>
          <div className="fit-footer-watermark" aria-hidden="true">{"SÖL FITNESS"}</div>
        </footer>
      )}
    </div>
    {!minimal && <ChatWidget key={sessionIdentityKey(user)} />}
  </div>;
}

/** Khung trang đăng nhập/đăng ký: giới thiệu bên trái và biểu mẫu bên phải trong PublicLayout tối giản. */
export function AuthLayout({ children, mode }: { children: ReactNode; mode: 'login' | 'register' }) {
  useSourceLanguage();
  const { lang, t } = useI18n();
  return <PublicLayout minimal>
    <main id="public-main" className="fit-auth">
      <div className="fit-auth-story" data-reveal="soft">
        <h1>
          {mode === 'login'
            ? (lang === 'en' ? <>Return to<br /><em>your training schedule.</em></> : <>{sourceText("Trở lại")}<br /><em>{sourceText("lịch tập của bạn.")}</em></>)
            : (lang === 'en' ? <>Begin<br /><em>{"with SÖL."}</em></> : <>{sourceText("Bắt đầu")}<br /><em>{sourceText("cùng SÖL.")}</em></>)}
        </h1>
        <div className="fit-auth-photo"><LoadingImage src="/images/fitness/strength-session.jpg" alt={t('Vận động viên tập luyện sức mạnh với tạ tại phòng gym', 'Athlete performing strength training in the gym')} /></div>
      </div>
      <div className="fit-auth-form" data-reveal="lift">{children}</div>
    </main>
  </PublicLayout>;
}
