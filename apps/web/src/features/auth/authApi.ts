import { apiFetch } from '../../shared/api/client';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  phone?: string;
}

export interface GoogleSendOtpResponse {
  email: string;
  message: string;
  expiresInMinutes: number;
  debugOtp?: string;
}

export interface GoogleVerifyResponse {
  token: string;
  username: string;
  role: string;
}

export const register = (input: RegisterInput) =>
  apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(input) });

export const sendOtp = (email: string) =>
  apiFetch<{ debugOtp?: string }>('/auth/send-otp', { method: 'POST', body: JSON.stringify({ email }) });

export const verifyOtp = (target: string, otpCode: string) =>
  apiFetch('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ target, otpCode }) });

export const googleSendOtp = (email: string) =>
  apiFetch<GoogleSendOtpResponse>('/auth/google/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const googleVerifyOtp = (email: string, otpCode: string) =>
  apiFetch<GoogleVerifyResponse>('/auth/google/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otpCode }),
  });

export const googleLoginWithIdToken = (idToken: string) =>
  apiFetch<GoogleVerifyResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });

