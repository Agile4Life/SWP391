import { beforeEach, describe, expect, it, vi } from 'vitest';
import { googleSendOtp, googleVerifyOtp, register, sendOtp, verifyOtp } from './authApi';

describe('authApi.ts (Register and OTP flow)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('register calls /auth/register with user credentials', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        message: 'Tài khoản đã tạo thành công',
        data: { userId: 1, email: 'member@test.com' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const input = {
      username: 'newmember',
      email: 'member@test.com',
      password: 'Password@123',
    };

    const res = await register(input);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
    expect(res).toEqual({ userId: 1, email: 'member@test.com' });
  });

  it('register calls /auth/register with optional phone', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        message: 'Tài khoản đã tạo thành công',
        data: { userId: 2, email: 'phone@test.com' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const input = {
      username: 'phonemember',
      email: 'phone@test.com',
      password: 'Password@123',
      phone: '0912345678',
    };

    const res = await register(input);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
    expect(res).toEqual({ userId: 2, email: 'phone@test.com' });
  });

  it('sendOtp calls /auth/send-otp with email target', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { destination: 'member@test.com', expiresInMinutes: 5, debugOtp: '123456' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await sendOtp('member@test.com');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/auth/send-otp',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'member@test.com' }),
      }),
    );
    expect(res.debugOtp).toBe('123456');
  });

  it('verifyOtp calls /auth/verify-otp with target and OTP code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { target: 'member@test.com', isVerified: true },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await verifyOtp('member@test.com', '123456');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/auth/verify-otp',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ target: 'member@test.com', otpCode: '123456' }),
      }),
    );
    expect(res).toEqual({ target: 'member@test.com', isVerified: true });
  });

  it('googleSendOtp and googleVerifyOtp call Google OTP endpoints', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { email: 'user@gmail.com', message: 'Sent', expiresInMinutes: 5, debugOtp: '654321' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { token: 'jwt-google', username: 'user', role: 'MEMBER' },
        }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const sendRes = await googleSendOtp('user@gmail.com');
    expect(sendRes.debugOtp).toBe('654321');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/auth/google/send-otp',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@gmail.com' }),
      }),
    );

    const verifyRes = await googleVerifyOtp('user@gmail.com', '654321');
    expect(verifyRes).toEqual({ token: 'jwt-google', username: 'user', role: 'MEMBER' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/auth/google/verify-otp',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@gmail.com', otpCode: '654321' }),
      }),
    );
  });
});
