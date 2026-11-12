import { getLanguage, subscribeLanguage, type SourceMessage } from '../i18n/language';
// Thông báo kết quả thao tác: một hộp vuông giữa màn hình (icon, nội dung, nút Đóng), dùng chung style .sol-toast trong styles.css.
// Là <dialog> gốc mở bằng showModal nên luôn nằm trên mọi hộp thoại khác (Top Layer); khi đóng, focus trả về chỗ cũ.
let activeToastTimer: number | null = null;
let unsubscribeLanguage: (() => void) | null = null;

function clearActive() {
  if (activeToastTimer !== null) {
    window.clearTimeout(activeToastTimer);
    activeToastTimer = null;
  }
  unsubscribeLanguage?.();
  unsubscribeLanguage = null;
  document.querySelectorAll<HTMLDialogElement>('dialog.sol-toast').forEach((dialog) => {
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    dialog.remove();
  });
}

export function toast(message: string, type: 'success' | 'error' = 'success', translation?: SourceMessage) {
  clearActive();

  const el = document.createElement('dialog');
  if (translation) el.setAttribute('data-i18n-managed', '');
  el.className = `sol-toast sol-toast--${type}`;
  // Hộp thoại modal: lỗi là alertdialog, thành công là dialog; trình đọc màn hình đọc nội dung qua aria-describedby khi mở.
  el.setAttribute('role', type === 'error' ? 'alertdialog' : 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-describedby', 'sol-toast-message');

  const card = document.createElement('div');
  card.className = 'sol-toast__card';

  const icon = document.createElement('span');
  icon.className = 'sol-toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML =
    type === 'error'
      ? `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="7" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
      : `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

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
    closeBtn.textContent = english ? 'Close' : 'Đóng';
    closeBtn.setAttribute('aria-label', english ? 'Close notification' : 'Đóng thông báo');
    el.setAttribute('aria-label', type === 'error' ? (english ? 'Error' : 'Lỗi') : (english ? 'Notification' : 'Thông báo'));
  };
  renderLanguage();
  unsubscribeLanguage = subscribeLanguage(renderLanguage);
  closeBtn.addEventListener('click', clearActive);

  card.append(icon, body, closeBtn);
  el.append(card);

  // Esc (sự kiện cancel gốc của <dialog>) và bấm vào nền mờ đều đóng thông báo.
  el.addEventListener('cancel', (event) => { event.preventDefault(); clearActive(); });
  el.addEventListener('click', (event) => { if (event.target === el) clearActive(); });

  document.body.append(el);
  if (typeof el.showModal === 'function') el.showModal();
  else el.setAttribute('open', '');
  closeBtn.focus({ preventScroll: true });

  // Tự đóng; giữ lại khi người dùng đang trỏ vào hoặc đang focus nút để kịp đọc.
  const schedule = () => {
    if (activeToastTimer !== null) window.clearTimeout(activeToastTimer);
    activeToastTimer = window.setTimeout(clearActive, type === 'error' ? 6000 : 3200);
  };
  card.addEventListener('pointerenter', () => { if (activeToastTimer !== null) window.clearTimeout(activeToastTimer); activeToastTimer = null; });
  card.addEventListener('pointerleave', schedule);
  schedule();
}

toast.success = (message: string, translation?: SourceMessage) => toast(message, 'success', translation);
toast.error = (message: string, translation?: SourceMessage) => toast(message, 'error', translation);
