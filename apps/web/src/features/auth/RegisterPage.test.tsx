import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';

const api = vi.hoisted(() => ({ register: vi.fn(), sendOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('./authApi', () => api);
vi.mock('../landing/components/PublicLayout', () => ({ AuthLayout: ({ children }: { children: React.ReactNode }) => children }));
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear();
  Object.values(api).forEach(fn => fn.mockReset());
  api.register.mockResolvedValue({}); api.sendOtp.mockResolvedValue({}); api.verifyOtp.mockResolvedValue({});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function render() { await act(async () => root.render(<MemoryRouter><RegisterPage /></MemoryRouter>)); }
async function fill(id: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function validForm(phone = '') {
  await fill('reg-username', ' buyer '); await fill('reg-email', 'buyer@example.test');
  await fill('reg-phone', phone); await fill('reg-password', 'Buyer123!');
}
async function submit() { await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }

it('normalizes the phone example before sending the validated registration', async () => {
  await render(); await validForm('0912 345 678'); await submit();
  expect(api.register).toHaveBeenCalledWith({ username: 'buyer', email: 'buyer@example.test', phone: '0912345678', password: 'Buyer123!' });
  expect(host.querySelector('#otp-code')).not.toBeNull();
});

it('links validation errors to their inputs and focuses the first invalid field', async () => {
  await render(); await validForm('1234'); await submit();
  const phone = host.querySelector<HTMLInputElement>('#reg-phone')!;
  expect(phone.getAttribute('aria-invalid')).toBe('true');
  expect(host.querySelector(`#${phone.getAttribute('aria-describedby')}`)?.textContent).toContain('Số điện thoại');
  expect(document.activeElement).toBe(phone);
  expect(api.register).not.toHaveBeenCalled();
});

it('keeps the registered account at OTP when delivery fails and retries only delivery', async () => {
  api.sendOtp.mockRejectedValueOnce(new Error('Mail unavailable')).mockResolvedValue({});
  await render(); await validForm(); await submit();
  expect(host.querySelector('#otp-code')).not.toBeNull();
  expect(host.textContent).toContain('Mail unavailable');
  const resend = [...host.querySelectorAll('button')].find(b => b.textContent === 'Gửi lại mã OTP')!;
  await act(async () => resend.click());
  expect(api.register).toHaveBeenCalledTimes(1);
  expect(api.sendOtp).toHaveBeenCalledTimes(2);
});

it('restores only the pending account identity after remount without storing credentials', async () => {
  await render(); await validForm(); await submit();
  expect(JSON.stringify(sessionStorage)).not.toContain('Buyer123!');
  await act(async () => root.unmount()); root = createRoot(host); await render();
  expect(host.querySelector('#otp-code')).not.toBeNull();
  expect(host.textContent).toContain('buyer@example.test');
  expect(api.register).toHaveBeenCalledTimes(1);
});
