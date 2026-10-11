import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classesApi } from './classesApi';
import { ApiError } from '../../shared/api/client';

describe('classesApi.ts (Classes & Scheduling API Client)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getClasses fetches classes from /api/v1/classes', async () => {
    const mockClasses = [
      {
        id: 1,
        name: 'Reformer Pilates',
        disciplineId: 10,
        coachId: 2,
        roomId: 5,
        capacity: 12,
        status: 'ACTIVE' as const,
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockClasses }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await classesApi.getClasses();
    expect(result).toEqual(mockClasses);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/classes',
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(mockFetch.mock.calls[0][1].method ?? 'GET').toBe('GET');
  });

  it('getSessions fetches all sessions or filtered by classId', async () => {
    const mockSessions = [
      {
        id: 101,
        classId: 1,
        sessionDate: '2026-10-10',
        startTime: '08:00',
        endTime: '09:30',
        status: 'scheduled' as const,
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockSessions }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const resultWithoutId = await classesApi.getSessions();
    expect(resultWithoutId).toEqual(mockSessions);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/classes/sessions',
      expect.anything()
    );

    const resultWithId = await classesApi.getSessions(1);
    expect(resultWithId).toEqual(mockSessions);
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/classes/sessions?classId=1',
      expect.anything()
    );
  });

  it('createClass posts class and schedule details to /api/v1/classes', async () => {
    const payload = {
      name: 'Olympic Barbell',
      disciplineId: 3,
      coachId: 4,
      roomId: 2,
      capacity: 16,
      sessionDate: '2026-10-15',
      startTime: '09:00',
      endTime: '10:30',
    };

    const mockCreated = { id: 99, ...payload, status: 'ACTIVE' as const };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: mockCreated }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await classesApi.createClass(payload);
    expect(result.id).toBe(99);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/classes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
  });

  it('BR-02: getAvailableRooms filters out maintenance and closed rooms', async () => {
    const rawRooms = [
      { id: 1, name: 'Studio A', location: 'Floor 1', capacity: 20, status: 'available' },
      { id: 2, name: 'Studio B', location: 'Floor 2', capacity: 15, status: 'maintenance' },
      { id: 3, name: 'Studio C', location: 'Floor 3', capacity: 10, status: 'closed' },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: rawRooms }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const rooms = await classesApi.getAvailableRooms();
    expect(rooms).toHaveLength(1);
    expect(rooms[0].id).toBe(1);
    expect(rooms[0].status).toBe('available');
  });

  it('BR-02: getActiveCoaches only returns users with COACH role and active status', async () => {
    const rawUsers = [
      { id: 1, roleCode: 'COACH', fullName: 'Coach Thinh', email: 'thinh@fit.com', phone: '0911', status: 'active' },
      { id: 2, roleCode: 'COACH', fullName: 'Coach Khoa', email: 'khoa@fit.com', phone: '0922', status: 'inactive' },
      { id: 3, roleCode: 'MEMBER', fullName: 'Member An', email: 'an@fit.com', phone: '0933', status: 'active' },
      { id: 4, roleCode: 'CENTER_MANAGER', fullName: 'Manager Phong', email: 'phong@fit.com', phone: '0944', status: 'active' },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: rawUsers }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const coaches = await classesApi.getActiveCoaches();
    expect(coaches).toHaveLength(1);
    expect(coaches[0].fullName).toBe('Coach Thinh');
    expect(coaches[0].status).toBe('active');
  });

  it('BR-04: throws ApiError with session conflict code when P3 conflict happens', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        status: 409,
        code: 'error.scheduling.session_conflict',
        message: 'Trùng lịch: Huấn luyện viên hoặc phòng học đã có lịch trong khung giờ này.',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      classesApi.createClass({
        name: 'Conflict Class',
        disciplineId: 1,
        coachId: 2,
        roomId: 3,
        capacity: 10,
        sessionDate: '2026-10-15',
        startTime: '08:00',
        endTime: '09:00',
      })
    ).rejects.toThrow(ApiError);

    try {
      await classesApi.createClass({
        name: 'Conflict Class',
        disciplineId: 1,
        coachId: 2,
        roomId: 3,
        capacity: 10,
        sessionDate: '2026-10-15',
        startTime: '08:00',
        endTime: '09:00',
      });
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe('error.scheduling.session_conflict');
      expect(apiErr.message).toContain('Trùng lịch');
    }
  });
});
