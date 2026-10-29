import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QrCameraScanner } from './QrCameraScanner';

const camera = vi.hoisted(() => ({ decode: null as null | ((value: { data: string }) => void), destroy: vi.fn(), start: vi.fn(), delayedCleanup: false,
  streams: [] as Array<{ stop: ReturnType<typeof vi.fn>; stream: MediaStream }> }));
vi.mock('qr-scanner', () => ({ default: class {
  private video: HTMLVideoElement;
  constructor(video: HTMLVideoElement, decode: typeof camera.decode) { camera.decode = decode; this.video = video; }
  start = () => {
    if (camera.delayedCleanup) {
      const stop = vi.fn();
      const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
      Object.defineProperty(this.video, 'srcObject', { configurable: true, writable: true, value: stream });
      camera.streams.push({ stop, stream });
    }
    return camera.start();
  };
  destroy = () => {
    camera.destroy();
    if (camera.delayedCleanup) setTimeout(() => {
      const stream = this.video.srcObject;
      if (stream && 'getTracks' in stream) stream.getTracks().forEach((track) => track.stop());
      this.video.srcObject = null;
    }, 300);
  };
} }));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  camera.start.mockReset().mockResolvedValue(undefined); camera.destroy.mockClear(); camera.delayedCleanup = false; camera.streams = [];
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('starts only on demand and delivers a code once before releasing the camera', async () => {
  const codes: string[] = [];
  await act(async () => root.render(<QrCameraScanner onScan={(code) => codes.push(code)} />));
  expect(camera.start).not.toHaveBeenCalled();
  await act(async () => host.querySelector('button')!.click());
  await act(async () => { camera.decode!({ data: 'SOL:GATE:1:A1:123:signature' }); camera.decode!({ data: 'duplicate' }); });
  expect(codes).toEqual(['SOL:GATE:1:A1:123:signature']);
  expect(camera.destroy).toHaveBeenCalled();
});
it('destroys a pending camera on unmount and never publishes a late result', async () => {
  camera.start.mockReturnValue(new Promise(() => {}));
  const codes: string[] = [];
  await act(async () => root.render(<QrCameraScanner onScan={(code) => codes.push(code)} />));
  await act(async () => host.querySelector('button')!.click());
  await act(async () => root.unmount());
  camera.decode!({ data: 'late' });
  expect(codes).toEqual([]);
  expect(camera.destroy).toHaveBeenCalled();
});
it('releases an active camera when disabled and ignores further results', async () => {
  const codes: string[] = [];
  const onScan = (code: string) => { codes.push(code); };
  await act(async () => root.render(<QrCameraScanner onScan={onScan} />));
  await act(async () => host.querySelector('button')!.click());
  await act(async () => root.render(<QrCameraScanner onScan={onScan} disabled />));
  camera.decode!({ data: 'offline' });
  expect(codes).toEqual([]);
  expect(camera.destroy).toHaveBeenCalled();
});
it('keeps a compact completed state through submission and can scan again', async () => {
  const codes: string[] = [];
  const onScan = (code: string) => { codes.push(code); };
  await act(async () => root.render(<QrCameraScanner onScan={onScan} />));
  await act(async () => host.querySelector('button')!.click());
  await act(async () => camera.decode!({ data: 'first' }));
  await act(async () => root.render(<QrCameraScanner onScan={onScan} disabled />));
  await act(async () => root.render(<QrCameraScanner onScan={onScan} />));
  expect(host.querySelector('button')!.textContent).toBe('Quét lại');
  expect(host.querySelector('.qr-camera--done')).not.toBeNull();
  expect(host.querySelector('video')).not.toBeNull();
  await act(async () => host.querySelector('button')!.click());
  expect(host.querySelector('.qr-camera--done')).toBeNull();
  await act(async () => camera.decode!({ data: 'second' }));
  expect(codes).toEqual(['first', 'second']);
});
it('isolates rapid retry from delayed cleanup belonging to the previous scanner', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); camera.delayedCleanup = true;
  const codes: string[] = [];
  await act(async () => root.render(<QrCameraScanner onScan={(code) => { codes.push(code); }} />));
  await act(async () => host.querySelector('button')!.click());
  expect(host.querySelector('button')!.textContent, host.textContent ?? '').toBe('Dừng camera');
  expect(camera.streams).toHaveLength(1);
  const firstVideo = host.querySelector('video');
  await act(async () => camera.decode!({ data: 'first' }));
  await act(async () => host.querySelector('button')!.click());
  const secondStream = camera.streams[1];
  await act(async () => vi.advanceTimersByTime(300));
  expect(secondStream.stop).not.toHaveBeenCalled();
  expect(host.querySelector('video')?.srcObject).toBe(secondStream.stream);
  expect(host.querySelector('video')).not.toBe(firstVideo);
  await act(async () => camera.decode!({ data: 'second' }));
  expect(codes).toEqual(['first', 'second']);
});
