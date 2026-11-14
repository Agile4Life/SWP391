import { getLanguage, subscribeLanguage, type SourceMessage } from '../i18n/language';
// Thông báo nổi góc trên phải (.sol-toast): không chặn tương tác trang và không cướp focus khỏi ô nhập hiện tại.
let activeToastTimer: number | null = null;
let unsubscribeLanguage: (() => void) | null = null;
let unsubscribeKeydown: (() => void) | null = null;

function clearActive() {
  if (activeToastTimer !== null) {
    window.clearTimeout(activeToastTimer);
    activeToastTimer = null;
  }
  unsubscribeLanguage?.();
  unsubscribeLanguage = null;
  unsubscribeKeydown?.();
  unsubscribeKeydown = null;
  document.querySelectorAll<HTMLDialogElement>('dialog.sol-toast').forEach((dialog) => {
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    dialog.remove();
  });
}

export function toast(message: string, type: 'success' | 'error' = 'success', translation?: SourceMessage) {
  clearActive();

  const el = document.createElement('dialog');
  if (translation) el.setAttribute('data-i18n-managed', '');
  el.className = `sol-toast sol-toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  el.setAttribute('aria-describedby', 'sol-toast-message');

  const card = document.createElement('div');
  card.className = 'sol-toast__card';

  const icon = document.createElement('span');
  icon.className = 'sol-toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML =
    type === 'error'
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="7" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  const body = document.createElement('p');
  body.className = 'sol-toast__message';
  body.id = 'sol-toast-message';
  body.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'sol-toast__close';
  const renderLanguage = () => {
    const english = getLanguage() === 'en';
    if (translation) body.textContent = english ? translation.en : translation.vi;
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', english ? 'Close notification' : 'Đóng thông báo');
    el.setAttribute('aria-label', type === 'error' ? (english ? 'Error' : 'Lỗi') : (english ? 'Notification' : 'Thông báo'));
  };
  renderLanguage();
  unsubscribeLanguage = subscribeLanguage(renderLanguage);
  closeBtn.addEventListener('click', clearActive);

  card.append(icon, body, closeBtn);
  el.append(card);

  // Esc hoặc nút đóng đều tắt thông báo mà không chiếm focus khi mới hiện.
  el.addEventListener('cancel', (event) => { event.preventDefault(); clearActive(); });
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') clearActive();
  };
  document.addEventListener('keydown', handleEscape);
  unsubscribeKeydown = () => document.removeEventListener('keydown', handleEscape);

  document.body.append(el);
  if (typeof el.show === 'function') el.show();
  else el.setAttribute('open', '');

  // Tự đóng; giữ lại khi người dùng đang rê chuột hoặc trỏ vào thông báo.
  const schedule = () => {
    if (activeToastTimer !== null) window.clearTimeout(activeToastTimer);
    activeToastTimer = window.setTimeout(clearActive, type === 'error' ? 5500 : 3200);
  };
  card.addEventListener('pointerenter', () => { if (activeToastTimer !== null) window.clearTimeout(activeToastTimer); activeToastTimer = null; });
  card.addEventListener('pointerleave', schedule);
  schedule();
}

toast.success = (message: string, translation?: SourceMessage) => toast(message, 'success', translation);
toast.error = (message: string, translation?: SourceMessage) => toast(message, 'error', translation);
