import { getLanguage, subscribeLanguage, type SourceMessage } from '../i18n/language';

let unsubscribeLanguage: (() => void) | null = null;
let unsubscribeKeydown: (() => void) | null = null;
let unsubscribeDialog: (() => void) | null = null;

const CLOSE_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" style="display:block;flex-shrink:0"><path d="M4 4l8 8M12 4l-8 8" /></svg>';

/** Đóng thông báo đang hiện: gỡ toàn bộ listener, đóng dialog khỏi DOM và khôi phục focus trước đó. */
function clearActive() {
  const cleanLanguage = unsubscribeLanguage;
  const cleanKeydown = unsubscribeKeydown;
  const cleanDialog = unsubscribeDialog;
  unsubscribeLanguage = null;
  unsubscribeKeydown = null;
  unsubscribeDialog = null;

  cleanLanguage?.();
  cleanKeydown?.();
  cleanDialog?.();
  document.querySelectorAll('.sol-toast').forEach((notice) => notice.remove());
}

export const dismissToast = clearActive;

/** Hiện một hộp thoại thông báo thống nhất ở giữa màn hình (một lúc chỉ một popup), tự đổi ngôn ngữ nếu có bản dịch. */
export function toast(message: string, type: 'success' | 'error' = 'success', translation?: SourceMessage) {
  clearActive();

  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialog = document.createElement('dialog');
  dialog.className = `portal-dialog sol-toast sol-toast--${type}`;
  dialog.style.margin = 'auto';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'sol-toast-title');
  dialog.setAttribute('aria-describedby', 'sol-toast-message');
  if (translation) dialog.setAttribute('data-i18n-managed', '');

  const content = document.createElement('div');
  content.className = 'portal-dialog__body';

  const header = document.createElement('div');
  header.className = 'portal-dialog__header';

  const title = document.createElement('h2');
  title.id = 'sol-toast-title';
  title.className = 'portal-card-title';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'portal-dialog__close sol-toast__close';
  close.innerHTML = CLOSE_ICON_SVG;

  const alert = document.createElement('div');
  alert.className = `portal-alert portal-alert--${type} sol-toast__alert`;
  alert.style.marginBottom = '0';

  const body = document.createElement('p');
  body.id = 'sol-toast-message';
  body.className = 'sol-toast__message';
  body.style.margin = '0';

  const renderLanguage = () => {
    const english = getLanguage() === 'en';
    title.textContent = type === 'success'
      ? (english ? 'Success' : 'Thành công')
      : (english ? 'Unable to complete' : 'Không thể thực hiện');
    close.setAttribute('aria-label', english ? 'Close notification' : 'Đóng thông báo');
    body.textContent = translation ? (english ? translation.en : translation.vi) : message;
  };
  renderLanguage();
  unsubscribeLanguage = subscribeLanguage(renderLanguage);

  const handleCancel = (event: Event) => {
    if (event.target !== dialog) return;
    event.stopPropagation();
    event.preventDefault();
    clearActive();
  };

  let pressedBackdrop = false;
  const handlePointerDown = (event: PointerEvent) => {
    pressedBackdrop = event.target === dialog;
  };
  const handleClick = (event: MouseEvent) => {
    const fromBackdrop = pressedBackdrop;
    pressedBackdrop = false;
    if (fromBackdrop && event.target === dialog) clearActive();
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    clearActive();
  };

  close.addEventListener('click', clearActive);
  dialog.addEventListener('cancel', handleCancel);
  dialog.addEventListener('pointerdown', handlePointerDown);
  dialog.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleEscape, true);
  unsubscribeKeydown = () => document.removeEventListener('keydown', handleEscape, true);

  header.append(title, close);
  alert.append(body);
  content.append(header, alert);
  dialog.append(content);

  const mountTarget =
    document.querySelector<HTMLElement>('.portal-v2') ??
    document.querySelector<HTMLElement>('.fit-site') ??
    document.body;
  mountTarget.append(dialog);

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');

  close.focus({ preventScroll: true });

  unsubscribeDialog = () => {
    close.removeEventListener('click', clearActive);
    dialog.removeEventListener('cancel', handleCancel);
    dialog.removeEventListener('pointerdown', handlePointerDown);
    dialog.removeEventListener('click', handleClick);
    const shouldRestoreFocus = dialog.contains(document.activeElement) || document.activeElement === document.body;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    dialog.remove();
    if (shouldRestoreFocus && previousFocus?.isConnected) {
      previousFocus.focus({ preventScroll: true });
    }
  };
}

toast.success = (message: string, translation?: SourceMessage) => toast(message, 'success', translation);
toast.error = (message: string, translation?: SourceMessage) => toast(message, 'error', translation);
