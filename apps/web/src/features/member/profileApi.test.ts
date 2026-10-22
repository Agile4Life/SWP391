import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addHealthMetric,
  deleteHealthMetric,
  getProfile,
  listHealthMetrics,
  updateHealthMetric,
  updateProfile,
  type Profile,
} from './profileApi';

describe('profileApi.ts (Profile & Health Metrics)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getProfile fetches user profile from /profile', async () => {
    const mockProfile: Profile = {
      userId: 101,
      fullName: 'Tran Van B',
      email: 'b@test.com',
      phone: '0987654321',
      dob: '1995-05-15',
      gender: null,
      avatarUrl: null,
      address: null,
      membershipCode: null,
      emergencyContactName: 'Nguyen Thi C',
      emergencyContactPhone: '0987111222',
      healthNotes: 'Khong co tien su benh',
      fitnessGoal: 'Tang co giam mo',
      fitnessLevel: null,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockProfile }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const profile = await getProfile();

    expect(profile.fullName).toBe('Tran Van B');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/profile', expect.anything());
  });

  it('updateProfile sends PUT to /profile with updated fields', async () => {
    const updatedData: Profile = {
      userId: 101,
      fullName: 'Tran Van B (Updated)',
      email: 'b@test.com',
      phone: '0987654321',
      dob: '1995-05-15',
      gender: null,
      avatarUrl: null,
      address: null,
      membershipCode: null,
      emergencyContactName: 'Nguyen Thi C',
      emergencyContactPhone: '0987111222',
      healthNotes: null,
      fitnessGoal: 'Chay bo 10km',
      fitnessLevel: null,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: updatedData }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await updateProfile(updatedData);

    expect(res.fullName).toBe('Tran Van B (Updated)');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/profile',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(updatedData),
      }),
    );
  });

  it('listHealthMetrics and addHealthMetric call members health metrics endpoint', async () => {
    const mockMetric = {
      id: 1,
      metricName: 'weight',
      metricValue: 70.5,
      unit: 'kg',
      recordedAt: '2026-09-25T14:30:00',
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [mockMetric] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockMetric }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const list = await listHealthMetrics(101);
    expect(list).toEqual([mockMetric]);
    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/v1/members/101/health-metrics', expect.anything());

    await addHealthMetric(101, { metricName: 'weight', metricValue: 70.5, unit: 'kg' });
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/members/101/health-metrics',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ metricName: 'weight', metricValue: 70.5, unit: 'kg' }),
      }),
    );
  });

  it('updateHealthMetric and deleteHealthMetric send PUT and DELETE requests', async () => {
    const mockMetric = {
      id: 5,
      metricName: 'height',
      metricValue: 175,
      unit: 'cm',
      recordedAt: '2026-10-01T10:00:00',
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: mockMetric }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: null }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const updated = await updateHealthMetric(101, 5, { metricName: 'height', metricValue: 175, unit: 'cm' });
    expect(updated).toEqual(mockMetric);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/v1/members/101/health-metrics/5',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ metricName: 'height', metricValue: 175, unit: 'cm' }),
      }),
    );

    await deleteHealthMetric(101, 5);
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/v1/members/101/health-metrics/5',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });
});
