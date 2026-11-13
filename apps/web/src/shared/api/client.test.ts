import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiFetch,
  API_TIMEOUT_MS,
  clearAuthSession,
  getCurrentUser,
  homePath,
  loginApi,
  setAuthSession,
  setCurrentUser,
  subscribeAuthSession,
  syncSessionWithServer,
  AUTH_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from './client';

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
      json: async () => ({ success: true, message: 'OK', data: fakeResponseData }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await apiFetch<typeof fakeResponseData>('/disciplines');

    expect(result).toEqual(fakeResponseData);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/disciplines', {
      signal: expect.any(AbortSignal),
      headers: {
        'Content-Type': 'application/json',
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
      json: async () => ({ success: false, message: 'Dữ liệu không hợp lệ' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(apiFetch('/users')).rejects.toThrow('Dữ liệu không hợp lệ');
  });

  it.each([{}, { data: null }])('unwraps an empty successful envelope as null (%j)', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
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
    expect(homePath('COACH')).toBe('/staff/attendance');
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
});
