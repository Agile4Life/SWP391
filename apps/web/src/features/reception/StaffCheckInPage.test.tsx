import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StaffCheckInPage } from './StaffCheckInPage';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';

const visit = { id: 1, memberId: 100, memberName: 'Hội viên đang tập', checkInTime: '2026-10-21T12:00:00',
  checkOutTime: null as string | null, method: 'qr_code', gate: 'Gate A', status: 'GRANTED' };
let host: HTMLDivElement;
let root: Root;
let history: typeof visit[];
let checkoutResponse: Promise<Response>;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 'staff', name: 'Lễ tân', identifier: 'staff', role: 'STAFF' }));
  history = [visit];
  checkoutResponse = Promise.resolve(new Response(JSON.stringify({ success: true, data: { ...visit, checkOutTime: '2026-10-21T13:00:00' } })));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/checkout') ? checkoutResponse
    : new Response(JSON.stringify({ success: true, data: history }))));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  document.querySelectorAll('.sol-toast').forEach((node) => node.remove());
  vi.unstubAllGlobals();
});

async function renderPage() {
  await act(async () => root.render(<StaffCheckInPage />));
}

function checkoutButtons() {
  return [...host.querySelectorAll('button')].filter((button) => button.textContent?.includes('Checkout'));
}

it('keeps every open visit available for checkout, including visits older than the newest ten scans', async () => {
  history = Array.from({ length: 11 }, (_, index) => ({ ...visit, id: index + 1, memberName: `Member ${index + 1}` }));
  await renderPage();
  expect(checkoutButtons()).toHaveLength(11);
  expect(host.textContent).toContain('Member 11');
  const recent = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('10 lượt gần nhất'))!;
  await act(async () => recent.click());
  expect(host.querySelectorAll('tbody tr')).toHaveLength(10);
});

it('places the checkout action before horizontally scrollable history details', async () => {
  await renderPage();
  expect(host.querySelector('tbody tr td:first-child button')?.textContent).toContain('Checkout');
});

it('shows the granted member photo, package and days remaining from the scan', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ success: true,
    data: url.endsWith('/scan') ? { ...visit, avatarUrl: 'https://example.test/photo.jpg', packageName: 'Gói tập 30 ngày', remainingDays: 7 } : history }))));
  await renderPage();
  const input = host.querySelector('#checkin-qr-input') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'valid-qr');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => (host.querySelector('[data-testid="scan-submit-button"]') as HTMLButtonElement).click());
  const banner = host.querySelector('[data-testid="checkin-result-banner"]')!;
  expect(banner.textContent).toContain('Gói tập 30 ngày');
  expect(banner.textContent).toContain('7 ngày');
  expect(banner.querySelector('img')?.getAttribute('src')).toBe('https://example.test/photo.jpg');
});

it('checks out through the real API client and removes the visit from the open list', async () => {
  await renderPage();
  await act(async () => checkoutButtons()[0].click());
  expect(fetch).toHaveBeenCalledWith('/api/v1/check-in/1/checkout', expect.objectContaining({ method: 'POST' }));
  expect(checkoutButtons()).toHaveLength(0);
  expect(host.textContent).toContain('Không có hội viên đang trong trung tâm');
  expect(document.querySelector('.sol-toast--success')?.textContent).toContain('thành công');
});

it('keeps checkout available after a server failure and explains the error', async () => {
  checkoutResponse = Promise.resolve(new Response(JSON.stringify({ message: 'Không thể ghi nhận ra về' }), { status: 500 }));
  await renderPage();
  await act(async () => checkoutButtons()[0].click());
  expect(checkoutButtons()).toHaveLength(1);
  expect(checkoutButtons()[0].disabled).toBe(false);
  expect(document.querySelector('.sol-toast--error')?.textContent).toContain('Không thể ghi nhận ra về');
});

it('submits one checkout request when the same action is clicked repeatedly', async () => {
  let finish!: (response: Response) => void;
  checkoutResponse = new Promise((resolve) => { finish = resolve; });
  await renderPage();
  const button = checkoutButtons()[0];
  await act(async () => { button.click(); button.click(); });
  expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/checkout'))).toHaveLength(1);
  expect(button.disabled).toBe(true);
  await act(async () => finish(new Response(JSON.stringify({ success: true, data: { ...visit, checkOutTime: '2026-10-21T13:00:00' } }))));
});
