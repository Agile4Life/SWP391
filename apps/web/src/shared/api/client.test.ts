import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiFetch,
  clearAuthSession,
  getCurrentUser,
  homePath,
  loginApi,
  setAuthSession,
  setCurrentUser,
  AUTH_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from './client';

describe('client.ts (API client & Auth session)', () => {
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
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'vi',
        Authorization: 'Bearer bearer-token-123',
      },
    });
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
    expect(homePath('MANAGER')).toBe('/manager/users');
    expect(homePath('STAFF')).toBe('/staff/reception');
    expect(homePath('COACH')).toBe('/staff/attendance');
    expect(homePath('MEMBER')).toBe('/member/dashboard');
  });

  it('setAuthSession stores session and rejects unsupported roles', () => {
    const user = setAuthSession('jwt-1', 'member1', 'MEMBER');
    expect(user.role).toBe('MEMBER');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jwt-1');
    expect(() => setAuthSession('jwt-2', 'x', 'UNKNOWN_ROLE')).toThrow(
      'Vai trò tài khoản chưa được hỗ trợ trên portal.',
    );
  });
});
