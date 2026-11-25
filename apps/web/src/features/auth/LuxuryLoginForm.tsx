import { sourceText, useSourceLanguage, sourceFormat, sourceError, sourceToast as toast, sourceFormatPair } from '../../shared/i18n/sourceText';
import type { SourceMessage } from '../../shared/i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearAuthSession, getCurrentUser, loginApi, setAuthSession, ApiError, type UserSession } from '../../shared/api/client';
import { useCurrentUser } from '../../shared/api/useCurrentUser';
import { StatusMark } from '../../shared/ui/StatusMark';
import { authDestination, purchaseAuthPath, rememberPurchaseIntent } from '../../shared/lib/purchaseIntent';
import { loginSchema, isValidEmailAddress, isValidPassword, PASSWORD_RULE_ERROR, PASSWORD_RULE_HINT } from './authValidation';
import { loadGoogleIdentity } from './loadGoogleIdentity';
import {
  getGoogleOAuthAuthorizeUrl,
  googleOAuthCallback,
  googleRedeemHandoff,
  type GoogleVerifyResponse,
  googleSendOtp,
  googleVerifyOtp,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
  type GoogleOAuthCallbackInput,
} from './authApi';

/** Props của biểu mẫu đăng nhập: hàm gọi sau khi đăng nhập thành công (tùy chọn). */
interface LuxuryLoginFormProps {
  onSuccess?: () => void;
}

const ROLE_NAMES: Record<UserSession['role'], string> = {
  get ADMIN() { return sourceText('Quản trị hệ thống'); },
  get MEMBER() { return sourceText('Hội viên'); },
  get STAFF() { return sourceText('Lễ tân / Thu ngân'); },
  get COACH() { return sourceText('Huấn luyện viên'); },
  get MANAGER() { return sourceText('Quản lý trung tâm'); },
};

const GOOGLE_OAUTH_ERROR_FALLBACK: SourceMessage = {
  vi: 'Xác thực Google OAuth thất bại. Vui lòng thử lại.',
  en: 'Google OAuth authentication failed. Please try again.',
};

/** Danh sách mã lỗi Google OAuth được phép ánh xạ từ URL (tuyệt đối không phản chiếu chuỗi tự do từ query string). */
const GOOGLE_OAUTH_ERROR_ALLOWLIST: Readonly<Record<string, SourceMessage>> = {
  access_denied: {
    vi: 'Bạn đã hủy đăng nhập Google.',
    en: 'Google sign-in was cancelled.',
  },
  state_invalid: {
    vi: 'Phiên đăng nhập Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
    en: 'Your Google sign-in session expired or is invalid. Please try again.',
  },
  'auth.google.state_invalid': {
    vi: 'Phiên đăng nhập Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
    en: 'Your Google sign-in session expired or is invalid. Please try again.',
  },
  invalid_token: {
    vi: 'Xác thực Google không hợp lệ. Vui lòng thử lại.',
    en: 'Google authentication failed. Please try again.',
  },
  'auth.google.invalid_token': {
    vi: 'Xác thực Google không hợp lệ. Vui lòng thử lại.',
    en: 'Google authentication failed. Please try again.',
  },
  redirect_invalid: {
    vi: 'Địa chỉ chuyển hướng Google không hợp lệ.',
    en: 'Invalid Google redirect URI.',
  },
  'auth.google.redirect_invalid': {
    vi: 'Địa chỉ chuyển hướng Google không hợp lệ.',
    en: 'Invalid Google redirect URI.',
  },
  handoff_invalid: {
    vi: 'Phiên đăng nhập Google không hợp lệ. Vui lòng đăng nhập lại.',
    en: 'Invalid Google sign-in session. Please sign in again.',
  },
  'auth.google.handoff_invalid': {
    vi: 'Phiên đăng nhập Google không hợp lệ. Vui lòng đăng nhập lại.',
    en: 'Invalid Google sign-in session. Please sign in again.',
  },
  staff_not_allowed: {
    vi: 'Vai trò này chưa hỗ trợ đăng nhập Google.',
    en: 'Google sign-in is not supported for this role.',
  },
  google_staff_not_allowed: {
    vi: 'Vai trò này chưa hỗ trợ đăng nhập Google.',
    en: 'Google sign-in is not supported for this role.',
  },
  'auth.google.staff_not_allowed': {
    vi: 'Vai trò này chưa hỗ trợ đăng nhập Google.',
    en: 'Google sign-in is not supported for this role.',
  },
  account_locked: {
    vi: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
    en: 'Your account has been locked. Please contact an administrator.',
  },
  'auth.account_locked': {
    vi: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
    en: 'Your account has been locked. Please contact an administrator.',
  },
  not_configured: {
    vi: 'Google chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
    en: 'Google sign-in is not configured. Please contact an administrator.',
  },
  google_not_configured: {
    vi: 'Google chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
    en: 'Google sign-in is not configured. Please contact an administrator.',
  },
};

function resolveGoogleOAuthError(params: URLSearchParams): SourceMessage {
  const rawCode = (params.get('error_code') || params.get('error') || '').trim().toLowerCase();
  if (rawCode && Object.hasOwn(GOOGLE_OAUTH_ERROR_ALLOWLIST, rawCode)) {
    return GOOGLE_OAUTH_ERROR_ALLOWLIST[rawCode];
  }
  return GOOGLE_OAUTH_ERROR_FALLBACK;
}

/**
 * Các bước của biểu mẫu: đăng nhập thường, nhập OTP khi vào bằng Google, nhập email quên mật khẩu, đặt lại mật
 * khẩu.
 */
type AuthMode = 'standard' | 'google_otp' | 'forgot_email' | 'forgot_reset';

/**
 * Biểu mẫu đăng nhập: tài khoản/mật khẩu, đăng nhập Google (OAuth, mã OTP khi cần) và quên mật khẩu bằng OTP
 * email.
 */
export function LuxuryLoginForm({ onSuccess }: LuxuryLoginFormProps) {
  useSourceLanguage();
  const navigate = useNavigate();
  const { search } = useLocation();

  const currentUser = useCurrentUser();
  const hasExpiredParam =
    new URLSearchParams(search).get('expired') === '1'
    || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('expired') === '1');
  const [isExpired, setIsExpired] = useState(hasExpiredParam);
  const expiredClearedRef = useRef(false);

  // Khi quay về từ phiên 401 (?expired=1), xóa phiên cũ trước khi lưu purchase intent để không làm mất returnTo.
  useEffect(() => {
    if (!hasExpiredParam) {
      expiredClearedRef.current = false;
      return;
    }
    if (expiredClearedRef.current) return;
    expiredClearedRef.current = true;
    setIsExpired(true);
    if (getCurrentUser()) {
      clearAuthSession();
    }
  }, [hasExpiredParam]);

  useEffect(() => rememberPurchaseIntent(search), [search]);

  const [mode, setMode] = useState<AuthMode>('standard');

  // Biểu mẫu đăng nhập thường
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Biểu mẫu quên mật khẩu
  const [resetEmail, setResetEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

  // Biểu mẫu đăng nhập Google
  const [googleEmail, setGoogleEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState<string | Error | SourceMessage>('');
  const [debugOtpCode, setDebugOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formError, setFormError] = useState<string | Error | SourceMessage>('');
  const [shaking, setShaking] = useState(false);
  const [success, setSuccess] = useState(false);

  // Google Client ID từ biến môi trường
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    if (googleClientId) {
      void loadGoogleIdentity().catch(() => {});
    }
  }, [googleClientId]);

  const countdownActive = countdown > 0;
  // Bộ đếm ngược thời gian gửi lại mã OTP (chỉ khởi tạo interval một lần khi đếm ngược đang chạy).
  useEffect(() => {
    if (!countdownActive) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownActive]);

  const lockCountdownActive = lockCountdown > 0;
  // Bộ đếm ngược thời gian khóa đăng nhập.
  useEffect(() => {
    if (!lockCountdownActive) return;
    const timer = window.setInterval(() => {
      setLockCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockCountdownActive]);

  // Chuyển chế độ an toàn và xóa các dữ liệu nhạy cảm / trạng thái hiển thị mật khẩu trước đó.
  const resetToStandardMode = useCallback((clearGoogle = false) => {
    setFormError('');
    setShowPassword(false);
    setResetNewPassword('');
    setOtpCode('');
    setDebugOtpCode('');
    if (clearGoogle) {
      setGoogleEmail('');
      setOtpMessage('');
    }
    setMode('standard');
  }, []);

  // Hiện lỗi và kích hoạt hiệu ứng rung của biểu mẫu.
  const fail = useCallback((msg: string | Error | SourceMessage) => {
    setFormError(msg);
    setShaking(true);
  }, []);

  // Hoàn tất đăng nhập Google: lưu phiên, báo thành công và chuyển tới trang đích theo vai trò.
  const completeGoogleLogin = useCallback((authentication: GoogleVerifyResponse) => {
    const user = setAuthSession(authentication.token, authentication.username, authentication.role, authentication.fullName);
    setIsExpired(false);
    setSuccess(true);
    if (onSuccess) onSuccess();
    toast('Đăng nhập thành công!', 'success');
    navigate(authDestination(user.role, search), { viewTransition: true });
  }, [navigate, onSuccess, search]);

  // Xử lý kết quả OAuth Google: đăng nhập luôn, hoặc chuyển sang bước nhập OTP gửi tới email; nhân sự và tài khoản bị khóa được báo lỗi riêng.
  const processGoogleOAuthCallback = useCallback(async (payload: GoogleOAuthCallbackInput) => {
    setIsGoogleLoading(true);
    setFormError('');
    try {
      const res = await googleOAuthCallback(payload);
      if (res.requiresOtp === false) {
        completeGoogleLogin(res.authentication);
        return;
      }
      const verifiedEmail = (res.email || '').trim();
      setGoogleEmail(verifiedEmail);
      setOtpMessage(
        (res.message ? new Error(res.message) : null) || sourceFormatPair("Đã gửi mã xác nhận đến gmail {0}. Hãy nhập mã xác nhận để kích hoạt tài khoản.", verifiedEmail)
      );
      if (import.meta.env.DEV && res.debugOtp) {
        setDebugOtpCode(res.debugOtp);
        setOtpCode(res.debugOtp);
      } else {
        setDebugOtpCode('');
        setOtpCode('');
      }
      setShowPassword(false);
      setMode('google_otp');
      setCountdown(30);
      toast(sourceFormatPair("Mã xác nhận đã được gửi đến {0}", verifiedEmail));
    } catch (err: unknown) {
      const msg = sourceError(err, 'Đăng nhập Google thất bại.');
      // BR-04 & BR-05: Chặn nhân sự (403) và tài khoản bị khóa
      const isStaffForbidden =
        (err instanceof ApiError && err.status === 403)
        || msg.message.includes('nhân sự')
        || msg.message.toLowerCase().includes('staff');
      const isAccountLocked =
        (err instanceof ApiError && (err.status === 423 || err.code === 'ACCOUNT_LOCKED'))
        || msg.message.toLowerCase().includes('khóa')
        || msg.message.toLowerCase().includes('locked');
      if (isStaffForbidden) {
        fail('Vai trò này chưa hỗ trợ đăng nhập Google.');
      } else if (isAccountLocked) {
        fail('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
      } else {
        fail(msg);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }, [fail, completeGoogleLogin]);

  // Đổi mã handoff (sau khi Google chuyển hướng về) lấy phiên đăng nhập.
  const redeemGoogleRedirect = useCallback(async (code: string) => {
    setIsGoogleLoading(true);
    setFormError('');
    try {
      completeGoogleLogin(await googleRedeemHandoff(code));
    } catch (error) {
      fail(sourceError(error, 'Đăng nhập Google thất bại.'));
    } finally {
      setIsGoogleLoading(false);
    }
  }, [completeGoogleLogin, fail]);

  // Xử lý khi Google OAuth 2.0 Redirect Callback trả về URL (/login?google_oauth=callback&email=... hoặc /login?code=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('google_oauth');
    const code = params.get('code');

    if (!oauthStatus && !code) return;

    // Xóa các tham số OAuth khỏi URL sau khi xử lý.
    const cleanSearchParams = () => {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete('google_oauth');
      nextParams.delete('email');
      nextParams.delete('message');
      nextParams.delete('debug_otp');
      nextParams.delete('debugOtp');
      nextParams.delete('state');
      nextParams.delete('error');
      nextParams.delete('error_code');
      nextParams.delete('code');
      nextParams.delete('scope');
      nextParams.delete('authuser');
      nextParams.delete('prompt');
      const nextSearch = nextParams.toString();
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      fragment.delete('google_login_code');
      const nextHash = fragment.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash ? `#${nextHash}` : ''}`;
      window.history.replaceState({}, document.title, nextUrl);
    };

    if (oauthStatus === 'authenticated') {
      const handoff = new URLSearchParams(window.location.hash.slice(1)).get('google_login_code');
      cleanSearchParams();
      if (handoff) void redeemGoogleRedirect(handoff);
      else fail('Phiên đăng nhập Google không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    if (oauthStatus === 'callback') {
      const email = (params.get('email') || '').trim();
      cleanSearchParams();
      if (isValidEmailAddress(email)) {
        setGoogleEmail(email);
        setOtpMessage(sourceFormatPair("Đã gửi mã xác nhận đến gmail {0}. Hãy nhập mã xác nhận để kích hoạt tài khoản.", email));
        setDebugOtpCode('');
        setOtpCode('');
        setShowPassword(false);
        setFormError('');
        setMode('google_otp');
        setCountdown(30);
        toast(sourceFormatPair("Mã xác nhận đã được gửi đến {0}", email));
      } else {
        fail(GOOGLE_OAUTH_ERROR_FALLBACK);
      }
      return;
    }

    if (oauthStatus === 'error') {
      const resolvedError = resolveGoogleOAuthError(params);
      cleanSearchParams();
      fail(resolvedError);
      return;
    }

    if (oauthStatus === 'not_configured') {
      cleanSearchParams();
      fail('Google chưa được cấu hình. Vui lòng liên hệ quản trị viên.');
      return;
    }

    if (code) {
      cleanSearchParams();
      fail('Phiên đăng nhập Google không hợp lệ. Vui lòng đăng nhập lại.');
    }
  }, [fail, redeemGoogleRedirect]);

  // Một điểm vào Google duy nhất: mở popup qua token client khi sẵn sàng, không thì chuyển hướng toàn trang có bảo vệ state qua backend.
  const handleGoogleOAuthLogin = async () => {
    setFormError('');
    if (googleClientId && !window.google?.accounts?.oauth2?.initTokenClient) {
      await loadGoogleIdentity().catch(() => {});
    }
    if (googleClientId && window.google?.accounts?.oauth2?.initTokenClient) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'openid email profile',
          prompt: 'select_account',
          // Có access token thì gửi lên backend, lỗi thì báo.
          callback: (response) => {
            if (response?.access_token) {
              void processGoogleOAuthCallback({ accessToken: response.access_token });
            } else if (response?.error) {
              fail(
                response.error === 'access_denied'
                  ? GOOGLE_OAUTH_ERROR_ALLOWLIST.access_denied
                  : { vi: 'Đã hủy hoặc không thể xác thực với Google.', en: 'Cancelled or unable to authenticate with Google.' },
              );
            }
          },
          // Không mở được cửa sổ xác thực hoặc người dùng chủ động đóng popup.
          error_callback: (error) => {
            if (error?.type === 'popup_closed') {
              fail({
                vi: 'Bạn đã đóng cửa sổ đăng nhập Google.',
                en: 'You closed the Google sign-in window.',
              });
              return;
            }
            fail({
              vi: 'Không thể mở cửa sổ xác thực Google OAuth.',
              en: 'Unable to open the Google sign-in window.',
            });
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch {
        // Rơi xuống luồng chuyển hướng toàn trang có bảo vệ state/PKCE của backend.
      }
    }

    if (googleClientId) {
      setIsGoogleLoading(true);
      try {
        window.location.assign(await getGoogleOAuthAuthorizeUrl());
      } catch {
        fail('Không thể khởi tạo đăng nhập Google. Vui lòng thử lại.');
        setIsGoogleLoading(false);
      }
      return;
    }

    fail('Google chưa được cấu hình. Vui lòng liên hệ quản trị viên.');
  };

  // Gửi biểu mẫu đăng nhập thường sau khi kiểm tra tên đăng nhập và mật khẩu.
  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExpired(false);
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      fail(parsed.error.issues[0].message);
      document.getElementById(parsed.error.issues[0].path[0] === 'identifier' ? 'login-identifier' : 'login-password')?.focus();
      return;
    }

    setIsLoading(true);
    setFormError('');

    try {
      const res = await loginApi(parsed.data.identifier, parsed.data.password);
      if (onSuccess) onSuccess();

      setSuccess(true);
      navigate(authDestination(res.user.role, search), { viewTransition: true });
    } catch (err: unknown) {
      const msg = sourceError(err, 'Đăng nhập không thành công.');
      if (err instanceof ApiError && (err.status === 429 || err.code === 'LOGIN_LOCKED')) {
        const match = err.message.match(/(\d+)\s*(?:giây|seconds|s)/i);
        const sec = match ? parseInt(match[1], 10) : 60;
        setLockCountdown(sec > 0 ? sec : 60);
      }
      fail(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Gửi OTP tới Gmail
  const handleGoogleSendOtp = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    const cleanEmail = googleEmail.trim();
    if (!isValidEmailAddress(cleanEmail)) {
      fail('Vui lòng nhập đúng địa chỉ Gmail.');
      return;
    }

    setIsLoading(true);
    setFormError('');

    try {
      const res = await googleSendOtp(cleanEmail);
      setOtpMessage((res.message ? new Error(res.message) : null) || sourceFormatPair("Đã gửi mã xác nhận đến gmail {0}. Hãy nhập mã xác nhận để kích hoạt tài khoản.", cleanEmail));
      if (import.meta.env.DEV && res.debugOtp) {
        setDebugOtpCode(res.debugOtp);
        setOtpCode(res.debugOtp);
      } else {
        setDebugOtpCode('');
        setOtpCode('');
      }
      setShowPassword(false);
      setMode('google_otp');
      setCountdown(30);
      toast(sourceFormatPair("Mã xác nhận đã được gửi đến {0}", cleanEmail));
    } catch (err: unknown) {
      const msg = sourceError(err, 'Không thể gửi mã xác nhận đến email.');
      fail(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Xác thực OTP và Đăng nhập
  const handleGoogleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      fail('Mã xác nhận gồm đúng 6 chữ số.');
      return;
    }

    setIsLoading(true);
    setFormError('');

    try {
      const res = await googleVerifyOtp(googleEmail.trim(), cleanOtp);
      completeGoogleLogin(res);
    } catch (err: unknown) {
      const msg = sourceError(err, 'Mã xác nhận không chính xác hoặc đã hết hạn.');
      fail(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Gửi mã OTP đặt lại mật khẩu tới email sau khi kiểm tra định dạng.
  const handleRequestPasswordResetOtp = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    const cleanEmail = resetEmail.trim();
    if (!isValidEmailAddress(cleanEmail)) {
      fail('Vui lòng nhập đúng địa chỉ email.');
      return;
    }

    setIsLoading(true);
    setFormError('');
    try {
      const res = await sendPasswordResetOtp(cleanEmail);
      if (import.meta.env.DEV && res.debugOtp) {
        setDebugOtpCode(res.debugOtp);
        setOtpCode(res.debugOtp);
      } else {
        setDebugOtpCode('');
        setOtpCode('');
      }
      setShowPassword(false);
      setResetNewPassword('');
      setMode('forgot_reset');
      setCountdown(30);
      toast(sourceFormatPair('Mã OTP đặt lại mật khẩu đã gửi đến {0}', cleanEmail));
    } catch (err: unknown) {
      fail(sourceError(err, 'Không thể gửi mã OTP đặt lại mật khẩu.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Đặt mật khẩu mới: kiểm tra mã OTP 6 số và quy tắc mật khẩu rồi gửi lên backend.
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      fail('Mã OTP gồm đúng 6 chữ số.');
      return;
    }
    if (!isValidPassword(resetNewPassword)) {
      fail(PASSWORD_RULE_ERROR);
      return;
    }

    setIsLoading(true);
    setFormError('');
    try {
      await resetPasswordWithOtp(resetEmail.trim(), cleanOtp, resetNewPassword);
      toast('Đặt lại mật khẩu thành công!', 'success');
      setIdentifier(resetEmail.trim());
      setPassword('');
      resetToStandardMode();
    } catch (err: unknown) {
      fail(sourceError(err, 'Không thể đặt lại mật khẩu.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (currentUser && !isExpired) {
    return (
      <div
        className="luxury-login-container"
        style={{
          background: 'var(--color-bg-card)',
          borderRadius: '8px',
          padding: '48px 40px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(33, 28, 24, 0.06)',
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <span className="fit-session-badge" aria-hidden="true">
            ✓
          </span>
        </div>

        <h2
          style={{
            fontFamily: 'var(--fit-font, var(--font-sans))',
            fontSize: '1.8rem',
            fontWeight: 600,
            marginBottom: '8px',
            color: 'var(--color-text-main)',
          }}
        >
          {sourceText("Bạn đã đăng nhập")}</h2>

        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: '24px' }}>
          {sourceText("Đang đăng nhập với tài khoản ")}<strong>{currentUser.name}</strong> ({ROLE_NAMES[currentUser.role]})
        </p>

        <div style={{ display: 'grid', gap: '12px' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate(authDestination(currentUser.role, search), { viewTransition: true })}
          >
            {sourceText("Tiếp tục vào Portal (")}{ROLE_NAMES[currentUser.role]}) →
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              clearAuthSession();
            }}
          >
            {sourceText("Đăng xuất tài khoản này")}</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`luxury-login-container ${shaking ? 'anim-shake' : ''}`}
      onAnimationEnd={() => setShaking(false)}
      style={{
        background: 'var(--color-bg-card)',
        borderRadius: '8px',
        padding: '40px 36px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(33, 28, 24, 0.06)',
        maxWidth: '480px',
        width: '100%',
      }}
    >
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <h3
          style={{
            fontFamily: 'var(--fit-font, var(--font-sans))',
            fontSize: '1.85rem',
            fontWeight: 600,
            margin: 0,
            color: 'var(--color-text-main)',
            letterSpacing: '0.02em',
          }}
        >
          {mode === 'standard' && sourceText('Đăng nhập')}
          {mode === 'google_otp' && sourceText('Xác thực tài khoản')}
          {(mode === 'forgot_email' || mode === 'forgot_reset') && sourceText('Đặt lại mật khẩu')}
        </h3>
      </div>

      {isExpired && (
        <div role="status" className="portal-alert portal-alert--info" style={{ marginBottom: '18px' }}>
          <span>{sourceText("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")}</span>
        </div>
      )}

      {formError && (
        <div role="alert" className="portal-alert anim-fade-up" style={{ marginBottom: '18px' }}>
          {sourceText(formError)}
        </div>
      )}

      {/* CHẾ ĐỘ 1: Đăng nhập thường bằng tên đăng nhập/mật khẩu */}
      {mode === 'standard' && (
        <>
          <form onSubmit={handleStandardSubmit} noValidate>
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="login-identifier">
                {sourceText("Tên đăng nhập hoặc Email")}</label>
              <input
                id="login-identifier"
                type="text"
                className="portal-input"
                placeholder={sourceText("Tên đăng nhập hoặc email")}
                autoComplete="username"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (isExpired) setIsExpired(false);
                }}
                aria-invalid={!!formError && !identifier.trim() ? true : undefined}
              />
            </div>

            <div className="portal-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="portal-label" htmlFor="login-password" style={{ margin: 0 }}>
                  {sourceText("Mật Khẩu")}</label>
                <button
                  type="button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.75rem',
                    color: 'var(--fit-muted)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {showPassword ? sourceText('Ẩn mật khẩu') : sourceText('Hiện mật khẩu')}
                </button>
              </div>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="portal-input"
                placeholder={sourceText("Nhập mật khẩu")}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (isExpired) setIsExpired(false);
                }}
                aria-invalid={!!formError && (!password || !!identifier.trim()) ? true : undefined}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  id="forgot-password-btn"
                  className="fit-auth-link"
                  onClick={() => {
                    setFormError('');
                    setShowPassword(false);
                    setOtpCode('');
                    setDebugOtpCode('');
                    setResetNewPassword('');
                    setResetEmail(identifier.includes('@') ? identifier.trim() : '');
                    setMode('forgot_email');
                  }}
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    minHeight: 'auto',
                  }}
                >
                  {sourceText('Quên mật khẩu?')}
                </button>
              </div>
            </div>

            <button type="submit" className="luxury-login-submit-btn" disabled={isLoading || success || lockCountdown > 0}>
              {success ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <StatusMark size={22} />
                  {sourceText("ĐÃ XÁC THỰC")}</span>
              ) : lockCountdown > 0 ? (
                <span>{sourceFormat("THỬ LẠI SAU ({0}s)", lockCountdown)}</span>
              ) : (
                <>
                  <span>{isLoading ? sourceText('ĐANG XÁC THỰC...') : sourceText('ĐĂNG NHẬP')}</span>
                  <span className="submit-arrow" aria-hidden="true">→</span>
                </>
              )}
            </button>
          </form>

          {/* Đường phân cách */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border-medium)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {sourceText("HOẶC")}</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border-medium)' }} />
          </div>

          {/* Nút Đăng nhập bằng Google (SCRUM-89: Google OAuth -> Callback -> Xác nhận OTP qua Gmail) */}
          <button
            type="button"
            id="google-oauth-btn"
            className="btn-secondary"
            disabled={isGoogleLoading}
            style={{
              width: '100%',
              marginTop: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontWeight: 600,
            }}
            onClick={handleGoogleOAuthLogin}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span>{sourceText("Đăng nhập bằng Google")}</span>
          </button>
          {isGoogleLoading && <p role="status" style={{ textAlign: 'center', marginTop: 8 }}>{sourceText("Đang xác thực Google và gửi mã OTP...")}</p>}
          <p className="fit-auth-bottom" style={{ marginTop: '20px', fontSize: '0.85rem', textAlign: 'center' }}>
            {sourceText("Chưa có tài khoản?")}{' '}
            <Link to={purchaseAuthPath('/register', search)} viewTransition style={{ color: 'var(--sol-accent-text)', fontWeight: 600 }}>
              {sourceText("Đăng ký hội viên")}</Link>
          </p>
        </>
      )}

      {mode === 'forgot_email' && (
        <form onSubmit={handleRequestPasswordResetOtp} noValidate>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="reset-email-input">
              {sourceText('Email tài khoản')}
            </label>
            <input
              id="reset-email-input"
              type="email"
              autoComplete="email"
              className="portal-input"
              placeholder={sourceText('Nhập email đã đăng ký')}
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="luxury-login-submit-btn" disabled={isLoading}>
            <span>{isLoading ? sourceText('ĐANG GỬI MÃ OTP...') : sourceText('GỬI MÃ OTP')}</span>
            <span className="submit-arrow" aria-hidden="true">→</span>
          </button>
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button
              type="button"
              onClick={() => resetToStandardMode()}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.82rem',
                color: 'var(--fit-muted)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {sourceText('Quay lại đăng nhập')}
            </button>
          </div>
        </form>
      )}

      {mode === 'forgot_reset' && (
        <form onSubmit={handleResetPasswordSubmit} noValidate>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="reset-otp-input">
              {sourceText('Mã OTP (6 chữ số)')}
            </label>
            <input
              id="reset-otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="portal-input"
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </div>
          <div className="portal-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="portal-label" htmlFor="reset-new-password-input" style={{ margin: 0 }}>
                {sourceText('Mật khẩu mới')}
              </label>
              <button
                type="button"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.75rem',
                  color: 'var(--fit-muted)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showPassword ? sourceText('Ẩn mật khẩu') : sourceText('Hiện mật khẩu')}
              </button>
            </div>
            <input
              id="reset-new-password-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="portal-input"
              placeholder={sourceText(PASSWORD_RULE_HINT)}
              value={resetNewPassword}
              onChange={(e) => setResetNewPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="luxury-login-submit-btn" disabled={isLoading}>
            <span>{isLoading ? sourceText('ĐANG CẬP NHẬT...') : sourceText('ĐẶT LẠI MẬT KHẨU')}</span>
            <span className="submit-arrow" aria-hidden="true">→</span>
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button
              type="button"
              className="fit-auth-link"
              disabled={countdown > 0 || isLoading}
              onClick={handleRequestPasswordResetOtp}
              style={{
                fontSize: '0.82rem',
                color: 'var(--sol-accent-text)',
                cursor: countdown > 0 || isLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                minHeight: 'auto',
              }}
            >
              {countdown > 0 ? sourceFormat('Gửi lại mã sau ({0}s)', countdown) : sourceText('Gửi lại mã xác nhận')}
            </button>
            <button
              type="button"
              onClick={() => resetToStandardMode()}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.82rem',
                color: 'var(--fit-muted)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {sourceText('Quay lại đăng nhập')}
            </button>
          </div>
        </form>
      )}

      {/* CHẾ ĐỘ 3: Xác thực OTP Google (Hiển thị sau khi Google OAuth callback hoặc gửi OTP qua mail) */}
      {mode === 'google_otp' && (
        <form onSubmit={handleGoogleVerifyOtp} noValidate>
          <div className="fit-otp-notice" role="status">
            <div className="fit-otp-notice__title">
              {sourceText(otpMessage)}
            </div>
            {googleEmail && (
              <div className="fit-otp-notice__email">
                {sourceText("Tài khoản Google: ")}<strong>{googleEmail}</strong>
              </div>
            )}
          </div>

          {import.meta.env.DEV && debugOtpCode && (
            <div className="fit-debug-otp" style={{ textAlign: 'center' }}>
              <strong>{sourceText({ vi: 'Chế độ thử nghiệm (không cần mở hộp thư):', en: 'Test mode (no inbox needed):' })}</strong>{' '}
              {sourceText({ vi: 'Đã tự động điền mã xác nhận ', en: 'Verification code auto-filled: ' })}
              <strong>{debugOtpCode}</strong>
            </div>
          )}

          <div className="portal-form-group">
            <label className="portal-label" htmlFor="google-otp-code" style={{ textAlign: 'center', display: 'block' }}>
              {sourceText("Nhập mã xác nhận (6 chữ số):")}</label>
            <input
              id="google-otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="portal-input"
              placeholder="000000"
              style={{
                textAlign: 'center',
                fontSize: '1.8rem',
                letterSpacing: '0.3em',
                fontWeight: 700,
                padding: '12px',
              }}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="luxury-login-submit-btn"
            style={{ width: '100%', marginBottom: '14px' }}
            disabled={isLoading || success || otpCode.length < 6}
          >
            {success ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                <StatusMark size={22} />
                {sourceText("ĐÃ KÍCH HOẠT THÀNH CÔNG")}</span>
            ) : (
              <>
                <span>{isLoading ? sourceText('ĐANG XÁC THỰC...') : sourceText('XÁC NHẬN & KÍCH HOẠT TÀI KHOẢN')}</span>
                <span className="submit-arrow" aria-hidden="true">→</span>
              </>
            )}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button
              type="button"
              className="fit-auth-link"
              style={{
                fontSize: '0.82rem',
                color: 'var(--sol-accent-text)',
                cursor: countdown > 0 || isLoading || success ? 'not-allowed' : 'pointer',
                opacity: countdown > 0 || isLoading || success ? 0.6 : 1,
                fontWeight: 600,
                minHeight: 'auto',
              }}
              disabled={countdown > 0 || isLoading || success}
              onClick={handleGoogleSendOtp}
            >
              {countdown > 0 ? sourceFormat("Gửi lại mã sau ({0}s)", countdown) : sourceText('Gửi lại mã xác nhận')}
            </button>

            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.82rem',
                color: 'var(--fit-muted)',
                cursor: isLoading || success ? 'not-allowed' : 'pointer',
                opacity: isLoading || success ? 0.6 : 1,
                padding: 0,
              }}
              disabled={isLoading || success}
              onClick={() => resetToStandardMode(true)}
            >
              {sourceText("Chọn tài khoản Google khác")}</button>
          </div>
        </form>
      )}
    </div>
  );
}
