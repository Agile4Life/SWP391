import '../landing/landing.css';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, sendOtp as requestOtp, verifyOtp } from './authApi';
import { LANDING_IMAGES } from '../landing/assets/images';
import { SiteFooter } from '../landing/components/SiteFooter';
import { CustomCursor } from '../landing/components/CustomCursor';
import { StatusMark } from '../../shared/ui/StatusMark';
import { toast } from '../../shared/ui/toast';

type Step = 'register' | 'otp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const RESEND_COOLDOWN = 30;

export function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('register');
  const [form, setForm] = useState({ username: '', email: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Timer countdown for resending OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const sendOtp = async () => {
    const res = await requestOtp(form.email.trim());
    if (res.debugOtp) setDebugOtp(res.debugOtp);
    setCountdown(RESEND_COOLDOWN);
    toast(`Mã OTP đã được gửi tới ${form.email.trim()}`);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = form.username.trim();
    const cleanEmail = form.email.trim();
    const cleanPhone = form.phone.trim();

    if (cleanUser.length < 3) {
      setError('Tên đăng nhập cần tối thiểu 3 ký tự.');
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError('Email không đúng định dạng (vd: user@example.com).');
      return;
    }
    if (cleanPhone && !PHONE_RE.test(cleanPhone)) {
      setError('Số điện thoại không hợp lệ (Phải là 10 số, vd: 0912345678).');
      return;
    }
    if (form.password.length < 6) {
      setError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await register({ username: cleanUser, email: cleanEmail, phone: cleanPhone || undefined, password: form.password });
      await sendOtp();
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký không thành công.');
    } finally {
      setBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      await sendOtp();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi lại mã OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Mã OTP gồm đúng 6 chữ số.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await verifyOtp(form.email.trim(), otp.trim());
      setSuccess(true);
      toast('Tài khoản đã được kích hoạt thành công!', 'success');
      window.setTimeout(() => {
        navigate('/login', { replace: true, viewTransition: true });
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác thực OTP thất bại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sol-page-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <CustomCursor />
      {/* Top Header Matching Login Page Navbar */}
      <header
        className="sol-fixed-navbar scrolled"
        style={{
          position: 'sticky',
          top: 0,
          background: 'rgba(250, 248, 245, 0.96)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--color-border-subtle)',
          padding: '0 56px',
        }}
      >
        <Link to="/" className="aura-brand-mark" viewTransition>
          SÖL WELLNESS SANCTUARY
        </Link>

        <nav className="aura-nav-links" aria-label="Portal Header Navigation">
          <Link to="/#about" className="aura-nav-link">PHILOSOPHY</Link>
          <Link to="/#disciplines" className="aura-nav-link">DISCIPLINES</Link>
          <Link to="/#packages" className="aura-nav-link">MEMBERSHIP</Link>
          <Link to="/#contact" className="aura-nav-link">CONTACT</Link>
        </nav>

        <Link to="/login" viewTransition className="aura-portal-btn">
          ĐĂNG NHẬP →
        </Link>
      </header>

      {/* Main Registration Stage */}
      <main className="auth-stage">
        <div className="auth-split-grid">
          {/* Left Column: Visual & Brand Philosophy */}
          <div>
            <h1
              className="editorial-headline"
              style={{
                fontSize: 'clamp(2.4rem, 4vw, 3.8rem)',
                lineHeight: 1.05,
                marginBottom: '24px',
              }}
            >
              JOIN THE{' '}
              <span className="editorial-flourish" style={{ fontStyle: 'italic', fontWeight: 300 }}>
                Collective
              </span>
            </h1>

            <p className="editorial-body" style={{ maxWidth: '480px', marginBottom: '28px', color: '#6A635D' }}>
              Trải nghiệm không gian rèn luyện thể chất, phục hồi năng lượng và chăm sóc sức khỏe toàn diện chuẩn quốc tế.
            </p>

            <div
              className="image-card-wrapper"
              style={{
                height: '320px',
                borderRadius: '4px',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.08)',
              }}
            >
              <img
                src={LANDING_IMAGES.pilatesPrimary}
                alt="Sanctuary Wellness Experience"
                loading="lazy"
              />
            </div>
          </div>

          {/* Right Column: Registration / OTP Card */}
          <div>
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '8px',
                padding: '44px 40px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(33, 28, 24, 0.06)',
                maxWidth: '520px',
                width: '100%',
                margin: '0 auto',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.9rem',
                    fontWeight: 600,
                    margin: '0 0 8px',
                    color: '#1A1614',
                  }}
                >
                  {step === 'register' ? 'Đăng ký Hội viên' : 'Xác thực OTP'}
                </h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#7E7771' }}>
                  {step === 'register'
                    ? 'Tạo tài khoản để bắt đầu hành trình thể chất của bạn'
                    : `Mã xác thực gồm 6 số đã được gửi tới ${form.email}`}
                </p>
              </div>

              {error && (
                <div role="alert" className="portal-alert anim-fade-up" style={{ marginBottom: '18px' }}>
                  ⚠️ {error}
                </div>
              )}

              {step === 'register' ? (
                <form onSubmit={handleRegister}>
                  <div className="portal-form-group">
                    <label className="portal-label" htmlFor="reg-username">
                      Tên đăng nhập
                    </label>
                    <input
                      id="reg-username"
                      type="text"
                      className="portal-input"
                      placeholder="vd: nguyenvana"
                      autoComplete="username"
                      required
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                  </div>

                  <div className="portal-form-group">
                    <label className="portal-label" htmlFor="reg-email">
                      Địa chỉ Email
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      className="portal-input"
                      placeholder="vd: an.nguyen@example.com"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>

                  <div className="portal-form-group">
                    <label className="portal-label" htmlFor="reg-phone">
                      Số điện thoại <span style={{ fontWeight: 400, color: '#8C847C', fontSize: '0.72rem' }}>(Tùy chọn)</span>
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      className="portal-input"
                      placeholder="vd: 0912345678"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>

                  <div className="portal-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="portal-label" htmlFor="reg-password" style={{ margin: 0 }}>
                        Mật khẩu
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
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      className="portal-input"
                      placeholder="Tối thiểu 6 ký tự"
                      autoComplete="new-password"
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="luxury-login-submit-btn" disabled={busy}>
                    <span>{busy ? 'ĐANG TẠO TÀI KHOẢN...' : 'TIẾP TỤC XÁC THỰC'}</span>
                    <span className="submit-arrow" aria-hidden="true">→</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerify}>
                  {debugOtp && (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: '#FAF6F0',
                        border: '1px dashed var(--color-accent-gold)',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        marginBottom: '18px',
                        color: '#5C4D3C',
                      }}
                    >
                      Mã OTP thử nghiệm (debug): <strong>{debugOtp}</strong>
                    </div>
                  )}

                  <div className="portal-form-group">
                    <label className="portal-label" htmlFor="otp-code">
                      Nhập mã 6 chữ số
                    </label>
                    <input
                      id="otp-code"
                      type="text"
                      className="portal-input"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="••••••"
                      style={{
                        textAlign: 'center',
                        fontSize: '1.4rem',
                        letterSpacing: '0.3em',
                        fontWeight: 600,
                      }}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>

                  <button type="submit" className="luxury-login-submit-btn" disabled={busy || success}>
                    {success ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                        <StatusMark size={22} />
                        ĐÃ KÍCH HOẠT
                      </span>
                    ) : (
                      <span>{busy ? 'ĐANG XÁC THỰC...' : 'XÁC THỰC & HOÀN TẤT'}</span>
                    )}
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '16px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setStep('register')}
                      disabled={busy}
                    >
                      ← Đổi thông tin
                    </button>

                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: countdown > 0 || busy ? 'not-allowed' : 'pointer',
                        color: countdown > 0 ? '#8C847C' : 'var(--color-accent-gold)',
                        fontWeight: 600,
                        padding: 0,
                      }}
                      disabled={countdown > 0 || busy}
                      onClick={handleResendOtp}
                    >
                      {countdown > 0 ? `Gửi lại mã sau ${countdown}s` : 'Gửi lại mã OTP'}
                    </button>
                  </div>
                </form>
              )}

              <p style={{ marginTop: '24px', fontSize: '0.85rem', textAlign: 'center', color: '#7E7771' }}>
                Đã có tài khoản?{' '}
                <Link to="/login" viewTransition style={{ fontWeight: 600, color: '#1A1614' }}>
                  Đăng nhập ngay
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
