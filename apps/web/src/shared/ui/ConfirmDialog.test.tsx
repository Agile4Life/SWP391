import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useConfirm, type ConfirmOptions } from './ConfirmDialog';
import { dismissToast, toast } from './toast';

let host: HTMLDivElement, root: Root;
const results: Promise<boolean>[] = [];
let pending: ConfirmOptions;
// Component phụ chỉ phục vụ kiểm thử.
function Harness() {
  const [confirm, dialog] = useConfirm();
  return <><button type="button" data-open onClick={() => { results.push(confirm(pending)); }}>open</button>{dialog}</>;
}
// Hàm trợ giúp nhập liệu hoặc thao tác trên biểu mẫu trong DOM giả.
async function ask(options: ConfirmOptions) {
  pending = options;
  await act(async () => host.querySelector<HTMLButtonElement>('[data-open]')!.click());
  return { result: results.at(-1)! };
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); dismissToast(); host.remove(); vi.unstubAllGlobals(); });
// Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
const button = (text: string) => Array.from(host.querySelectorAll('button')).find((b) => b.textContent === text)!;

it('resolves true when confirmed and uses the danger style for destructive actions', async () => {
  const { result } = await ask({ title: 'Khóa tài khoản?', message: 'Không thể đăng nhập.', confirmLabel: 'Khóa', danger: true });
  expect(host.querySelector('dialog')?.textContent).toContain('Khóa tài khoản?');
  expect(button('Khóa').className).toBe('btn-danger');
  await act(async () => button('Khóa').click());
  await expect(result).resolves.toBe(true);
  expect(host.querySelector('dialog')).toBeNull();
});

it('resolves false when cancelled and exposes alertdialog semantics with aria-describedby', async () => {
  const { result } = await ask({ title: 'Ẩn bản ghi?', message: 'Chỉ trên trình duyệt này.' });
  const dialog = host.querySelector('dialog')!;
  expect(dialog.getAttribute('role')).toBe('alertdialog');
  const descId = dialog.getAttribute('aria-describedby');
  expect(descId).toBeTruthy();
  expect(document.getElementById(descId!)?.textContent).toBe('Chỉ trên trình duyệt này.');
  await act(async () => button('Hủy').click());
  await expect(result).resolves.toBe(false);
});

it('resolves pending confirm promise with false when the host unmounts', async () => {
  const { result } = await ask({ title: 'Xóa mục?', message: 'Thao tác không thể hoàn tác.' });
  await act(async () => root.unmount());
  await expect(result).resolves.toBe(false);
  // Tạo lại root để afterEach unmount an toàn.
  root = createRoot(host);
});

it('renders feedback in a unified centered alertdialog popup without icon or bottom Close button', () => {
  const portal = document.createElement('div');
  portal.className = 'portal-v2';
  portal.innerHTML = '<main id="portal-main"></main>';
  document.body.append(portal);
  try {
    toast('Yêu cầu thất bại (HTTP 502)', 'error');
    const dialog = portal.querySelector<HTMLDialogElement>('dialog.portal-dialog.sol-toast.sol-toast--error[open]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.style.margin).toBe('auto');
    expect(dialog.querySelector('.portal-alert--error .sol-toast__message')?.textContent).toBe('Yêu cầu thất bại (HTTP 502)');
    expect(dialog.querySelector('.sol-toast__icon')).toBeNull();
    expect([...dialog.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Đóng')).toBe(false);
  } finally {
    dismissToast();
    portal.remove();
  }
});

it('stacks feedback above an open dialog without closing it and restores focus on dismiss', () => {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('open', '');
  dialog.innerHTML = '<input id="modal-field" aria-label="Field">';
  document.body.append(dialog);
  try {
    const input = dialog.querySelector<HTMLInputElement>('#modal-field')!;
    input.focus();
    toast('Không thể lưu', 'error');
    const notice = document.querySelector<HTMLDialogElement>('dialog.portal-dialog.sol-toast.sol-toast--error[open]')!;
    expect(notice).not.toBeNull();
    expect(dialog.contains(notice)).toBe(false);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(notice.querySelector('.sol-toast__message')?.textContent).toBe('Không thể lưu');
    notice.querySelector<HTMLButtonElement>('.sol-toast__close')!.click();
    expect(document.querySelector('dialog.sol-toast')).toBeNull();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(input);
  } finally {
    dismissToast();
    dialog.remove();
  }
});

it('never auto-dismisses success or error toasts and keeps only one popup open at a time', () => {
  vi.useFakeTimers();
  try {
    toast('Lỗi nghiêm trọng', 'error');
    vi.advanceTimersByTime(60_000);
    expect(document.querySelector('dialog.sol-toast--error[open]')).not.toBeNull();

    toast('Đã lưu thành công', 'success');
    vi.advanceTimersByTime(60_000);
    expect(document.querySelectorAll('dialog.sol-toast')).toHaveLength(1);
    expect(document.querySelector('dialog.sol-toast--error')).toBeNull();
    expect(document.querySelector('dialog.sol-toast--success[open]')).not.toBeNull();
  } finally {
    dismissToast();
    vi.useRealTimers();
  }
});

it('exposes alertdialog semantics, focuses close button, restores focus, and closes via Escape or Close button', () => {
  const input = document.createElement('input');
  document.body.append(input);
  try {
    input.focus();

    toast('Đã lưu.', 'success');
    const el = document.querySelector<HTMLDialogElement>('dialog.portal-dialog.sol-toast.sol-toast--success[open]')!;
    expect(el.getAttribute('role')).toBe('alertdialog');
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent).toBe('Thành công');
    expect(document.getElementById(el.getAttribute('aria-describedby')!)?.textContent).toBe('Đã lưu.');
    expect(document.activeElement).toBe(el.querySelector('.sol-toast__close'));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.sol-toast')).toBeNull();
    expect(document.activeElement).toBe(input);

    toast('Không lưu được.', 'error');
    const error = document.querySelector<HTMLDialogElement>('dialog.portal-dialog.sol-toast.sol-toast--error[open]')!;
    expect(error.getAttribute('role')).toBe('alertdialog');
    expect(document.getElementById(error.getAttribute('aria-labelledby')!)?.textContent).toBe('Không thể thực hiện');
    error.querySelector<HTMLButtonElement>('.sol-toast__close')!.click();
    expect(document.querySelector('.sol-toast')).toBeNull();
    expect(document.activeElement).toBe(input);
  } finally {
    dismissToast();
    input.remove();
  }
});
