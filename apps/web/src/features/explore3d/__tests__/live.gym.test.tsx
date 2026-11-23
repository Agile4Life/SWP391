import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { apiFetch } from '../../../shared/api/client';
import { courtsApi } from '../../courts/courtsApi';
import { clearLiveCenterCache, useLiveCenterData } from '../data/useLiveCenterData';

vi.mock('../../../shared/api/client', async importOriginal => ({
  ...await importOriginal<typeof import('../../../shared/api/client')>(),
  apiFetch: vi.fn(),
}));
vi.mock('../../courts/courtsApi', async importOriginal => {
  const original = await importOriginal<typeof import('../../courts/courtsApi')>();
  return { ...original, courtsApi: { ...original.courtsApi, courts: vi.fn(), availability: vi.fn() } };
});

afterEach(() => { clearLiveCenterCache(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it.each([false, true])('skips removed court requests and preserves core loading errors: %s', async failCore => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(apiFetch).mockImplementation(async path => {
    if (failCore && (path === '/rooms' || path === '/equipment')) throw new Error('Core data unavailable');
    if (path === '/public/catalog') return { packages: [], coaches: [], sessions: [] };
    return [];
  });
  function Probe() {
    const { loading, error } = useLiveCenterData();
    return <span>{loading ? 'loading' : error ? 'error' : 'ready'}</span>;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Probe />));
    expect(host.textContent).toBe(failCore ? 'error' : 'ready');
    expect(courtsApi.courts).not.toHaveBeenCalled();
    const paths = vi.mocked(apiFetch).mock.calls.map(([path]) => path);
    expect(paths.some(path => path.startsWith('/public/products'))).toBe(false);
    expect(paths).not.toContain('/check-in/streak');
    expect(paths.some(path => path.startsWith('/classes/sessions?'))).toBe(false);
  } finally {
    await act(async () => root.unmount());
  }
});
