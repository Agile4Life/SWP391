// Thông báo nổi ngắn gọn (thay cho alert()). Dùng chung style .sol-toast trong styles.css.
export function toast(message: string, type: 'success' | 'error' = 'success') {
  document.querySelectorAll('.sol-toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = `sol-toast sol-toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.style.zIndex = '2147483647';
  el.innerHTML = `<span class="sol-toast__icon" aria-hidden="true">${type === 'error' ? '!' : '✓'}</span>`;
  el.append(message);

  // Nếu đang mở <dialog> (HTML5 Top Layer), gắn toast vào bên trong dialog để không bị lớp backdrop che mờ
  const activeDialog = document.querySelector<HTMLDialogElement>('dialog[open]');
  if (activeDialog) {
    activeDialog.append(el);
  } else {
    document.body.append(el);
  }

  window.setTimeout(() => el.remove(), type === 'error' ? 5000 : 3200);
}
