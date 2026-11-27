import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissToast, toast } from './toast';
import { setLanguage } from '../i18n/language';

describe('toast unified centered dialog', () => {
  const originalPath = window.location.pathname;

  beforeEach(() => {
    vi.useFakeTimers();
    dismissToast();
    setLanguage('vi');
    window.history.replaceState(null, '', '/member/dashboard');
    document.body.innerHTML = '<div class="portal-v2"><main id="portal-main"><button id="return">Return</button></main></div>';
  });

  afterEach(() => {
    dismissToast();
    document.body.innerHTML = '';
    setLanguage('vi');
    window.history.replaceState(null, '', originalPath);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function openUnderlyingDialog() {
    const el = document.createElement('dialog');
    el.setAttribute('open', '');
    el.innerHTML = '<div class="portal-dialog__body"><input id="underlying-input" aria-label="Form field"></div>';
    document.body.append(el);
    return el;
  }

  it.each([
    '/member/dashboard',
    '/staff/reception',
    '/coach/classes',
    '/manager/internal-requests',
    '/admin/users',
    '/login',
    '/',
  ])('renders a centered alertdialog popup without icon or bottom close button on %s', (route) => {
    window.history.replaceState(null, '', route);

    toast.success('Đã lưu thay đổi');
    const dialog = document.querySelector<HTMLDialogElement>('dialog.portal-dialog.sol-toast.sol-toast--success[open]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('sol-toast-title');
    expect(dialog.getAttribute('aria-describedby')).toBe('sol-toast-message');
    expect(dialog.hasAttribute('data-i18n-managed')).toBe(false);
    expect(dialog.style.margin).toBe('auto');

    expect(dialog.querySelector('#sol-toast-title')?.textContent).toBe('Thành công');
    expect(dialog.querySelector('.portal-alert.portal-alert--success.sol-toast__alert .sol-toast__message')?.textContent).toBe('Đã lưu thay đổi');
    expect(dialog.querySelector('.portal-alert svg')).toBeNull();
    expect(dialog.querySelector('.sol-toast__icon')).toBeNull();

    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].className).toBe('portal-dialog__close sol-toast__close');
    expect(buttons[0].getAttribute('aria-label')).toBe('Đóng thông báo');
    expect(buttons[0].querySelector('svg')).not.toBeNull();
    expect(buttons.some((b) => b.textContent?.trim() === 'Đóng' || b.textContent?.trim() === 'Close')).toBe(false);

    toast.error('Không thể xử lý');
    const errorDialog = document.querySelector<HTMLDialogElement>('dialog.portal-dialog.sol-toast.sol-toast--error[open]')!;
    expect(errorDialog).not.toBeNull();
    expect(errorDialog.querySelector('#sol-toast-title')?.textContent).toBe('Không thể thực hiện');
    expect(errorDialog.querySelector('.portal-alert.portal-alert--error.sol-toast__alert .sol-toast__message')?.textContent).toBe('Không thể xử lý');
    expect(errorDialog.querySelector('.sol-toast__icon')).toBeNull();
  });

  it('mounts inside .portal-v2, falls back to .fit-site, and finally document.body', () => {
    toast.success('Trong portal');
    expect(document.querySelector('.portal-v2 > dialog.sol-toast')).not.toBeNull();

    document.body.innerHTML = '<div class="fit-site"><main>Landing</main></div>';
    toast.success('Trên landing');
    expect(document.querySelector('.fit-site > dialog.sol-toast')).not.toBeNull();

    document.body.innerHTML = '<main>Plain</main>';
    toast.error('Trên body');
    expect(document.body.querySelector(':scope > dialog.sol-toast--error')).not.toBeNull();
  });

  it('replaces any previous toast so only 1 centered popup exists at a time and preserves focus restoration', () => {
    const returnBtn = document.getElementById('return') as HTMLButtonElement;
    returnBtn.focus();

    toast.success('Thông báo đầu tiên');
    expect(document.querySelectorAll('.sol-toast')).toHaveLength(1);
    expect(document.activeElement).toBe(document.querySelector('.sol-toast__close'));

    toast.error('Thông báo thứ hai');
    expect(document.querySelectorAll('.sol-toast')).toHaveLength(1);
    expect(document.querySelector('.sol-toast--success')).toBeNull();
    expect(document.querySelector('.sol-toast--error .sol-toast__message')?.textContent).toBe('Thông báo thứ hai');
    expect(document.activeElement).toBe(document.querySelector('.sol-toast__close'));

    dismissToast();
    expect(document.querySelector('.sol-toast')).toBeNull();
    expect(document.activeElement).toBe(returnBtn);
  });

  it('stacks cleanly above an open dialog without closing it and restores focus back to the underlying dialog', () => {
    const underlying = openUnderlyingDialog();
    const underlyingCancel = vi.fn();
    underlying.addEventListener('cancel', underlyingCancel);
    const input = underlying.querySelector<HTMLInputElement>('#underlying-input')!;
    input.focus();

    toast.error('Lỗi thao tác');
    const notice = document.querySelector<HTMLDialogElement>('dialog.sol-toast--error[open]')!;
    expect(notice).not.toBeNull();
    expect(underlying.contains(notice)).toBe(false);
    expect(underlying.hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(notice.querySelector('.sol-toast__close'));

    notice.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(document.querySelector('dialog.sol-toast')).toBeNull();
    expect(underlying.hasAttribute('open')).toBe(true);
    expect(underlyingCancel).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });

  it('closes on close button click, cancel event, Escape keydown, and valid backdrop click only', () => {
    const returnBtn = document.getElementById('return') as HTMLButtonElement;
    returnBtn.focus();

    // Close via × button
    toast.success('Bấm nút X');
    document.querySelector<HTMLButtonElement>('.sol-toast__close')!.click();
    expect(document.querySelector('dialog.sol-toast')).toBeNull();
    expect(document.activeElement).toBe(returnBtn);

    // Close via native cancel event; ignore cancel events from descendants
    toast.error('Bấm Esc native');
    const cancelDialog = document.querySelector<HTMLDialogElement>('dialog.sol-toast')!;
    cancelDialog.querySelector('.sol-toast__message')!.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
    expect(document.querySelector('dialog.sol-toast')).toBe(cancelDialog);
    cancelDialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(document.querySelector('dialog.sol-toast')).toBeNull();
    expect(document.activeElement).toBe(returnBtn);

    // Close via synthetic Escape keydown on document
    toast.success('Bấm phím Escape');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('dialog.sol-toast')).toBeNull();
    expect(document.activeElement).toBe(returnBtn);

    // Dragging selection from inside dialog onto backdrop must NOT close
    toast.success('Không đóng khi kéo chọn chữ');
    const backdropDialog = document.querySelector<HTMLDialogElement>('dialog.sol-toast')!;
    const messageEl = backdropDialog.querySelector<HTMLElement>('.sol-toast__message')!;
    messageEl.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    backdropDialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('dialog.sol-toast')).toBe(backdropDialog);

    // Pressing on backdrop then releasing inside body must NOT close
    backdropDialog.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    messageEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('dialog.sol-toast')).toBe(backdropDialog);

    // Both pointerdown and click directly on dialog backdrop closes and restores focus
    backdropDialog.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    backdropDialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('dialog.sol-toast')).toBeNull();
    expect(document.activeElement).toBe(returnBtn);
  });

  it('updates title, message, and close aria-label dynamically when language toggles VI <-> EN', () => {
    toast.success('Đã từ chối đơn', { vi: 'Đã từ chối đơn', en: 'Request rejected' });
    const successDialog = document.querySelector<HTMLDialogElement>('dialog.sol-toast--success')!;
    expect(successDialog.hasAttribute('data-i18n-managed')).toBe(true);
    expect(successDialog.querySelector('#sol-toast-title')?.textContent).toBe('Thành công');
    expect(successDialog.querySelector('.sol-toast__message')?.textContent).toBe('Đã từ chối đơn');
    expect(successDialog.querySelector('.sol-toast__close')?.getAttribute('aria-label')).toBe('Đóng thông báo');

    setLanguage('en');
    expect(successDialog.querySelector('#sol-toast-title')?.textContent).toBe('Success');
    expect(successDialog.querySelector('.sol-toast__message')?.textContent).toBe('Request rejected');
    expect(successDialog.querySelector('.sol-toast__close')?.getAttribute('aria-label')).toBe('Close notification');

    setLanguage('vi');
    expect(successDialog.querySelector('#sol-toast-title')?.textContent).toBe('Thành công');
    expect(successDialog.querySelector('.sol-toast__message')?.textContent).toBe('Đã từ chối đơn');
    expect(successDialog.querySelector('.sol-toast__close')?.getAttribute('aria-label')).toBe('Đóng thông báo');

    // Error toast without translation updates chrome (title & aria-label) while preserving API message text
    toast.error('Backend message 502');
    const errorDialog = document.querySelector<HTMLDialogElement>('dialog.sol-toast--error')!;
    expect(errorDialog.hasAttribute('data-i18n-managed')).toBe(false);
    expect(errorDialog.querySelector('#sol-toast-title')?.textContent).toBe('Không thể thực hiện');
    setLanguage('en');
    expect(errorDialog.querySelector('#sol-toast-title')?.textContent).toBe('Unable to complete');
    expect(errorDialog.querySelector('.sol-toast__close')?.getAttribute('aria-label')).toBe('Close notification');
    expect(errorDialog.querySelector('.sol-toast__message')?.textContent).toBe('Backend message 502');
  });

  it('never auto-dismisses success or error toasts and cleans up cleanly on dismissToast()', async () => {
    toast.success('Giữ nguyên cho đến khi đóng');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(document.querySelector('dialog.sol-toast--success[open]')).not.toBeNull();

    toast.error('Lỗi giữ nguyên');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(document.querySelector('dialog.sol-toast--error[open]')).not.toBeNull();

    const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
    dismissToast();
    expect(document.querySelector('dialog.sol-toast')).toBeNull();
    expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
  });

  it('falls back to setting the open attribute when showModal is unavailable', () => {
    const originalShowModal = HTMLDialogElement.prototype.showModal;
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value: undefined, configurable: true });
    try {
      toast.success('Fallback open');
      const dialog = document.querySelector<HTMLDialogElement>('dialog.sol-toast[open]');
      expect(dialog).not.toBeNull();
      expect(dialog?.querySelector('.sol-toast__message')?.textContent).toBe('Fallback open');
      dismissToast();
      expect(document.querySelector('dialog.sol-toast')).toBeNull();
    } finally {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value: originalShowModal, configurable: true });
    }
  });
});
