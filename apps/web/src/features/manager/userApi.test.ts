import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userApi } from './userApi';

describe('userApi.ts (User Management & RBAC)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getUsers maps raw UserDto to UserAccount properly', async () => {
    const rawUsers = [
      {
        id: 1,
        roleCode: 'CENTER_MANAGER',
        fullName: 'Admin User',
        email: 'admin@test.com',
        phone: '0901234567',
        status: 'active',
        createdAt: '2026-09-20T10:00:00',
      },
      {
        id: 2,
        roleCode: 'MEMBER',
        fullName: 'Locked Member',
        email: 'member@test.com',
        phone: null,
        status: 'locked',
        createdAt: '2026-09-21T11:00:00',
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: true, data: rawUsers }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const users = await userApi.getUsers();

    expect(users).toHaveLength(2);
    expect(users[0]).toEqual({
      id: '1',
      name: 'Admin User',
      email: 'admin@test.com',
      phone: '0901234567',
      role: 'CENTER_MANAGER',
      gender: 'other',
      status: 'ACTIVE',
      deleted_at: null,
      created_at: '2026-09-20',
      last_login_at: null,
      is_frozen: false,
    });
    expect(users[1].status).toBe('LOCKED');
    expect(users[1].phone).toBe('');
  });

  it('createUser looks up role ID and posts new user payload', async () => {
    const rolesList = [
      { id: 1, code: 'CENTER_MANAGER' },
      { id: 2, code: 'COACH' },
    ];
    // Dữ liệu mẫu dùng trong các ca kiểm thử.
    const createdUser = {
      id: 3,
      roleCode: 'COACH',
      fullName: 'Coach Nam',
      email: 'nam@fitcenter.vn',
      phone: '0912345678',
      status: 'active',
      createdAt: '2026-09-22T08:00:00',
    };

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/roles')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          // Giả lập phần thân JSON của phản hồi API.
          json: async () => ({ success: true, data: rolesList }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        // Giả lập phần thân JSON của phản hồi API.
        json: async () => ({ success: true, data: createdUser }),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await userApi.createUser({
      name: 'Coach Nam',
      email: 'nam@fitcenter.vn',
      phone: '0912345678',
      password: 'Password@123',
      role: 'COACH',
    });

    expect(result.id).toBe('3');
    expect(result.role).toBe('COACH');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Coach Nam',
          email: 'nam@fitcenter.vn',
          phone: '0912345678',
          password: 'Password@123',
          roleId: 2,
        }),
      }),
    );
  });

  it('updateUser sends PUT to /users/:id with updated fields', async () => {
    const rolesList = [
      { id: 1, code: 'CENTER_MANAGER' },
      { id: 2, code: 'COACH' },
    ];
    // Dữ liệu mẫu dùng trong các ca kiểm thử.
    const updatedUser = {
      id: 1,
      roleCode: 'CENTER_MANAGER',
      fullName: 'Admin Updated',
      email: 'admin@test.com',
      phone: '0987654321',
      status: 'active',
      createdAt: '2026-09-20T10:00:00',
    };

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/roles')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          // Giả lập phần thân JSON của phản hồi API.
          json: async () => ({ success: true, data: rolesList }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        // Giả lập phần thân JSON của phản hồi API.
        json: async () => ({ success: true, data: updatedUser }),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await userApi.updateUser('1', {
      name: 'Admin Updated',
      phone: '0987654321',
      role: 'CENTER_MANAGER',
    });

    expect(result.id).toBe('1');
    expect(result.name).toBe('Admin Updated');
    expect(result.phone).toBe('0987654321');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/users/1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          fullName: 'Admin Updated',
          phone: '0987654321',
          roleId: 1,
        }),
      }),
    );
  });

  it('toggleLockUser checks current status and invokes lock/unlock accordingly', async () => {
    const mockFetch = vi
      .fn()
      // Lần gọi 1: GET /users/5
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        // Giả lập phần thân JSON của phản hồi API.
        json: async () => ({
          success: true,
          data: { id: 5, roleCode: 'MEMBER', fullName: 'John', email: 'j@t.com', phone: null, status: 'active', createdAt: '2026-09-20' },
        }),
      })
      // Lần gọi 2: PATCH /users/5/lock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        // Giả lập phần thân JSON của phản hồi API.
        json: async () => ({
          success: true,
          data: { id: 5, roleCode: 'MEMBER', fullName: 'John', email: 'j@t.com', phone: null, status: 'locked', createdAt: '2026-09-20' },
        }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const updated = await userApi.toggleLockUser('5');

    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/v1/users/5', expect.anything());
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/users/5/lock',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(updated.status).toBe('LOCKED');
  });

  it('toggleRolePermission toggles permission via PUT or DELETE', async () => {
    const rolesList = [{ id: 1, code: 'COACH' }];
    const permissionsForRole = [{ id: 101, code: 'CLASS_VIEW', name: 'Xem lớp', module: 'CLASS' }];

    const mockFetch = vi
      .fn()
      // Lần gọi 1: GET /roles (từ roleIds)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        // Giả lập phần thân JSON của phản hồi API.
        json: async () => ({ success: true, data: rolesList }),
      })
      // Lần gọi 2: GET /roles/1/permissions
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        // Giả lập phần thân JSON của phản hồi API.
        json: async () => ({ success: true, data: permissionsForRole }),
      })
      // Lần gọi 3: DELETE /roles/1/permissions/101 (do quyền đã được cấp sẵn)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        // Giả lập phần thân JSON của phản hồi API.
        json: async () => ({ success: true, data: null }),
      });
    vi.stubGlobal('fetch', mockFetch);

    await userApi.toggleRolePermission('COACH', '101');

    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      '/api/v1/roles/1/permissions/101',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('P1-FE-22: toggleLockUser and toggleRolePermission use explicit target state directly without racy GET', async () => {
    const lockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { id: 5, roleCode: 'MEMBER', fullName: 'John', email: 'j@t.com', phone: null, status: 'locked', createdAt: '2026-09-20' },
      }),
    });
    vi.stubGlobal('fetch', lockFetch);

    const locked = await userApi.toggleLockUser('5', true);
    expect(lockFetch).toHaveBeenCalledTimes(1);
    expect(lockFetch).toHaveBeenCalledWith('/api/v1/users/5/lock', expect.objectContaining({ method: 'PATCH' }));
    expect(locked.status).toBe('LOCKED');

    const permFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: [{ id: 2, code: 'COACH' }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: null }) });
    vi.stubGlobal('fetch', permFetch);

    await userApi.toggleRolePermission('COACH', '101', true);
    expect(permFetch).toHaveBeenCalledTimes(2);
    expect(permFetch).toHaveBeenNthCalledWith(2, '/api/v1/roles/2/permissions/101', expect.objectContaining({ method: 'PUT' }));
  });

  it('deleteUser calls DELETE /api/v1/users/{id}', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: true, data: null }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await userApi.deleteUser('12');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/users/12',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('cleanupInactiveUsers propagates server failures instead of reporting zero deletions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: false, message: 'Access denied', code: 'FORBIDDEN' }),
    }));

    await expect(userApi.cleanupInactiveUsers()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('cleanupInactiveUsers propagates a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(userApi.cleanupInactiveUsers()).rejects.toMatchObject({ status: 0 });
  });

  it('cleanupInactiveUsers calls POST /api/v1/users/cleanup-inactive', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({
        success: true,
        data: { deletedCount: 5, cutoffDate: '2026-04-20T10:00:00' },
        message: 'Đã dọn dẹp 5 tài khoản',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await userApi.cleanupInactiveUsers();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/users/cleanup-inactive',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.deletedCount).toBe(5);
  });

  it('getDeletedUsers calls GET /api/v1/users/deleted', async () => {
    const deletedList = [
      {
        id: 99,
        roleCode: 'MEMBER',
        fullName: 'Deleted Member',
        email: 'deleted@test.com',
        phone: null,
        status: 'active',
        createdAt: '2026-01-01T10:00:00',
        deletedAt: '2026-11-10T10:00:00',
      },
    ];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: true, data: deletedList }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await userApi.getDeletedUsers();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/users/deleted',
      expect.anything(),
    );
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Deleted Member');
    expect(result[0].deleted_at).toBe('2026-11-10T10:00:00');
  });

  it('restoreUser calls PATCH /api/v1/users/:id/restore', async () => {
    // Dữ liệu mẫu dùng trong các ca kiểm thử.
    const restoredUser = {
      id: 99,
      roleCode: 'MEMBER',
      fullName: 'Restored Member',
      email: 'deleted@test.com',
      phone: null,
      status: 'active',
      createdAt: '2026-01-01T10:00:00',
      deletedAt: null,
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      // Giả lập phần thân JSON của phản hồi API.
      json: async () => ({ success: true, data: restoredUser }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await userApi.restoreUser('99');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/users/99/restore',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(result.id).toBe('99');
    expect(result.deleted_at).toBeNull();
  });
});

