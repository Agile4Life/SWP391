import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getProfile,
  updateProfile,
  type Profile,
} from './profileApi';

describe('profileApi.ts (Profile)', () => {
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

});
