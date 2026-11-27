import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissToast, toast } from './toast';
import { setLanguage } from '../i18n/language';

describe('toast lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers(); dismissToast(); setLanguage('vi');
    document.body.innerHTML = '<main id="portal-main"><button id="return">Return</button></main>';
  });
  afterEach(() => { dismissToast(); document.body.innerHTML = ''; setLanguage('vi'); vi.useRealTimers(); vi.restoreAllMocks(); });
  function dialog() {
    const el = document.createElement('dialog'); el.setAttribute('open', '');
    el.innerHTML = '<input aria-label="Form field">'; document.body.append(el); return el;
  }
  const flush = () => vi.advanceTimersByTimeAsync(0);

  it.each(['close', 'unmount'] as const)('keeps the same single toast after dialog %s without stealing restored focus', async action => {
    const modal = dialog(); modal.querySelector('input')!.focus();
    toast.success('Đã lưu', { vi: 'Đã lưu', en: 'Saved' });
    const notice = modal.querySelector('.sol-toast');
    expect(document.activeElement).toBe(modal.querySelector('input'));
    if (action === 'close') modal.removeAttribute('open'); else modal.remove();
    document.getElementById('return')!.focus();
    await flush();
    expect(document.querySelector('#portal-main .sol-toast')).toBe(notice);
    expect(document.querySelectorAll('.sol-toast')).toHaveLength(1);
    expect(document.activeElement?.id).toBe('return');
    setLanguage('en'); expect(notice?.textContent).toContain('Saved');
    expect(notice?.getAttribute('role')).toBe('status');
  });

  it('keeps the original 3200ms success deadline when the modal closes', async () => {
    const modal = dialog(); toast.success('Saved');
    await vi.advanceTimersByTimeAsync(2000); modal.remove(); await flush();
    await vi.advanceTimersByTimeAsync(1199); expect(document.querySelector('.sol-toast')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1); expect(document.querySelector('.sol-toast')).toBeNull();
  });

  it('cleans the observer on dismiss and never resurrects a removed modal toast', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const modal = dialog(); toast.error('Failed'); const notice = modal.querySelector<HTMLElement>('.sol-toast')!;
    modal.remove(); dismissToast(); await flush();
    document.body.append(document.createElement('div')); await flush();
    expect(disconnect).toHaveBeenCalled(); expect(notice.isConnected).toBe(false);
    expect(document.querySelector('.sol-toast')).toBeNull();
  });

  it('does not restore an older toast when a newer one replaces it', async () => {
    const modal = dialog(); toast.success('Old'); modal.remove(); toast.error('New'); await flush();
    expect(document.querySelectorAll('.sol-toast')).toHaveLength(1);
    expect(document.querySelector('.sol-toast')?.textContent).toContain('New');
    expect(document.querySelector('.sol-toast')?.textContent).not.toContain('Old');
    await vi.advanceTimersByTimeAsync(10000); expect(document.querySelector('.sol-toast')).not.toBeNull();
  });

  it('keeps the toast accessible in a remaining open dialog before moving to main', async () => {
    const first = dialog(); toast.success('Saved'); const notice = first.querySelector('.sol-toast');
    const remaining = dialog(); first.remove(); await flush();
    expect(remaining.querySelector('.sol-toast')).toBe(notice);
    remaining.remove(); await flush();
    expect(document.querySelector('#portal-main .sol-toast')).toBe(notice);
    expect(document.querySelectorAll('.sol-toast')).toHaveLength(1);
  });

  it.each(['main', 'body'] as const)('uses the existing %s fallback when there is no portal host', async target => {
    document.body.innerHTML = target === 'main' ? '<main></main>' : '';
    const modal = dialog(); toast.error('Failed'); const notice = modal.querySelector('.sol-toast');
    modal.remove(); await flush();
    expect(document.querySelector(target)?.firstElementChild).toBe(notice);
    expect(notice?.getAttribute('role')).toBe('alert');
  });

  it.each(['pointer', 'focus'] as const)('resumes a paused success timer after modal unmount (%s)', async mode => {
    const modal = dialog(); toast.success('Saved'); const card = modal.querySelector<HTMLElement>('.sol-toast__card')!;
    if (mode === 'pointer') card.dispatchEvent(new Event('pointerenter')); else card.querySelector<HTMLButtonElement>('button')!.focus();
    await vi.advanceTimersByTimeAsync(4000); expect(modal.querySelector('.sol-toast')).not.toBeNull();
    modal.remove(); document.getElementById('return')!.focus(); await flush();
    expect(document.querySelector('#portal-main .sol-toast')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(3200); expect(document.querySelector('.sol-toast')).toBeNull();
  });

  it('preserves hover/focus pause, dismiss button and Escape behavior', async () => {
    toast.success('Saved'); const card = document.querySelector<HTMLElement>('.sol-toast__card')!;
    card.dispatchEvent(new Event('pointerenter')); await vi.advanceTimersByTimeAsync(4000);
    expect(document.querySelector('.sol-toast')).not.toBeNull();
    card.dispatchEvent(new Event('pointerleave')); card.querySelector<HTMLButtonElement>('button')!.focus();
    await vi.advanceTimersByTimeAsync(4000); expect(document.querySelector('.sol-toast')).not.toBeNull();
    card.querySelector<HTMLButtonElement>('button')!.click(); expect(document.querySelector('.sol-toast')).toBeNull();
    toast.error('Failed'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.sol-toast')).toBeNull();
  });
});
