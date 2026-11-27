import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { clearNotices, getNotices, notify, usePortalNotices } from '../lib/portalNotices';
import { ApiError } from '../api/client';
import {
  clearMissingTranslations,
  getMissingTranslations,
  setLanguage,
  sourceMessage,
  subscribeLanguage,
  translateSource,
  useI18n,
  useLanguage,
} from './language';
import { sourceToast } from './sourceText';
import { localizableError } from '../lib/errorMessage';
import { dismissToast } from '../ui/toast';
// Component phụ chỉ phục vụ kiểm thử.
function Notices() { const notices = usePortalNotices(); const { t } = useI18n(); return <>{notices.map(n => <p key={n.id}>{n.translation ? t(n.translation) : n.message}</p>)}</>; }
afterEach(() => { dismissToast(); clearNotices(); setLanguage('vi'); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('updates already-visible source notices/toasts, preserving untagged API content and stored message strings', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); setLanguage('vi');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<Notices />));
    await act(async () => notify('Gói tập', 'success', { record: true, translation: sourceMessage('Gói tập') }));
    const stored = getNotices()[0].message;
    await act(async () => notify('Gói tập', 'info', { record: true }));
    await act(async () => setLanguage('en'));
    expect(host.textContent).toBe('Gói tậpMemberships');
    expect(document.querySelector('.sol-toast__message')?.textContent).toBe('Memberships');
    expect(document.querySelector('.sol-toast__close')?.getAttribute('aria-label')).toBe('Close notification');
    expect(getNotices().find(n => n.translation)?.message).toBe(stored);
    await act(async () => setLanguage('vi'));
    expect(host.textContent).toBe('Gói tậpGói tập');
    expect(document.querySelector('.sol-toast__message')?.textContent).toBe('Gói tập');
  } finally { await act(async () => root.unmount()); host.remove(); vi.runAllTimers(); }
});
it('marks only source-owned fallback errors as translatable', () => {
  const apiError = new ApiError('Gói tập', 400);
  expect(localizableError(apiError, 'Thử lại')).toBe(apiError);
  expect(localizableError(new TypeError('implementation detail'), 'Thử lại')).toBe('Thử lại');
});

// P2-FE-18: noticePair normalizes whitespace and checks all 3 dictionaries
it('resolves EN translations in sourceToast across publicLabels, translations, and vietnamesePublicLabels with whitespace normalization', () => {
  vi.useFakeTimers();
  setLanguage('en');

  sourceToast('  Đăng nhập   thành công!  ', 'success');
  expect(document.querySelector('.sol-toast__message')?.textContent?.trim()).toBe('Signed in successfully!');

  sourceToast('  Đã gửi   tin nhắn.  ', 'success');
  const msgs = [...document.querySelectorAll('.sol-toast__message')].map((el) => el.textContent?.trim());
  expect(msgs).toContain('Message sent.');

  sourceToast('WeightLifting', 'success');
  const msgs2 = [...document.querySelectorAll('.sol-toast__message')].map((el) => el.textContent?.trim());
  expect(msgs2).toContain('Weightlifting');

  vi.runAllTimers();
});

// P3-FE-11 & P3-FE-08: SÖL Ö not misclassified as Vietnamese, $&/$1 safe replace, memoized toggleLanguage, shared storage listener
it('does not misclassify SÖL as missing Vietnamese, preserves $&/$1 tokens, memoizes toggleLanguage, and shares one storage listener', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  clearMissingTranslations();
  expect(translateSource('SÖL Fitness', undefined, 'en')).toBe('SÖL Fitness');
  expect(getMissingTranslations()).toEqual([]);

  expect(translateSource('  Giá  ', 'Price $& $1', 'en')).toBe('  Price $& $1  ');

  const toggles: Array<() => void> = [];
  function ToggleProbe() {
    const { lang, toggleLanguage } = useLanguage();
    toggles.push(toggleLanguage);
    return <button type="button" onClick={toggleLanguage}>{lang}</button>;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<ToggleProbe />));
    await act(async () => host.querySelector('button')!.click());
    expect(toggles.length).toBeGreaterThanOrEqual(2);
    expect(toggles[0]).toBe(toggles[1]);
  } finally {
    await act(async () => root.unmount());
  }

  const addSpy = vi.spyOn(window, 'addEventListener');
  const removeSpy = vi.spyOn(window, 'removeEventListener');
  const u1 = subscribeLanguage(() => {});
  const u2 = subscribeLanguage(() => {});
  expect(addSpy.mock.calls.filter(([t]) => t === 'storage')).toHaveLength(1);
  u1();
  expect(removeSpy.mock.calls.filter(([t]) => t === 'storage')).toHaveLength(0);
  u2();
  expect(removeSpy.mock.calls.filter(([t]) => t === 'storage')).toHaveLength(1);
});
