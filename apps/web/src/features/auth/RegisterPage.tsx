import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, sendOtp as requestOtp, verifyOtp } from './authApi';
import { AuthLayout } from '../landing/components/PublicLayout';
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

  return <AuthLayout mode="register">
    <div className="fit-auth-card">
      <header>
        <span className="fit-kicker">WELCOME TO THE CLUB</span>
        <h2>{step === 'register' ? 'Đăng ký hội viên' : 'Xác thực OTP'}</h2>
        <p>{step === 'register' ? 'Bắt đầu hành trình thể chất theo cách của bạn.' : `Nhập mã gồm 6 chữ số đã gửi tới ${form.email}.`}</p>
      </header>
      {error && <div role="alert" className="portal-alert">{error}</div>}
      {step === 'register' ? <form onSubmit={handleRegister} aria-busy={busy}>
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="reg-username">Tên đăng nhập</label>
          <input id="reg-username" className="portal-input" type="text" autoComplete="username" placeholder="Tên đăng nhập của bạn" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="reg-email">Địa chỉ email</label>
          <input id="reg-email" className="portal-input" type="email" autoComplete="email" placeholder="ban@example.com" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="reg-phone">Số điện thoại <small>(Tùy chọn)</small></label>
          <input id="reg-phone" className="portal-input" type="tel" autoComplete="tel" placeholder="0912 345 678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="portal-form-group">
          <div className="portal-label-row">
            <label className="portal-label" htmlFor="reg-password">Mật khẩu</label>
            <button className="fit-auth-link" type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}</button>
          </div>
          <input id="reg-password" className="portal-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Tối thiểu 6 ký tự" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="luxury-login-submit-btn" type="submit" disabled={busy}><span>{busy ? 'ĐANG TẠO TÀI KHOẢN...' : 'TIẾP TỤC XÁC THỰC'}</span><span className="submit-arrow" aria-hidden="true">→</span></button>
      </form> : <form onSubmit={handleVerify} aria-busy={busy}>
        {debugOtp && <div className="fit-debug-otp">Mã OTP thử nghiệm (debug): <strong>{debugOtp}</strong></div>}
        <div className="portal-form-group">
          <label className="portal-label" htmlFor="otp-code">Nhập mã 6 chữ số</label>
          <input id="otp-code" className="portal-input fit-otp-input" type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="000000" autoFocus required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
        </div>
        <button className="luxury-login-submit-btn" type="submit" disabled={busy || success}>
          {success ? <><StatusMark size={22} /><span>ĐÃ KÍCH HOẠT</span></> : <><span>{busy ? 'ĐANG XÁC THỰC...' : 'XÁC THỰC & HOÀN TẤT'}</span><span className="submit-arrow" aria-hidden="true">→</span></>}
        </button>
        <div className="fit-otp-actions">
          <button className="fit-auth-link" type="button" disabled={busy} onClick={() => setStep('register')}>← Đổi thông tin</button>
          <button className="fit-auth-link" type="button" disabled={countdown > 0 || busy} onClick={handleResendOtp}>{countdown > 0 ? `Gửi lại mã sau ${countdown}s` : 'Gửi lại mã OTP'}</button>
        </div>
      </form>}
      <p className="fit-auth-bottom">Đã có tài khoản? <Link to="/login">Đăng nhập ngay ↗</Link></p>
    </div>
  </AuthLayout>;
}
