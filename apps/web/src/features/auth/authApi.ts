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

export interface GoogleOAuthCallbackInput {
  idToken?: string;
  accessToken?: string;
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

export const googleOAuthCallback = (input: GoogleOAuthCallbackInput) =>
  apiFetch<GoogleSendOtpResponse>('/auth/google/oauth-callback', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getGoogleOAuthAuthorizeUrl = () => {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
  return `${baseUrl}/auth/google/authorize`;
};

export const googleLoginWithIdToken = (idToken: string) =>
  apiFetch<GoogleVerifyResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
