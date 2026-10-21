import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearAuthSession, getCurrentUser, homePath, loginApi, setAuthSession, type UserSession } from '../../shared/api/client';
import { StatusMark } from '../../shared/ui/StatusMark';
import { toast } from '../../shared/ui/toast';
import { googleLoginWithIdToken, googleSendOtp, googleVerifyOtp } from './authApi';

interface LuxuryLoginFormProps {
  onSuccess?: () => void;
}

const ROLE_NAMES: Record<UserSession['role'], string> = {
  MEMBER: 'Hội viên',
  STAFF: 'Lễ tân / Thu ngân',
  COACH: 'Huấn luyện viên',
  MANAGER: 'Quản trị viên Trung tâm',
};

type AuthMode = 'standard' | 'google_email' | 'google_otp';

export function LuxuryLoginForm({ onSuccess }: LuxuryLoginFormProps) {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => getCurrentUser());
  const [mode, setMode] = useState<AuthMode>('standard');

  // Standard Login Form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Google Login Form
  const [googleEmail, setGoogleEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [debugOtpCode, setDebugOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [success, setSuccess] = useState(false);

  // Google Client ID từ biến môi trường
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const [isExpired, setIsExpired] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('expired') === '1';
  });

  // Countdown timer for resending OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const fail = useCallback((msg: string) => {
    setFormError(msg);
    setShaking(true);
  }, []);

  // BR-01, BR-06: Xác thực Google ID Token qua backend API và cấp JWT session
  const processGoogleIdToken = useCallback(async (idToken: string) => {
    setIsGoogleLoading(true);
    setFormError('');
    try {
      const res = await googleLoginWithIdToken(idToken);
      const user = setAuthSession(res.token, res.username, res.role);
      toast('Đăng nhập bằng Google thành công!', 'success');
      setSuccess(true);
      if (onSuccess) onSuccess();
      window.setTimeout(() => navigate(homePath(user.role), { viewTransition: true }), 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập Google thất bại.';
      // BR-04 & BR-05: Chặn nhân sự (403) và tài khoản bị khóa
      if (msg.includes('nhân sự') || msg.toLowerCase().includes('staff') || msg.includes('403')) {
        fail('Tài khoản nhân sự không được phép đăng nhập qua Google. Vui lòng sử dụng đăng nhập thường bằng tên tài khoản và mật khẩu.');
      } else if (msg.toLowerCase().includes('khóa') || msg.toLowerCase().includes('locked')) {
        fail('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
      } else {
        fail(msg);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }, [fail, navigate, onSuccess]);

  // Khởi tạo Google Identity Services (GIS)
  useEffect(() => {
    if (!googleClientId || mode !== 'standard') return;

    const initGoogleGis = () => {
      if (!window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response: { credential: string }) => {
            if (response?.credential) {
              void processGoogleIdToken(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const btnElement = document.getElementById('google-official-btn');
        if (btnElement) {
          window.google.accounts.id.renderButton(btnElement, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 380,
            locale: 'vi',
          });
        }
      } catch (err) {
        console.warn('Google Identity Services initialization failed:', err);
      }
    };

    if (window.google?.accounts?.id) {
      initGoogleGis();
    } else {
      const interval = window.setInterval(() => {
        if (window.google?.accounts?.id) {
          window.clearInterval(interval);
          initGoogleGis();
        }
      }, 500);
      return () => window.clearInterval(interval);
    }
  }, [googleClientId, mode, processGoogleIdToken]);

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExpired(false);
    if (!identifier.trim()) {
      fail('Vui lòng nhập tên đăng nhập hoặc email.');
      return;
    }
    if (!password) {
      fail('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsLoading(true);
    setFormError('');

    try {
      const res = await loginApi(identifier, password);
      if (onSuccess) onSuccess();

      setSuccess(true);
      window.setTimeout(() => navigate(homePath(res.user.role), { viewTransition: true }), 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập không thành công.';
      fail(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Gửi OTP tới Gmail
  const handleGoogleSendOtp = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    const cleanEmail = googleEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      fail('Vui lòng nhập đúng địa chỉ Gmail.');
      return;
    }

    setIsLoading(true);
    setFormError('');

    try {
      const res = await googleSendOtp(cleanEmail);
      setOtpMessage(res.message || `Đã gửi mã xác nhận đến gmail ${cleanEmail}. Hãy nhập mã xác nhận để kích hoạt tài khoản.`);
      if (res.debugOtp) {
        setDebugOtpCode(res.debugOtp);
        setOtpCode(res.debugOtp);
      } else {
        setDebugOtpCode('');
        setOtpCode('');
      }
      setMode('google_otp');
      setCountdown(30);
      toast(`Mã xác nhận đã được gửi đến ${cleanEmail}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi mã xác nhận đến email.';
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
      const user = setAuthSession(res.token, res.username, res.role);
      if (onSuccess) onSuccess();

      setSuccess(true);
      toast('Kích hoạt tài khoản và đăng nhập thành công!', 'success');
      window.setTimeout(() => navigate(homePath(user.role), { viewTransition: true }), 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Mã xác nhận không chính xác hoặc đã hết hạn.';
      fail(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (currentUser && !isExpired) {
    return (
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          padding: '48px 40px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(33, 28, 24, 0.06)',
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'rgba(82, 183, 136, 0.15)',
              color: '#2d6a4f',
              fontSize: '1.6rem',
              fontWeight: 700,
            }}
          >
            ✓
          </span>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.8rem',
            fontWeight: 600,
            marginBottom: '8px',
            color: '#1A1614',
          }}
        >
          Phiên đăng nhập đang hoạt động
        </h2>

        <p style={{ color: '#7E7771', fontSize: '0.95rem', marginBottom: '24px' }}>
          Đang đăng nhập với tài khoản <strong>{currentUser.name}</strong> ({ROLE_NAMES[currentUser.role]})
        </p>

        <div style={{ display: 'grid', gap: '12px' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate(homePath(currentUser.role), { viewTransition: true })}
          >
            Tiếp tục vào Portal ({ROLE_NAMES[currentUser.role]}) →
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              clearAuthSession();
              setCurrentUser(null);
            }}
          >
            Đăng xuất tài khoản này
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`luxury-login-container ${shaking ? 'anim-shake' : ''}`}
      onAnimationEnd={() => setShaking(false)}
      style={{
        background: '#FFFFFF',
        borderRadius: '8px',
        padding: '40px 36px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(33, 28, 24, 0.06)',
        maxWidth: '480px',
        width: '100%',
      }}
    >
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <span
          style={{
            fontSize: '0.72rem',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: '#8B572A',
            display: 'block',
            marginBottom: '6px',
            fontWeight: 600,
          }}
        >
          SÖL SANCTUARY PORTAL
        </span>
        <h3
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.85rem',
            fontWeight: 600,
            margin: 0,
            color: '#1A1614',
            letterSpacing: '0.02em',
          }}
        >
          {mode === 'standard' && 'Đăng nhập'}
          {mode === 'google_email' && 'Đăng nhập với Google'}
          {mode === 'google_otp' && 'Xác thực tài khoản'}
        </h3>
      </div>

      {isExpired && (
        <div role="status" className="portal-alert portal-alert--info" style={{ marginBottom: '18px' }}>
          <span>Phiên đăng nhập đã hết hạn để đảm bảo an toàn. Vui lòng đăng nhập lại.</span>
        </div>
      )}

      {formError && (
        <div role="alert" className="portal-alert anim-fade-up" style={{ marginBottom: '18px' }}>
          ⚠️ {formError}
        </div>
      )}

      {/* MODE 1: Standard Username/Password Login */}
      {mode === 'standard' && (
        <>
          <form onSubmit={handleStandardSubmit}>
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="login-identifier">
                Tên đăng nhập hoặc Email
              </label>
              <input
                id="login-identifier"
                type="text"
                className="portal-input"
                placeholder="Tên đăng nhập hoặc email"
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
                  Mật Khẩu
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.72rem',
                    color: '#8C847C',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                </button>
              </div>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="portal-input"
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (isExpired) setIsExpired(false);
                }}
                aria-invalid={!!formError && (!password || !!identifier.trim()) ? true : undefined}
              />
            </div>

            <button type="submit" className="luxury-login-submit-btn" disabled={isLoading || success}>
              {success ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <StatusMark size={22} />
                  ĐÃ XÁC THỰC
                </span>
              ) : (
                <>
                  <span>{isLoading ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP'}</span>
                  <span className="submit-arrow" aria-hidden="true">→</span>
                </>
              )}
            </button>
          </form>

          {/* Đường phân cách */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: '#ECE7E1' }} />
            <span style={{ fontSize: '0.75rem', color: '#7E7771', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              HOẶC
            </span>
            <div style={{ flex: 1, height: '1px', background: '#ECE7E1' }} />
          </div>

          {/* Nút Đăng nhập bằng Google (SCRUM-89: Google Sign-In) */}
          {googleClientId && (
            <div
              id="google-official-btn"
              style={{ display: 'flex', justifyContent: 'center', pointerEvents: isGoogleLoading ? 'none' : undefined }}
              aria-busy={isGoogleLoading}
            />
          )}
          {isGoogleLoading && <p role="status">Đang kết nối Google...</p>}
          <button
            type="button"
            className="btn-secondary"
            disabled={isGoogleLoading}
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => {
              setFormError('');
              setMode('google_email');
            }}
          >
            Đăng nhập bằng mã Gmail OTP
          </button>

          <p style={{ marginTop: '20px', fontSize: '0.85rem', textAlign: 'center' }}>
            Chưa có tài khoản?{' '}
            <Link to="/register" viewTransition style={{ color: '#8B572A', fontWeight: 600 }}>
              Đăng ký hội viên
            </Link>
          </p>
        </>
      )}

      {/* MODE 2: Google Email Input */}
      {mode === 'google_email' && (
        <form onSubmit={handleGoogleSendOtp}>
          <p style={{ fontSize: '0.88rem', color: '#7E7771', marginBottom: '18px', textAlign: 'center' }}>
            Nhập tài khoản Google (Gmail) của bạn để nhận mã xác nhận kích hoạt tài khoản.
          </p>

          <div className="portal-form-group">
            <label className="portal-label" htmlFor="google-email">
              Địa Chỉ Gmail *
            </label>
            <input
              id="google-email"
              type="email"
              className="portal-input"
              placeholder="nhap.email.cua.ban@gmail.com"
              value={googleEmail}
              onChange={(e) => setGoogleEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="luxury-login-submit-btn"
            style={{ width: '100%', marginBottom: '14px' }}
            disabled={isLoading}
          >
            <span>{isLoading ? 'ĐANG GỬI MÃ...' : 'GỬI MÃ XÁC NHẬN ĐẾN GMAIL'}</span>
            <span className="submit-arrow" aria-hidden="true">→</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
            disabled={isLoading}
            onClick={() => {
              setFormError('');
              setMode('standard');
            }}
          >
            ← Quay lại đăng nhập thông thường
          </button>
        </form>
      )}

      {/* MODE 3: Google OTP Verification (Yêu cầu của Mentor/Lead) */}
      {mode === 'google_otp' && (
        <form onSubmit={handleGoogleVerifyOtp}>
          {/* Hộp thông báo màu xanh theo đúng yêu cầu đề bài */}
          <div
            style={{
              background: '#E8F5E9',
              border: '1px solid #A5D6A7',
              borderRadius: '6px',
              padding: '16px',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>📩</div>
            <div style={{ fontSize: '0.92rem', color: '#1B5E20', fontWeight: 600, lineHeight: 1.4 }}>
              {otpMessage}
            </div>
          </div>

          {debugOtpCode && (
            <div
              style={{
                background: '#FFF3E0',
                border: '1px solid #FFE0B2',
                borderRadius: '6px',
                padding: '8px 12px',
                marginBottom: '16px',
                fontSize: '0.84rem',
                color: '#E65100',
                textAlign: 'center',
              }}
            >
              ⚙️ <strong>Chế độ Test (Không cần mở mail):</strong> Đã tự động điền mã xác nhận <strong>{debugOtpCode}</strong>
            </div>
          )}

          <div className="portal-form-group">
            <label className="portal-label" htmlFor="google-otp-code" style={{ textAlign: 'center', display: 'block' }}>
              Nhập mã xác nhận (6 chữ số):
            </label>
            <input
              id="google-otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
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
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
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
                ĐÃ KÍCH HOẠT THÀNH CÔNG
              </span>
            ) : (
              <>
                <span>{isLoading ? 'ĐANG XÁC THỰC...' : 'XÁC NHẬN & KÍCH HOẠT TÀI KHOẢN'}</span>
                <span className="submit-arrow" aria-hidden="true">→</span>
              </>
            )}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.82rem',
                color: '#8B572A',
                cursor: countdown > 0 || isLoading || success ? 'not-allowed' : 'pointer',
                opacity: countdown > 0 || isLoading || success ? 0.6 : 1,
                padding: 0,
                fontWeight: 600,
              }}
              disabled={countdown > 0 || isLoading || success}
              onClick={handleGoogleSendOtp}
            >
              {countdown > 0 ? `Gửi lại mã sau (${countdown}s)` : 'Gửi lại mã xác nhận'}
            </button>

            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.82rem',
                color: '#7E7771',
                cursor: isLoading || success ? 'not-allowed' : 'pointer',
                opacity: isLoading || success ? 0.6 : 1,
                padding: 0,
              }}
              disabled={isLoading || success}
              onClick={() => {
                setFormError('');
                setOtpCode('');
                setDebugOtpCode('');
                setMode('google_email');
              }}
            >
              Đổi email khác
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
