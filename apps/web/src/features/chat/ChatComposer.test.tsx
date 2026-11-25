import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLanguage } from '../../shared/i18n';
import { ChatComposer } from './ChatComposer';

let host: HTMLDivElement, root: Root;
const onSubmit = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  setLanguage('vi');
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); setLanguage('vi'); vi.clearAllMocks(); vi.unstubAllGlobals(); });
// Dựng component vào DOM giả để kiểm thử.
const render = (value = 'Hello', sending = false, extra: { disabled?: boolean; maxLength?: number; onChange?: (text: string) => void } = {}) =>
  act(async () => root.render(<ChatComposer id="composer" label="Message" value={value} onChange={extra.onChange ?? (() => {})} onSubmit={onSubmit} sending={sending} disabled={extra.disabled} maxLength={extra.maxLength} />));

it('sends on physical Enter while preserving Shift+Enter and IME composition', async () => {
  await render();
  const input = host.querySelector('textarea')!;
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
  });
  expect(onSubmit).not.toHaveBeenCalled();
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

it('does not submit whitespace or a pending message through keyboard or form', async () => {
  for (const [value, sending] of [['   ', false], ['Hello', true]] as const) {
    await render(value, sending);
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    await act(async () => {
      host.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  }
  expect(onSubmit).not.toHaveBeenCalled();
});

it('updates the visible send label, tooltip and emoji accessible name with language', async () => {
  await render();
  const send = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(send.textContent).toBe('Gửi');
  await act(async () => setLanguage('en'));
  expect(send.textContent).toBe('Send');
  expect(send.title).toBe('Send');
  expect(host.querySelector('[aria-label="Choose emoji"]')).not.toBeNull();
  expect(host.querySelector('textarea')!.placeholder).toBe('Message...');
});

it('P2-FE-79: enforces maxLength on emoji insertion and canSend, and closes emoji picker when disabled', async () => {
  const onChange = vi.fn();
  await render('a'.repeat(1999), false, { maxLength: 2000, onChange });
  const emojiToggle = host.querySelector<HTMLButtonElement>('[aria-label="Chọn biểu tượng cảm xúc"]')!;
  await act(async () => emojiToggle.click());
  const muscleBtn = host.querySelector<HTMLButtonElement>('[aria-label="Chèn 💪"]')!;
  // '💪' has length 2 -> 1999 + 2 = 2001 > 2000 so button is disabled and insert is blocked
  expect(muscleBtn.disabled).toBe(true);
  await act(async () => muscleBtn.click());
  expect(onChange).not.toHaveBeenCalled();

  // Over-length value disables Send button and blocks submit
  await render('a'.repeat(2001), false, { maxLength: 2000, onChange });
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(onSubmit).not.toHaveBeenCalled();

  // Opening emoji picker, then disabling and re-enabling composer keeps emoji picker closed
  await render('Hi', false, { disabled: false, onChange });
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Chọn biểu tượng cảm xúc"]')!.click());
  expect(host.querySelector('.direct-chat__emoji-bar')).not.toBeNull();
  await render('Hi', false, { disabled: true, onChange });
  expect(host.querySelector('.direct-chat__emoji-bar')).toBeNull();
  await render('Hi', false, { disabled: false, onChange });
  expect(host.querySelector('.direct-chat__emoji-bar')).toBeNull();
});
