import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useConfirm, type ConfirmOptions } from './ConfirmDialog';
import { toast } from './toast';

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
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.querySelectorAll('.sol-toast').forEach((n) => n.remove()); vi.unstubAllGlobals(); });
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

it('renders feedback inline without opening a popup', () => {
  const main = document.createElement('main');
  main.id = 'portal-main';
  document.body.append(main);
  toast('Yêu cầu thất bại (HTTP 502)', 'error');
  expect(main.querySelector('[role="alert"]')?.textContent).toContain('Yêu cầu thất bại (HTTP 502)');
  expect(document.querySelector('dialog.sol-toast')).toBeNull();
  main.remove();
});

it('shows feedback inside an open dialog', () => {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('open', '');
  document.body.append(dialog);
  toast('Không thể lưu', 'error');
  expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('Không thể lưu');
  dialog.remove();
});

it('never auto-dismisses error toasts and pauses/resumes success toast timer on focusin/focusout', () => {
  vi.useFakeTimers();
  try {
    toast('Lỗi nghiêm trọng', 'error');
    vi.advanceTimersByTime(60_000);
    expect(document.querySelector('.sol-toast--error')).not.toBeNull();

    toast('Đã lưu thành công', 'success');
    const card = document.querySelector<HTMLElement>('.sol-toast__card')!;
    const closeBtn = document.querySelector<HTMLButtonElement>('.sol-toast__close')!;
    // Focus vào card phải tạm dừng đếm ngược tự đóng
    card.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(10_000);
    expect(document.querySelector('.sol-toast--success')).not.toBeNull();

    // Rời focus ra ngoài thì tiếp tục đếm ngược và tự đóng sau 3.2s
    card.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    vi.advanceTimersByTime(3100);
    expect(document.querySelector('.sol-toast--success')).not.toBeNull();
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.sol-toast--success')).toBeNull();
    expect(closeBtn).toBeDefined();
  } finally {
    vi.useRealTimers();
  }
});

it('shows a non-blocking live notice described by its message without stealing focus and closes it with Escape or Close button', () => {
  const input = document.createElement('input');
  document.body.append(input);
  input.focus();

  toast('Đã lưu.', 'success');
  const el = document.querySelector('.sol-toast')!;
  expect(el.getAttribute('role')).toBe('status');
  expect(el.getAttribute('aria-live')).toBe('polite');
  expect(el.hasAttribute('aria-modal')).toBe(false);
  expect(document.activeElement).toBe(input);
  expect(document.getElementById(el.getAttribute('aria-describedby')!)?.textContent).toBe('Đã lưu.');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(document.querySelector('.sol-toast')).toBeNull();

  toast('Không lưu được.', 'error');
  const error = document.querySelector('.sol-toast')!;
  expect(error.getAttribute('role')).toBe('alert');
  expect(error.getAttribute('aria-live')).toBe('assertive');
  error.querySelector<HTMLButtonElement>('.sol-toast__close')!.click();
  expect(document.querySelector('.sol-toast')).toBeNull();
  input.remove();
});
