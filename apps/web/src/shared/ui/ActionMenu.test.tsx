import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './ActionMenu';
import { Modal } from './Modal';
import { popoverPlacement } from './popoverPlacement';
import { installClickRipple } from './clickRipple';

describe('ActionMenu, popoverPlacement, and clickRipple', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.querySelectorAll('.click-ripple').forEach((n) => n.remove());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('attaches document listeners only while open, applies placement.h class, and consumes Escape without closing parent Modal', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const onModalClose = vi.fn();

    await act(async () => root.render(
      <Modal title="Hộp thoại cha" onClose={onModalClose}>
        <ActionMenu label="Thao tác">
          <button type="button">Sửa</button>
        </ActionMenu>
      </Modal>,
    ));

    // Khi đóng, ActionMenu không gắn pointerdown/keydown lên document.
    expect(addSpy.mock.calls.filter(([type]) => type === 'pointerdown' || type === 'keydown')).toHaveLength(0);

    const details = host.querySelector<HTMLDetailsElement>('details.action-menu')!;
    const summary = details.querySelector<HTMLElement>('summary')!;
    vi.spyOn(summary, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 100, 36, 36));

    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });

    expect(addSpy.mock.calls.some(([type]) => type === 'pointerdown')).toBe(true);
    expect(addSpy.mock.calls.some(([type]) => type === 'keydown')).toBe(true);
    expect(details.querySelector('.action-menu__list')?.classList.contains('action-menu__list--left')).toBe(true);

    // Nhấn Escape chỉ đóng ActionMenu, trả focus về summary và không đóng Modal cha
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    await act(async () => {
      summary.dispatchEvent(esc);
    });
    expect(esc.defaultPrevented).toBe(true);
    expect(details.open).toBe(false);
    expect(onModalClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(summary);
    expect(removeSpy.mock.calls.some(([type]) => type === 'pointerdown')).toBe(true);
  });

  it('clamps popoverPlacement horizontal check against dialog.left', () => {
    const dialog = document.createElement('dialog');
    const trigger = document.createElement('button');
    dialog.append(trigger);
    host.append(dialog);
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 100, 400, 400));
    // Trigger ở gần mép trái của dialog (right = 340, width = 200 -> 340 - 200 = 140 < dialog.left + 8 = 308)
    // nên không được đặt 'right' làm tràn mép trái dialog.
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(510, 150, 30, 36));
    const place = popoverPlacement(trigger, 250, 120);
    expect(place.h).toBe('left');
  });

  it('marks click ripples aria-hidden, skips aria-disabled buttons, and cleans up even without animationend', () => {
    vi.useFakeTimers();
    let reduced = false;
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return reduced; },
      addEventListener() {},
      removeEventListener() {},
    }));
    const abortCtrl = new AbortController();
    const origAdd = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      origAdd(type, listener, typeof options === 'object' ? { ...options, signal: abortCtrl.signal } : { capture: Boolean(options), signal: abortCtrl.signal });
    });

    try {
      installClickRipple();

      const disabledBtn = document.createElement('button');
      disabledBtn.setAttribute('aria-disabled', 'true');
      host.append(disabledBtn);
      disabledBtn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
      expect(document.querySelector('.click-ripple')).toBeNull();

      const activeBtn = document.createElement('button');
      host.append(activeBtn);
      activeBtn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true, clientX: 50, clientY: 60 }));
      const ripple = document.querySelector<HTMLElement>('.click-ripple')!;
      expect(ripple).not.toBeNull();
      expect(ripple.getAttribute('aria-hidden')).toBe('true');

      // Chuyển reduced motion giữa phiên -> không bỏ rác trong DOM nhờ fallback timer
      reduced = true;
      vi.advanceTimersByTime(800);
      expect(document.querySelector('.click-ripple')).toBeNull();

      activeBtn.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
      expect(document.querySelector('.click-ripple')).toBeNull();
    } finally {
      abortCtrl.abort();
      vi.useRealTimers();
    }
  });
});
