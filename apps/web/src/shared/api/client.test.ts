import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiFetch,
  apiFetchBlob,
  apiFetchPdf,
  ApiError,
  API_TIMEOUT_MS,
  clearAuthSession,
  getCurrentUser,
  homePath,
  loginApi,
  parseAuthSession,
  readRawAuthSession,
  setAuthSession,
  setCurrentUser,
  subscribeAuthSession,
  syncSessionWithServer,
  AUTH_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from './client';
import { authDestination, rememberPurchaseIntent } from '../lib/purchaseIntent';

describe('client.ts (API client & Auth session)', () => {
  it('supports Admin sessions and sends Admin to account administration', () => {
    const admin = setAuthSession('admin-jwt', 'admin@example.com', 'ADMIN');
    expect(admin.role).toBe('ADMIN');
    expect(getCurrentUser()?.role).toBe('ADMIN');
    expect(homePath(admin.role)).toBe('/admin/users');
  });

  it.each([['COACH', 'COACH'], ['RECEPTIONIST', 'STAFF']])('keeps the portal role from Google authentication: %s', (backendRole, sessionRole) => {
    expect(setAuthSession('google-jwt', 'staff@gmail.com', backendRole).role).toBe(sessionRole);
  });
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('manages user session in localStorage properly', () => {
    expect(getCurrentUser()).toBeNull();

    // Dữ liệu mẫu dùng trong các ca kiểm thử.
    const mockUser = {
      id: 'manager1',
      name: 'Manager',
      identifier: 'manager1',
      role: 'MANAGER' as const,
    };

    setCurrentUser(mockUser);
    expect(getCurrentUser()).toEqual(mockUser);

    localStorage.setItem(TOKEN_STORAGE_KEY, 'mock-jwt-token');
    clearAuthSession();

    expect(getCurrentUser()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('retains the chosen package when an expired session requires login again', async () => {
    window.history.replaceState({}, '', '/member/packages?packageId=2');
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    localStorage.setItem(TOKEN_STORAGE_KEY, 'expired-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Expired' }) }));
    await expect(apiFetch('/memberships/subscriptions/my')).rejects.toThrow('Expired');
    expect(assign).toHaveBeenCalledWith('/login?expired=1&returnTo=' + encodeURIComponent('/member/packages?packageId=2'));
    window.history.replaceState({}, '', '/');
  });

  it('apiFetch makes request with headers, token and unrolls data', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'bearer-token-123');

    const fakeResponseData = { id: 10, name: 'Yoga' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: true, message: 'OK', data: fakeResponseData }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await apiFetch<typeof fakeResponseData>('/disciplines');

    expect(result).toEqual(fakeResponseData);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/disciplines', {
      signal: expect.any(AbortSignal),
      headers: {
        'Accept-Language': 'vi',
        Authorization: 'Bearer bearer-token-123',
      },
    });
  });

  it('apiFetch gives up after the timeout with a TIMEOUT error instead of waiting forever', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })));
      const pending = apiFetch('/wallet/pay', { method: 'POST', body: '{}' });
      const assertion = expect(pending).rejects.toMatchObject({ status: 0, code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('apiFetch leaves a caller-provided signal in charge of cancellation', async () => {
    const controller = new AbortController();
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: 1 }) });
    vi.stubGlobal('fetch', mockFetch);
    await apiFetch('/ai/chat/sessions', { signal: controller.signal });
    expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('apiFetch throws ApiError when server returns error status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: false, message: 'Dữ liệu không hợp lệ' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/users')).rejects.toThrow('Dữ liệu không hợp lệ');
  });

  it.each([{}, { data: null }])('unwraps an empty successful envelope as null (%j)', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: true, status: 200, message: 'OK', ...payload }),
    }));
    await expect(apiFetch('/memberships/subscriptions/my')).resolves.toBeNull();
  });

  it.each([[], 0, false, ''])('preserves a non-null payload (%j)', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: true, data }),
    }));
    await expect(apiFetch('/test')).resolves.toEqual(data);
  });

  it('preserves a response without an ApiResponse envelope', async () => {
    const health = { service: 'scms-api', status: 'UP' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => health,
    }));
    await expect(apiFetch('/health')).resolves.toEqual(health);
  });

  it('loginApi sends credentials, stores token, and maps system roles correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({
        success: true,
        data: {
          token: 'jwt.token.abc',
          username: 'manager_acc',
          role: 'CENTER_MANAGER',
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await loginApi('manager_acc', 'Secret@123');

    expect(res.token).toBe('jwt.token.abc');
    expect(res.user.role).toBe('MANAGER');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt.token.abc');
    expect(getCurrentUser()?.name).toBe('manager_acc');
  });

  it('homePath routes correctly for each role', () => {
    expect(homePath('MANAGER')).toBe('/manager/reports');
    expect(homePath('STAFF')).toBe('/staff/reception');
    expect(homePath('COACH')).toBe('/coach/pt-attendance');
    expect(homePath('MEMBER')).toBe('/member/dashboard');
  });

  it('setAuthSession shows the real full name, falling back to the login only when there is none', () => {
    expect(setAuthSession('jwt-n', 'an.nguyen@example.com', 'MEMBER', '  Nguyễn Văn An ').name).toBe('Nguyễn Văn An');
    expect(setAuthSession('jwt-n', 'an.nguyen@example.com', 'MEMBER', '   ').name).toBe('an.nguyen@example.com');
    expect(setAuthSession('jwt-n', 'an.nguyen@example.com', 'MEMBER').name).toBe('an.nguyen@example.com');
  });

  it('setAuthSession stores session and rejects unsupported roles', () => {
    const user = setAuthSession('jwt-1', 'member1', 'MEMBER');
    expect(user.role).toBe('MEMBER');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt-1');
    expect(() => setAuthSession('jwt-2', 'x', 'UNKNOWN_ROLE')).toThrow(
      'Vai trò tài khoản chưa được hỗ trợ trên portal.',
    );
  });
  it('ignores a late 401 from a replaced session and keeps the newly signed-in account', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    setAuthSession('member-token', 'member01', 'MEMBER');
    let respond!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { respond = resolve; })));
    const pending = apiFetch('/memberships/subscriptions/my');

    setAuthSession('coach-token', 'coach01', 'COACH');
    respond({ ok: false, status: 401, json: async () => ({ message: 'Expired' }) });

    await expect(pending).rejects.toMatchObject({ status: 401, code: 'SESSION_REPLACED' });
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('coach-token');
    expect(getCurrentUser()?.identifier).toBe('coach01');
    expect(assign).not.toHaveBeenCalled();
  });

  it('notifies subscribers when the session changes in this tab or another tab', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAuthSession(listener);
    setAuthSession('t1', 'member01', 'MEMBER');
    clearAuthSession();
    expect(listener).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_STORAGE_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    setAuthSession('t2', 'member01', 'MEMBER');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('updates the stored role when the server reports a different role for the current token', async () => {
    setAuthSession('jwt', 'user01', 'MEMBER');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { username: 'user01', role: 'CENTER_MANAGER' } }) }));
    await syncSessionWithServer();
    expect(getCurrentUser()).toMatchObject({ identifier: 'user01', role: 'MANAGER' });
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt');
  });

  it('does not touch the session when the role is unchanged or the server is unreachable', async () => {
    setAuthSession('jwt', 'user01', 'COACH');
    const listener = vi.fn();
    const unsubscribe = subscribeAuthSession(listener);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { username: 'user01', role: 'COACH' } }) }));
    await syncSessionWithServer();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await syncSessionWithServer();
    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
    expect(getCurrentUser()?.role).toBe('COACH');
  });

  it('ends the session when the server rejects the current token', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    setAuthSession('revoked', 'user01', 'MEMBER');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) }));
    await syncSessionWithServer();
    expect(getCurrentUser()).toBeNull();
    expect(assign).toHaveBeenCalledWith(expect.stringContaining('/login?expired=1'));
  });

  // P1-FE-06: Distinguish TimeoutError vs caller AbortError and never silently return null on JSON/timeout error after HTTP 200
  it('classifies caller TimeoutError as ApiError TIMEOUT and rethrows caller AbortError untouched', async () => {
    const timeoutErr = new DOMException('Timed out', 'TimeoutError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutErr));
    const timeoutController = new AbortController();
    await expect(apiFetch('/ai/chat/sessions', { signal: timeoutController.signal }))
      .rejects.toMatchObject({ status: 0, code: 'TIMEOUT' });

    const abortErr = new DOMException('Caller aborted', 'AbortError');
    const abortController = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));
    abortController.abort();
    await expect(apiFetch('/ai/chat/sessions', { signal: abortController.signal }))
      .rejects.toBe(abortErr);
  });

  it('rejects with INVALID_RESPONSE on corrupt JSON after HTTP 200 and throws TIMEOUT/AbortError if reading body fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{truncated', { status: 200 })));
    await expect(apiFetch('/classes')).rejects.toMatchObject({ status: 200, code: 'INVALID_RESPONSE' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => { throw new DOMException('Body timed out', 'TimeoutError'); },
    }));
    await expect(apiFetch('/classes')).rejects.toMatchObject({ status: 0, code: 'TIMEOUT' });

    const abortErr = new DOMException('Body aborted', 'AbortError');
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => { controller.abort(); throw abortErr; },
    }));
    await expect(apiFetch('/classes', { signal: controller.signal })).rejects.toBe(abortErr);
  });

  it('returns null only for 204, Content-Length: 0, or genuinely empty non-aborted responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, headers: new Headers() }));
    await expect(apiFetch('/classes/1', { method: 'DELETE' })).resolves.toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200, headers: { 'Content-Length': '0' } })));
    await expect(apiFetch('/classes/1', { method: 'DELETE' })).resolves.toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 200 })));
    await expect(apiFetch('/classes/1', { method: 'DELETE' })).resolves.toBeNull();
  });

  // P1-FE-07: Concurrent 401s, logout race, and anonymous / cleared-Authorization 401s
  it('redirects once for concurrent 401s on the same token without misclassifying siblings as SESSION_REPLACED', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    setAuthSession('shared-token', 'member01', 'MEMBER');
    const resolvers: Array<(value: unknown) => void> = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolvers.push(resolve); })));

    const req1 = apiFetch('/a');
    const req2 = apiFetch('/b');
    const req3 = apiFetch('/c');

    for (const resolve of resolvers) {
      resolve({ ok: false, status: 401, json: async () => ({ message: 'Token expired' }) });
    }

    const results = await Promise.allSettled([req1, req2, req3]);
    for (const r of results) {
      expect(r.status).toBe('rejected');
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(ApiError);
        expect(r.reason.status).toBe(401);
        expect(r.reason.code).not.toBe('SESSION_REPLACED');
      }
    }
    expect(assign).toHaveBeenCalledTimes(1);
    expect(getCurrentUser()).toBeNull();
  });

  it('does not throw SESSION_REPLACED or redirect when a late 401 returns after manual logout', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    setAuthSession('logout-token', 'member01', 'MEMBER');
    let respond!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { respond = resolve; })));

    const pending = apiFetch('/memberships/subscriptions/my');
    clearAuthSession();
    respond({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) });

    const err: unknown = await pending.catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    if (err instanceof ApiError) {
      expect(err.status).toBe(401);
      expect(err.code).not.toBe('SESSION_REPLACED');
    }
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not clear active session or redirect on 401 for anonymous requests or explicit Authorization: ""', async () => {
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
    setAuthSession('active-token', 'member01', 'MEMBER');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Denied' }) }));

    await expect(apiFetch('/public/secret', { headers: { Authorization: '' } })).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('active-token');
    expect(getCurrentUser()?.identifier).toBe('member01');
    expect(assign).not.toHaveBeenCalled();

    clearAuthSession();
    await expect(apiFetch('/public/secret')).rejects.toMatchObject({ status: 401 });
    expect(assign).not.toHaveBeenCalled();
  });

  // P2-FE-14: Header merging with new Headers, conditional Content-Type, deleting empty Authorization
  it('merges Headers instances and tuple arrays, omits Content-Type on bodyless/FormData/Blob/URLSearchParams, and strips empty Authorization', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'tok-1');
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: true }) });
    vi.stubGlobal('fetch', mockFetch);

    // Bodyless DELETE with tuple headers and empty Authorization
    await apiFetch('/items/1', { method: 'DELETE', headers: [['X-Trace', 't-1'], ['Authorization', '']] });
    const h0 = new Headers(mockFetch.mock.calls[0][1].headers);
    expect(h0.get('Accept-Language')).toBe('vi');
    expect(h0.get('X-Trace')).toBe('t-1');
    expect(h0.get('Authorization')).toBeNull();
    expect(h0.get('Content-Type')).toBeNull();

    // Headers instance + JSON body
    await apiFetch('/items', { method: 'POST', body: JSON.stringify({ ok: 1 }), headers: new Headers({ 'X-Custom': 'yes' }) });
    const h1 = new Headers(mockFetch.mock.calls[1][1].headers);
    expect(h1.get('Content-Type')).toBe('application/json');
    expect(h1.get('Accept-Language')).toBe('vi');
    expect(h1.get('Authorization')).toBe('Bearer tok-1');
    expect(h1.get('X-Custom')).toBe('yes');

    // URLSearchParams & Blob must not get Content-Type: application/json
    await apiFetch('/form', { method: 'POST', body: new URLSearchParams({ a: '1' }) });
    expect(mockFetch.mock.calls[2][1].headers['Content-Type']).toBeUndefined();

    await apiFetch('/blob', { method: 'POST', body: new Blob(['abc'], { type: 'text/plain' }) });
    expect(mockFetch.mock.calls[3][1].headers['Content-Type']).toBeUndefined();
  });

  // P2-FE-15: apiFetchPdf & apiFetchBlob timeout, AbortSignal, and mid-stream blob error handling
  it('handles timeout, caller abort, and mid-stream blob failures in apiFetchPdf and apiFetchBlob', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })));
      const pendingPdf = apiFetchPdf('/invoices/1/download');
      const assertion = expect(pendingPdf).rejects.toMatchObject({ status: 0, code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }

    const abortController = new AbortController();
    const abortErr = new DOMException('Cancelled', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));
    abortController.abort();
    await expect(apiFetchBlob('/docs/1', { signal: abortController.signal })).rejects.toBe(abortErr);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/pdf' }),
      blob: async () => { throw new TypeError('connection reset'); },
    }));
    await expect(apiFetchPdf('/invoices/1/download')).rejects.toMatchObject({ status: 0 });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'image/png' }),
      blob: async () => { throw new DOMException('Timed out mid-stream', 'TimeoutError'); },
    }));
    await expect(apiFetchBlob('/docs/1')).rejects.toMatchObject({ status: 0, code: 'TIMEOUT' });
  });

  // P2-FE-16: Orphaned session cleanup, parseAuthSession validation, safe localStorage try/catch
  it('clears orphaned AUTH_STORAGE_KEY when TOKEN_STORAGE_KEY is missing in syncSessionWithServer', async () => {
    setCurrentUser({ id: 'orphan', name: 'Orphan', identifier: 'orphan', role: 'MEMBER' });
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    await syncSessionWithServer();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(getCurrentUser()).toBeNull();
  });

  it('rejects malformed or invalid-shape payloads in parseAuthSession', () => {
    expect(parseAuthSession(null)).toBeNull();
    expect(parseAuthSession('not-json')).toBeNull();
    expect(parseAuthSession('null')).toBeNull();
    expect(parseAuthSession('[]')).toBeNull();
    expect(parseAuthSession('"hello"')).toBeNull();
    expect(parseAuthSession(JSON.stringify({ id: 123, role: 'MEMBER' }))).toBeNull();
    expect(parseAuthSession(JSON.stringify({ id: '   ', role: 'MEMBER' }))).toBeNull();
    expect(parseAuthSession(JSON.stringify({ id: 'u1', role: 'SUPER_HACKER' }))).toBeNull();
    expect(parseAuthSession(JSON.stringify({ id: 'u1', role: 'RECEPTIONIST' }))).toEqual({
      id: 'u1',
      name: 'u1',
      identifier: 'u1',
      role: 'STAFF',
    });
  });

  it('survives localStorage SecurityError on reads, writes, and clears', async () => {
    const secErr = new DOMException('Blocked', 'SecurityError');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw secErr; });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw secErr; });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw secErr; });

    expect(readRawAuthSession()).toBeNull();
    expect(() => setCurrentUser({ id: 'u1', name: 'U1', identifier: 'u1', role: 'MEMBER' })).not.toThrow();
    expect(() => clearAuthSession()).not.toThrow();
    await expect(syncSessionWithServer()).resolves.toBeUndefined();
  });

  // P2-FE-23: clearAuthSession clears persisted purchase intent
  it('clears persisted purchase intent on clearAuthSession', () => {
    rememberPurchaseIntent('?returnTo=' + encodeURIComponent('/member/packages?packageId=5'));
    clearAuthSession();
    expect(authDestination('MEMBER', '')).toBe('/member/dashboard');
  });

  // P3-FE-08: Single module-level storage listener shared across subscribers
  it('attaches only one window storage listener regardless of subscriber count and detaches when empty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const u1 = subscribeAuthSession(() => {});
    const u2 = subscribeAuthSession(() => {});
    const u3 = subscribeAuthSession(() => {});

    const storageAdds = addSpy.mock.calls.filter(([type]) => type === 'storage');
    expect(storageAdds).toHaveLength(1);

    u1();
    u2();
    expect(removeSpy.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(0);
    u3();
    expect(removeSpy.mock.calls.filter(([type]) => type === 'storage')).toHaveLength(1);
  });

  // P3-FE-12: Preserve body.details on ApiError
  it('preserves backend details field on ApiError', async () => {
    const details = { field: 'slot', conflictId: 42 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ success: false, code: 'SCHEDULING_CONFLICT', message: 'Conflict', details }),
    }));
    await expect(apiFetch('/classes/recurring', { method: 'POST', body: '{}' }))
      .rejects.toMatchObject({ status: 409, code: 'SCHEDULING_CONFLICT', details });
  });
});
