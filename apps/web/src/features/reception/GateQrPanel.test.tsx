import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GateQrPanel } from './GateQrPanel';
import { checkinApi } from './checkinApi';
vi.mock('./checkinApi', () => ({ checkinApi: { gateQr: vi.fn() } }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async (value: string) => `data:image/png;base64,${value}`) } }));
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date', 'performance'] });
  vi.mocked(checkinApi.gateQr).mockResolvedValue({ qrCode: 'current', gateId: 'A1', gate: 'Gate A1', generatedAt: '2020-01-01T00:00:00Z', expiresAt: '2020-01-01T00:01:00Z', expiresInSeconds: 60 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.clearAllMocks(); });
it('uses server lifetime despite local clock skew and removes a code when refresh fails', async () => {
  await act(async () => root.render(<GateQrPanel gateId="A1" />));
  expect(host.querySelector('img')).not.toBeNull();
  vi.mocked(checkinApi.gateQr).mockRejectedValue(new Error('offline'));
  await act(async () => vi.advanceTimersByTime(46000));
  expect(host.querySelector('img')).toBeNull();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
it('hides a previous gate immediately while the next gate is loading', async () => {
  await act(async () => root.render(<GateQrPanel gateId="A1" />));
  expect(host.querySelector('img')).not.toBeNull();
  vi.mocked(checkinApi.gateQr).mockReturnValue(new Promise(() => {}));
  await act(async () => root.render(<GateQrPanel gateId="A2" />));
  expect(host.querySelector('img')).toBeNull();
});
it('hides an expired code while renewal remains pending', async () => {
  await act(async () => root.render(<GateQrPanel gateId="A1" />));
  expect(host.querySelector('img')).not.toBeNull();
  vi.mocked(checkinApi.gateQr).mockReturnValue(new Promise(() => {}));
  await act(async () => vi.advanceTimersByTime(61000));
  expect(host.querySelector('img')).toBeNull();
});
it('removes a suspended tab code immediately on return before renewal resolves', async () => {
  await act(async () => root.render(<GateQrPanel gateId="A1" />));
  expect(host.querySelector('img')).not.toBeNull();
  vi.mocked(checkinApi.gateQr).mockReturnValue(new Promise(() => {}));
  vi.setSystemTime(Date.now() + 120000);
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(host.querySelector('img')).toBeNull();
});
