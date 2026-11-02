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
