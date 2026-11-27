import { getLanguage, subscribeLanguage, type SourceMessage } from '../i18n/language';
// Hiển thị phản hồi trong nội dung hiện tại, không dùng popup nổi.
let activeToastTimer: number | null = null;
let unsubscribeLanguage: (() => void) | null = null;
let unsubscribeKeydown: (() => void) | null = null;
let unsubscribeContainer: (() => void) | null = null;

/** Đóng thông báo đang hiện: hủy hẹn giờ, gỡ các listener ngôn ngữ/phím và xóa phần tử khỏi DOM. */
function clearActive() {
  if (activeToastTimer !== null) {
    window.clearTimeout(activeToastTimer);
    activeToastTimer = null;
  }
  unsubscribeLanguage?.();
  unsubscribeLanguage = null;
  unsubscribeKeydown?.();
  unsubscribeKeydown = null;
  unsubscribeContainer?.();
  unsubscribeContainer = null;
  document.querySelectorAll('.sol-toast').forEach((notice) => notice.remove());
}

export const dismissToast = clearActive;

function toastContainer(): HTMLElement {
  return document.querySelector<HTMLElement>('dialog[open]')
    ?? document.getElementById('portal-main')
    ?? document.querySelector<HTMLElement>('main')
    ?? document.body;
}

/** Gắn toast vào vị trí phù hợp trong dialog (sau tiêu đề hộp thoại) hoặc trang portal (sau .portal-header). */
function mountToast(container: HTMLElement, el: HTMLElement) {
  if (container.matches('dialog[open]')) {
    const body = container.querySelector<HTMLElement>('.portal-dialog__body') ?? container;
    const header = body.querySelector<HTMLElement>(':scope > .portal-dialog__header')
      ?? body.querySelector<HTMLElement>('.portal-dialog__header');
    if (header && body.contains(header)) {
      header.after(el);
    } else {
      body.prepend(el);
    }
    return;
  }
  if (container.id === 'portal-main') {
    const header = [...container.querySelectorAll<HTMLElement>('.portal-container > .portal-header')]
      .find((candidate) => !candidate.closest('[hidden]'));
    if (header) {
      header.after(el);
      return;
    }
  }
  container.prepend(el);
}

/** Nếu toast mới gắn nằm phía trên vùng nhìn thấy thì cuộn mượt tới nó mà không cướp focus bàn phím. */
function revealIfAboveViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect?.();
  if (rect && rect.height > 0 && rect.top < 0) {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    el.scrollIntoView?.({ behavior, block: 'nearest' });
  }
}

/** Hiện thông báo nổi (một lúc chỉ một thông báo), tự đổi ngôn ngữ nếu có bản dịch, đóng bằng nút × hoặc Esc. */
export function toast(message: string, type: 'success' | 'error' = 'success', translation?: SourceMessage) {
  clearActive();

  const el = document.createElement('div');
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
  // Cập nhật chữ theo ngôn ngữ hiện tại (nội dung, nhãn nút đóng, nhãn trợ năng).
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

  // Esc thì tắt thông báo.
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') clearActive();
  };
  document.addEventListener('keydown', handleEscape);
  unsubscribeKeydown = () => document.removeEventListener('keydown', handleEscape);

  let container = toastContainer();
  mountToast(container, el);
  revealIfAboveViewport(el);
  let resumeAfterMove = () => {};

  // DESIGN.md: thông báo lỗi (alert) giữ nguyên cho tới khi người dùng tự đóng; thông báo thường tự đóng sau 3,2s và tạm dừng khi hover hoặc focus.
  if (type !== 'error') {
    let hovered = false;
    let focused = false;
    const pause = () => {
      if (activeToastTimer !== null) {
        window.clearTimeout(activeToastTimer);
        activeToastTimer = null;
      }
    };
    const schedule = () => {
      pause();
      if (!hovered && !focused) {
        activeToastTimer = window.setTimeout(clearActive, 3200);
      }
    };
    card.addEventListener('pointerenter', () => {
      hovered = true;
      pause();
    });
    card.addEventListener('pointerleave', () => {
      hovered = false;
      schedule();
    });
    card.addEventListener('focusin', () => {
      focused = true;
      pause();
    });
    card.addEventListener('focusout', (event) => {
      if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) return;
      focused = false;
      schedule();
    });
    resumeAfterMove = () => {
      const wasPaused = hovered || focused;
      hovered = false;
      focused = card.contains(document.activeElement);
      // Gỡ modal có thể không phát pointerleave/focusout; chỉ khởi động lại timer đang tạm dừng.
      if (wasPaused) schedule();
    };
    schedule();
  }

  if (container.matches('dialog[open]')) {
    // Chuyển chính toast hiện có khi modal đóng/unmount; không tạo bản sao hoặc lấy focus.
    const observer = new MutationObserver(() => {
      if (container.isConnected && container.matches('dialog[open]') && el.isConnected) return;
      container = toastContainer();
      mountToast(container, el);
      revealIfAboveViewport(el);
      resumeAfterMove();
      if (!container.matches('dialog[open]')) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    unsubscribeContainer = () => {
      observer.disconnect();
      el.remove(); // Toast có thể vẫn nằm trong cây modal đã bị gỡ khỏi document.
    };
  }
}

toast.success = (message: string, translation?: SourceMessage) => toast(message, 'success', translation);
toast.error = (message: string, translation?: SourceMessage) => toast(message, 'error', translation);
