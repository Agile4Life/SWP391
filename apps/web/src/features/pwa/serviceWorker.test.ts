// @vitest-environment node
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { createWorkerSource } from './serviceWorker';

function worker(networkFails = false, assets = ['/assets/app-hash.js'], precache = assets) {
  const listeners: Record<string, (event: Record<string, unknown>) => void> = {};
  const shell = new Response('<html>shell</html>');
  const cachedAsset = new Response('asset');
  const entries = new Map([['/index.html', shell], ['/assets/app-hash.js', cachedAsset]]);
  const cache = {
    addAll: vi.fn().mockResolvedValue(undefined),
    match: vi.fn(async (key: string) => entries.get(key)?.clone()),
    put: vi.fn(async (key: string, response: Response) => { entries.set(key, response); }),
  };
  const storage = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue(['sol-portal-old', 'other-app']), delete: vi.fn().mockResolvedValue(true) };
  const fetch = networkFails ? vi.fn().mockRejectedValue(new Error('offline')) : vi.fn().mockResolvedValue(new Response('network'));
  const self = { location: { origin: 'https://sol.test' }, clients: { claim: vi.fn() }, skipWaiting: vi.fn(), addEventListener: vi.fn((name, handler) => { listeners[name] = handler; }) };
  runInNewContext(createWorkerSource('test', assets, precache), { self, caches: storage, fetch, URL, Response });
  function request(path: string, mode = 'cors', method = 'GET', authorized = false) {
    const respondWith = vi.fn();
    listeners.fetch({ request: { url: `https://sol.test${path}`, mode, method, headers: { has: () => authorized } }, respondWith, waitUntil: vi.fn() });
    return respondWith;
  }
  return { listeners, cache, storage, fetch, self, request };
}

describe('portal service worker', () => {
  it('warms already visited chunks after first control while excluding APIs and unknown paths', async () => {
    const w = worker(false, ['/assets/app-hash.js', '/assets/member-card.js'], ['/assets/app-hash.js']);
    const waitUntil = vi.fn();
    w.listeners.message({ data: { type: 'CACHE_VISITED_ASSETS', paths: ['/assets/member-card.js', '/api/v1/profile', '/private.png'] }, waitUntil });
    expect(waitUntil).toHaveBeenCalledOnce();
    await waitUntil.mock.calls[0][0];
    w.fetch.mockRejectedValue(new Error('offline'));
    const offline = w.request('/assets/member-card.js');
    expect(await (await offline.mock.calls[0][0]).text()).toBe('network');
    expect(w.fetch).toHaveBeenCalledOnce();
  });

  it('precaches startup assets without downloading untouched lazy routes', async () => {
    const w = worker(false, ['/assets/app-hash.js', '/assets/member-card.js'], ['/assets/app-hash.js']);
    const waitUntil = vi.fn();
    w.listeners.install({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(w.cache.addAll).toHaveBeenCalledWith(['/index.html', '/assets/app-hash.js']);
  });

  it('stores a visited lazy route and serves it on a later offline navigation', async () => {
    const w = worker(false, ['/assets/app-hash.js', '/assets/member-card.js'], ['/assets/app-hash.js']);
    const online = w.request('/assets/member-card.js');
    expect(await (await online.mock.calls[0][0]).text()).toBe('network');
    w.fetch.mockRejectedValue(new Error('offline'));
    const offline = w.request('/assets/member-card.js');
    expect(await (await offline.mock.calls[0][0]).text()).toBe('network');
    expect(w.fetch).toHaveBeenCalledOnce();
  });

  it('never intercepts APIs, authenticated requests, writes or unknown assets', () => {
    const w = worker();
    for (const [path, mode, method, authorized] of [
      ['/api/v1/check-in/self', 'cors', 'POST', true],
      ['/api/v1/check-in/gate-qr', 'cors', 'GET', false],
      ['/assets/app-hash.js', 'cors', 'GET', true],
      ['/member/check-in', 'navigate', 'POST', false],
      ['/images/private-card.png', 'cors', 'GET', false],
    ] as const) expect(w.request(path, mode, method, authorized)).not.toHaveBeenCalled();
  });

  it('serves only the static shell for offline navigation and precached assets', async () => {
    const w = worker(true);
    const navigation = w.request('/member/check-in', 'navigate');
    expect(await (await navigation.mock.calls[0][0]).text()).toContain('shell');
    const asset = w.request('/assets/app-hash.js');
    expect(await (await asset.mock.calls[0][0]).text()).toBe('asset');
    expect(w.cache.addAll).not.toHaveBeenCalled();
  });

  it('installs only build assets, waits for explicit update and cleans only owned caches', async () => {
    const w = worker();
    const waitUntil = vi.fn();
    w.listeners.install({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(w.cache.addAll).toHaveBeenCalledWith(['/index.html', '/assets/app-hash.js']);
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
    w.listeners.message({ data: { type: 'SKIP_WAITING' } });
    expect(w.self.skipWaiting).toHaveBeenCalledOnce();
    w.listeners.activate({ waitUntil });
    await waitUntil.mock.calls[1][0];
    expect(w.storage.delete).toHaveBeenCalledWith('sol-portal-old');
    expect(w.storage.delete).not.toHaveBeenCalledWith('other-app');
  });
});
