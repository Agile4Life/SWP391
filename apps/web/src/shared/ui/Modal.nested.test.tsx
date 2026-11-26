import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([new DOMRect(0, 0, 20, 20)] as unknown as DOMRectList);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Component phụ chỉ phục vụ kiểm thử.
function NestedDialogs() {
  const [outer, setOuter] = useState(true);
  const [inner, setInner] = useState(true);
  return outer && <Modal title="Điều hướng" onClose={() => setOuter(false)}>
    <button type="button">Mở cài đặt</button>
    {inner && <Modal title="Hướng dẫn cài đặt" onClose={() => setInner(false)}><p>Nội dung hướng dẫn</p></Modal>}
  </Modal>;
}

it('keeps the parent open when a nested cancel event reaches the dialog', async () => {
  await act(async () => root.render(<NestedDialogs />));
  const inner = host.querySelectorAll('dialog')[1];
  await act(async () => inner.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true })));
  expect(host.querySelectorAll('dialog')).toHaveLength(1);
  expect(host.querySelector('dialog h2')?.textContent).toBe('Điều hướng');
});

it('keeps Tab focus inside the innermost dialog', async () => {
  await act(async () => root.render(<NestedDialogs />));
  const innerClose = host.querySelectorAll('dialog')[1].querySelector<HTMLButtonElement>('button')!;
  innerClose.focus();
  await act(async () => innerClose.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(innerClose);
});

it('closes on a backdrop click but not when a text selection is dragged out of a field', async () => {
  const onClose = vi.fn();
  await act(async () => root.render(<Modal title="Thêm tài khoản" onClose={onClose}><input aria-label="Họ tên" /></Modal>));
  const dialog = host.querySelector('dialog')!;
  const input = host.querySelector('input')!;

  // Nhấn chuột trong ô nhập rồi thả ở nền tối: trình duyệt phát sự kiện click lên chính thẻ dialog.
  await act(async () => input.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
  await act(async () => dialog.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(onClose).not.toHaveBeenCalled();

  await act(async () => dialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
  await act(async () => dialog.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('stays open when a file picker inside it is dismissed', async () => {
  const onClose = vi.fn();
  await act(async () => root.render(<Modal title="Gói trải nghiệm" onClose={onClose}><input type="file" aria-label="Ảnh mặt trước" /></Modal>));
  const fileInput = host.querySelector('input[type="file"]')!;
  // Trình duyệt phát sự kiện `cancel` nổi bọt trên input chọn tệp khi đóng hộp thoại chọn tệp mà không chọn gì.
  await act(async () => fileInput.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true })));
  expect(onClose).not.toHaveBeenCalled();

  // Sự kiện cancel của chính hộp thoại (phím Esc) vẫn đóng hộp thoại.
  await act(async () => host.querySelector('dialog')!.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true })));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('includes summary and contenteditable in focus trap, handles Shift+Tab from dialog, ignores returnFocusRef identity changes, and restores activeElement', async () => {
  const opener = document.createElement('button');
  opener.type = 'button';
  opener.textContent = 'Mở';
  document.body.append(opener);
  opener.focus();

  const showModalSpy = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
  const refA = { current: opener };
  const refB = { current: opener };

  function Wrapper({ useRefB }: { useRefB: boolean }) {
    return (
      <Modal title="Chi tiết" onClose={() => {}} returnFocusRef={useRefB ? refB : refA}>
        <details><summary>Xem thêm</summary><button type="button">Ẩn</button></details>
        <div contentEditable suppressContentEditableWarning tabIndex={0} id="editable-box">Ghi chú</div>
      </Modal>
    );
  }

  await act(async () => root.render(<Wrapper useRefB={false} />));
  const initialCalls = showModalSpy.mock.calls.length;

  // Đổi tham chiếu prop returnFocusRef không được đóng/mở lại dialog
  await act(async () => root.render(<Wrapper useRefB={true} />));
  expect(showModalSpy.mock.calls.length).toBe(initialCalls);

  // Shift+Tab khi activeElement là chính <dialog> phải vòng về phần tử cuối (contenteditable)
  const dialog = host.querySelector<HTMLDialogElement>('dialog')!;
  const editable = host.querySelector<HTMLElement>('#editable-box')!;
  dialog.focus();
  await act(async () => {
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  });
  expect(document.activeElement).toBe(editable);

  // Khi unmount vẫn trả focus về returnFocusRef / activeElement trước khi mở
  await act(async () => root.unmount());
  expect(document.activeElement).toBe(opener);

  opener.focus();
  root = createRoot(host);
  await act(async () => root.render(<Modal title="Tự trả focus" onClose={() => {}}><button type="button">OK</button></Modal>));
  await act(async () => root.unmount());
  expect(document.activeElement).toBe(opener);

  opener.remove();
  root = createRoot(host);
});
