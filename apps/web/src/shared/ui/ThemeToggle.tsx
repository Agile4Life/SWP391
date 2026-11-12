import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useI18n } from '../i18n';
import './theme.css';
import './dark-volt.css';

type Theme = 'light' | 'dark';
type ToggleOrigin = { x: number; y: number };
const ThemeContext = createContext<{ theme: Theme; toggle: (origin?: ToggleOrigin) => void } | null>(null);
const REVEAL_MS = 450;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem('scms_theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f5f3' : '#202020');
    try { localStorage.setItem('scms_theme', theme); } catch { /* Theme still works without storage. */ }
  }, [theme]);
  const toggle = (origin?: ToggleOrigin) => {
    const swap = () => setTheme(current => current === 'dark' ? 'light' : 'dark');
    const doc = document as ViewTransitionDocument;
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof doc.startViewTransition !== 'function' || reduceMotion) { swap(); return; }
    // The new theme grows as a circle from the toggle; browsers without View Transitions switch instantly.
    const rootElement = document.documentElement;
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    rootElement.dataset.themeVt = '';
    const transition = doc.startViewTransition(() => { flushSync(swap); });
    transition.ready.then(() => {
      rootElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: REVEAL_MS, easing: 'cubic-bezier(.22, 1, .36, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => { /* Transition skipped: the theme has already switched. */ });
    transition.finished.catch(() => undefined).finally(() => { delete rootElement.dataset.themeVt; });
  };
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const context = useContext(ThemeContext);
  const { t } = useI18n();
  if (!context) return null;
  const label = context.theme === 'dark'
    ? t('Bật chế độ sáng', 'Switch to light mode')
    : t('Bật chế độ tối', 'Switch to dark mode');
  return <button className="theme-toggle" type="button" onClick={event => {
    const box = event.currentTarget.getBoundingClientRect();
    context.toggle({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  }} aria-label={label} title={label}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {context.theme === 'dark'
        ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
        : <path d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z" />}
    </svg>
  </button>;
}
