import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemberCheckInPage } from './MemberCheckInPage';

const camera = vi.hoisted(() => ({ decode: null as null | ((value: { data: string }) => void) }));
vi.mock('qr-scanner', () => ({ default: class {
  constructor(_video: unknown, decode: typeof camera.decode) { camera.decode = decode; }
  start = async () => {};
  destroy = () => {};
} }));
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ success: true, data: url.includes('/self') ? {
    id: 1, memberId: 10, memberName: 'An', checkInTime: '2026-10-29T14:00:00', gate: 'Sảnh chính', status: 'GRANTED', method: 'qr',
  } : [] }))));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
// Dựng component vào DOM giả để kiểm thử.
async function render() { await act(async () => root.render(<MemoryRouter><MemberCheckInPage /></MemoryRouter>)); }
it('submits the decoded gate code once and waits for the server before showing success', async () => {
  await render();
  const button = [...host.querySelectorAll('button')].find((item) => item.textContent === 'Bật camera')!;
  await act(async () => button.click());
  const code = `SOL:GATE:1:A1:1793256000000:${'a'.repeat(64)}`;
  await act(async () => { camera.decode!({ data: code }); camera.decode!({ data: code }); });
  const posts = vi.mocked(fetch).mock.calls.filter((call) => String(call[0]).includes('/self'));
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0][1]?.body as string)).toEqual({ gateQr: code });
  expect(host.textContent).toContain('Check-in thành công');
});
it('rejects unrelated QR content without sending a check-in', async () => {
  await render();
  await act(async () => [...host.querySelectorAll('button')].find((item) => item.textContent === 'Bật camera')!.click());
  await act(async () => camera.decode!({ data: 'https://example.com' }));
  expect(host.textContent).toContain('Đây không phải mã QR cổng SÖL');
  expect(vi.mocked(fetch).mock.calls.filter((call) => String(call[0]).includes('/self'))).toHaveLength(0);
});
it('does not render manual check-out mode toggle on the member check-in page', async () => {
  await render();
  expect([...host.querySelectorAll('button')].find((item) => item.textContent === 'Check-out')).toBeUndefined();
});
it('requests a date range in Asia/Ho_Chi_Minh when a longer history window is chosen', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-31T17:30:00Z'));
  try {
    await render();
    await act(async () => [...host.querySelectorAll('button')].find((item) => item.textContent === '7 ngày')!.click());
    expect(vi.mocked(fetch).mock.calls.some((call) => String(call[0]).includes('fromDate=2026-10-26&toDate=2026-11-01'))).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
it('renders LoadingSkeleton and defers history load while active plan check is pending (P2-FE-58)', async () => {
  let resolvePlan!: (res: Response) => void;
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (String(url).includes('/subscriptions')) {
      return new Promise<Response>((resolve) => { resolvePlan = resolve; });
    }
    return Promise.resolve(new Response(JSON.stringify({ success: true, data: [] })));
  }));
  await render();
  expect(host.querySelector('button')?.textContent).not.toBe('Bật camera');
  expect(vi.mocked(fetch).mock.calls.some((call) => String(call[0]).includes('/check-in/history'))).toBe(false);
  await act(async () => resolvePlan(new Response(JSON.stringify({ success: true, data: { status: 'active', endDate: '2099-12-31' } }))));
  expect([...host.querySelectorAll('button')].some((b) => b.textContent === 'Bật camera')).toBe(true);
  expect(vi.mocked(fetch).mock.calls.some((call) => String(call[0]).includes('/check-in/history'))).toBe(true);
});
it('ignores stale history responses when switching filters rapidly and adapts Check-out copy (P2-FE-58)', async () => {
  let resolve30!: (res: Response) => void;
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const s = String(url);
    if (s.includes('/subscriptions')) {
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: { status: 'active', endDate: '2099-12-31' } })));
    }
    if (s.includes('fromDate=')) {
      return new Promise<Response>((resolve) => { resolve30 = resolve; });
    }
    if (s.includes('/check-in/history')) {
      return Promise.resolve(new Response(JSON.stringify({
        success: true,
        data: [{ id: 9, memberId: 10, memberName: 'An', checkInTime: '2026-10-29T08:00:00', gate: 'Cổng Hôm Nay', status: 'GRANTED', method: 'qr' }],
      })));
    }
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: { id: 2, memberId: 10, memberName: 'An', checkInTime: '2026-10-29T14:00:00', gate: 'Sảnh chính', status: 'DENIED', denialReason: 'Chưa vào cổng', method: 'qr' },
    })));
  }));
  await render();
  await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent === '30 ngày')!.click());
  await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Hôm nay')!.click());
  await act(async () => resolve30(new Response(JSON.stringify({
    success: true,
    data: [{ id: 99, memberId: 10, memberName: 'An', checkInTime: '2026-10-01T08:00:00', gate: 'Cổng 30 Ngày Cũ', status: 'GRANTED', method: 'qr' }],
  }))));
  expect(host.textContent).toContain('Cổng Hôm Nay');
  expect(host.textContent).not.toContain('Cổng 30 Ngày Cũ');
});
it('styles history load error with qr-checkin-error class', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const s = String(url);
    if (s.includes('/subscriptions')) {
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: { status: 'active', endDate: '2099-12-31' } })));
    }
    return Promise.reject(new Error('offline'));
  }));
  await render();
  const errorEl = host.querySelector('p.qr-checkin-error[role="alert"]');
  expect(errorEl).not.toBeNull();
});
