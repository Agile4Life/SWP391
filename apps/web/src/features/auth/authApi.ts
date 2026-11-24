import { sourceError } from '../../shared/i18n/sourceText';
import { apiFetch } from '../../shared/api/client';

/** Dữ liệu đăng ký: tên đăng nhập, họ tên thật, email, mật khẩu và số điện thoại (tùy chọn). */
export interface RegisterInput {
  username: string;
  /** Họ và tên thật: hiển thị ở quầy check-in, lớp học, tin nhắn (không dùng tên đăng nhập/email). */
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

/** Kết quả gửi OTP khi đăng nhập Google: email, thông báo, thời hạn mã (phút) và mã OTP khi chạy dev. */
export interface GoogleSendOtpResponse {
  email: string;
  message: string;
  expiresInMinutes: number;
  debugOtp?: string;
}

/** Kết quả đăng nhập thành công bằng Google: JWT, tên đăng nhập, vai trò và họ tên. */
export interface GoogleVerifyResponse {
  token: string;
  username: string;
  role: string;
  fullName?: string | null;
}

/** Kết quả OAuth Google: hoặc yêu cầu nhập OTP, hoặc đăng nhập luôn kèm thông tin xác thực. */
export type GoogleOAuthResponse =
  | ({ requiresOtp: true } & GoogleSendOtpResponse)
  | { requiresOtp: false; email: string; authentication: GoogleVerifyResponse };

/** Dữ liệu callback OAuth Google: idToken hoặc accessToken. */
export interface GoogleOAuthCallbackInput {
  idToken?: string;
  accessToken?: string;
}

/** Đăng ký tài khoản mới. */
export const register = (input: RegisterInput) =>
  apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(input) });

/** Gửi mã OTP xác thực tài khoản tới email. */
export const sendOtp = (email: string) =>
  apiFetch<{ debugOtp?: string }>('/auth/send-otp', { method: 'POST', body: JSON.stringify({ email }) });

/** Xác thực mã OTP của một tài khoản. */
export const verifyOtp = (target: string, otpCode: string) =>
  apiFetch('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ target, otpCode }) });

/** Gửi mã OTP đặt lại mật khẩu tới email. */
export const sendPasswordResetOtp = (email: string) =>
  apiFetch<{ email: string; expiresInMinutes: number; debugOtp?: string }>('/auth/password/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

/** Đặt lại mật khẩu bằng email, mã OTP và mật khẩu mới. */
export const resetPasswordWithOtp = (email: string, otpCode: string, newPassword: string) =>
  apiFetch<{ email: string }>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ email, otpCode, newPassword }),
  });

/** Gửi mã OTP đăng nhập Google tới email. */
export const googleSendOtp = (email: string) =>
  apiFetch<GoogleSendOtpResponse>('/auth/google/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

/** Xác thực mã OTP đăng nhập Google. */
export const googleVerifyOtp = (email: string, otpCode: string) =>
  apiFetch<GoogleVerifyResponse>('/auth/google/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otpCode }),
  });

/** Gửi kết quả OAuth Google (idToken hoặc accessToken) lên backend. */
export const googleOAuthCallback = (input: GoogleOAuthCallbackInput) =>
  apiFetch<GoogleOAuthResponse>('/auth/google/oauth-callback', {
    method: 'POST',
    body: JSON.stringify(input),
  });

const GOOGLE_VERIFIER_KEY = 'scms_google_redirect_verifier';
/** Mã hóa byte sang chuỗi base64url (không đệm) dùng cho PKCE. */
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Tạo cặp PKCE (verifier lưu sessionStorage, challenge SHA-256) và trả về URL bắt đầu OAuth Google của backend. */
export const getGoogleOAuthAuthorizeUrl = async () => {
  const verifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(GOOGLE_VERIFIER_KEY, verifier);
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
  return `${baseUrl}/auth/google/authorize?code_challenge=${encodeURIComponent(challenge)}`;
};

/** Đăng nhập Google bằng idToken. */
export const googleLoginWithIdToken = (idToken: string) =>
  apiFetch<GoogleVerifyResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });


/** Đổi mã handoff cùng verifier PKCE đã lưu lấy phiên đăng nhập; thiếu verifier thì báo phiên không hợp lệ. */
export const googleRedeemHandoff = (code: string) => {
  const verifier = sessionStorage.getItem(GOOGLE_VERIFIER_KEY);
  sessionStorage.removeItem(GOOGLE_VERIFIER_KEY);
  if (!verifier) throw sourceError(null, 'Phiên đăng nhập Google không hợp lệ. Vui lòng đăng nhập lại.');
  return apiFetch<GoogleVerifyResponse>('/auth/google/handoff', {
    method: 'POST',
    body: JSON.stringify({ code, verifier }),
  });
};
