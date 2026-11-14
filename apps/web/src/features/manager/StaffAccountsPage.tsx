import { staffTranslation, useStaffI18n, type StaffMessage, staffMessage, staffError as errorMessage, staffNotify as notify } from '../operations/staffI18n';
import { useEffect, useState, type FormEvent } from 'react';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Select } from '../../shared/ui/Select';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { createStaffAccount, listStaffAccounts, setStaffAccountLocked, type StaffAccount, type StaffAccountInput } from './staffAccountsApi';
import { isValidEmailAddress, isValidPhoneNumber, normalizePhoneNumber } from '../auth/authValidation';

const initialForm: StaffAccountInput = {
  fullName: '', email: '', phone: '', password: '', gender: 'other', roleCode: 'COACH',
};

function validateStaffEmail(raw: string, accounts: StaffAccount[] = []): string | undefined {
  const clean = raw.trim();
  if (!clean) return 'Vui lòng nhập email liên hệ.';
  if (clean.toLowerCase().endsWith('@gmail.co')) return 'Có vẻ bạn gõ nhầm @gmail.co? Vui lòng sửa thành @gmail.com';
  if (!isValidEmailAddress(clean)) return 'Email liên hệ không đúng định dạng (vd: mai@sol.vn).';
  if (accounts.some(acc => acc.email?.trim().toLowerCase() === clean.toLowerCase())) {
    return 'Email đã tồn tại.';
  }
  return undefined;
}

function validateStaffPhone(raw?: string, accounts: StaffAccount[] = []): string | undefined {
  const clean = (raw ?? '').trim();
  if (!clean) return undefined;
  if (!isValidPhoneNumber(clean)) return 'Số điện thoại không hợp lệ (Phải là 10 số, vd: 0912345678).';
  const target = normalizePhoneNumber(clean);
  if (accounts.some(acc => acc.phone && normalizePhoneNumber(acc.phone) === target)) {
    return 'Số điện thoại đã tồn tại.';
  }
  return undefined;
}

export function StaffAccountsPage() {
  const { t } = useStaffI18n();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<StaffMessage>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<StaffMessage>('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    listStaffAccounts().then(data => {
      if (active) { setAccounts(data); setLoadError(''); }
    }).catch((err: unknown) => {
      if (active) setLoadError(errorMessage(err, 'Không thể tải tài khoản nhân sự.'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  async function toggleLock(account: StaffAccount) {
    if (busyId !== null) return;
    const lock = account.status === 'active';
    const confirmed = await confirm({
      title: lock ? staffMessage('Khóa tài khoản nhân sự?', staffTranslation('Khóa tài khoản nhân sự?')) : staffMessage('Mở khóa tài khoản nhân sự?', staffTranslation('Mở khóa tài khoản nhân sự?')),
      message: lock
        ? staffMessage(`Bạn có chắc chắn muốn khóa tài khoản ${account.fullName} (${account.email})? Nhân sự sẽ không thể đăng nhập cho đến khi được mở khóa.`, `Are you sure you want to lock account ${account.fullName} (${account.email})? This staff member will not be able to sign in until unlocked.`)
        : staffMessage(`Bạn có chắc chắn muốn mở khóa tài khoản ${account.fullName} (${account.email})?`, `Are you sure you want to unlock account ${account.fullName} (${account.email})?`),
      confirmLabel: lock ? staffMessage('Khóa tài khoản', staffTranslation('Khóa tài khoản')) : staffMessage('Mở khóa', staffTranslation('Mở khóa')),
      danger: lock,
    });
    if (!confirmed) return;
    setBusyId(account.id);
    try {
      const updated = await setStaffAccountLocked(account.id, lock);
      setAccounts(current => current.map(item => item.id === updated.id ? updated : item));
      notify(lock ? staffMessage(`Đã khóa tài khoản ${account.email}.`, `Locked account ${account.email}.`) : staffMessage(`Đã mở khóa tài khoản ${account.email}.`, `Unlocked account ${account.email}.`), 'success');
    } catch (err) {
      notify(errorMessage(err, 'Không thể đổi trạng thái tài khoản.'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const emailError = validateStaffEmail(form.email, accounts);
    const phoneError = validateStaffPhone(form.phone, accounts);
    if (emailError || phoneError) {
      setFieldErrors({ email: emailError, phone: phoneError });
      return;
    }
    setFieldErrors({});
    setError('');
    setSaving(true);
    try {
      const normalizedPhone = normalizePhoneNumber(form.phone) || undefined;
      const created = await createStaffAccount({ ...form, fullName: form.fullName.trim(), email: form.email.trim(), phone: normalizedPhone });
      setAccounts(current => [...current, created]);
      setForm(initialForm);
      setFieldErrors({});
      notify(staffMessage(`Đã tạo tài khoản ${created.email}. Nhân sự có thể đăng nhập bằng email hoặc Google với đúng email đã được cấp.`, `Created account ${created.email}. Staff can sign in with email or Google using the assigned email address.`), 'success');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : '';
      if (code === 'EMAIL_EXISTS' || /email.*tồn tại|email already exists/i.test(msg)) {
        setFieldErrors(prev => ({ ...prev, email: 'Email đã tồn tại.' }));
      }
      if (code === 'PHONE_EXISTS' || /điện thoại.*tồn tại|phone.*already exists/i.test(msg)) {
        setFieldErrors(prev => ({ ...prev, phone: 'Số điện thoại đã tồn tại.' }));
      }
      setError(errorMessage(err, 'Không thể tạo tài khoản. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  }

  return <div data-i18n-managed className="portal-container">
    <PageHeader title={t("Tài khoản nhân sự")} />
    <section className="portal-card" aria-labelledby="staff-create-heading">
      <h2 id="staff-create-heading" className="portal-card-title">{t("Thêm nhân sự")}</h2>
      <form onSubmit={event => void submit(event)}>
        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="portal-form-grid">
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="staff-name">{t("Họ và tên *")}</label>
            <input id="staff-name" className="portal-input" required maxLength={150} autoComplete="name" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="staff-email">Email *</label>
            <input
              id="staff-email"
              className="portal-input"
              type="email"
              required
              maxLength={150}
              autoComplete="email"
              placeholder="mai.nguyen@sol.vn"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'staff-email-error' : undefined}
              value={form.email}
              onChange={e => {
                const value = e.target.value;
                setForm({ ...form, email: value });
                if (value.trim() || fieldErrors.email) {
                  setFieldErrors(prev => ({ ...prev, email: validateStaffEmail(value, accounts) }));
                }
              }}
              onBlur={() => {
                if (form.email.trim() || fieldErrors.email) {
                  setFieldErrors(prev => ({ ...prev, email: validateStaffEmail(form.email, accounts) }));
                }
              }}
            />
            {fieldErrors.email && <p id="staff-email-error" role="alert" className="form-error">{t(fieldErrors.email)}</p>}
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="staff-phone">{t("Số điện thoại")}</label>
            <input
              id="staff-phone"
              className="portal-input"
              type="tel"
              maxLength={20}
              autoComplete="tel"
              aria-invalid={!!fieldErrors.phone}
              aria-describedby={fieldErrors.phone ? 'staff-phone-error' : undefined}
              value={form.phone}
              onChange={e => {
                const value = e.target.value;
                setForm({ ...form, phone: value });
                setFieldErrors(prev => ({ ...prev, phone: validateStaffPhone(value, accounts) }));
              }}
              onBlur={() => setFieldErrors(prev => ({ ...prev, phone: validateStaffPhone(form.phone, accounts) }))}
            />
            {fieldErrors.phone && <p id="staff-phone-error" role="alert" className="form-error">{t(fieldErrors.phone)}</p>}
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="staff-password">{t("Mật khẩu *")}</label>
            <input id="staff-password" className="portal-input" type="password" required minLength={6} maxLength={50} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="staff-gender">{t("Giới tính *")}</label>
            <Select id="staff-gender" className="portal-select" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as StaffAccountInput['gender'] })}>
              <option value="male">{t("Nam")}</option><option value="female">{t("Nữ")}</option><option value="other">{t("Khác")}</option>
            </Select>
          </div>
          <div className="portal-form-group">
            <label className="portal-label" htmlFor="staff-role">{t("Vai trò *")}</label>
            <Select id="staff-role" className="portal-select" value={form.roleCode} onChange={e => setForm({ ...form, roleCode: e.target.value as StaffAccountInput['roleCode'] })}>
              <option value="COACH">{t("Huấn luyện viên")}</option><option value="RECEPTIONIST">{t("Lễ tân")}</option>
            </Select>
          </div>
          </div>
          <button className="btn-primary" type="submit" disabled={loading || Boolean(loadError)} aria-busy={saving}>{saving ? t('Đang tạo…') : t('Tạo tài khoản nhân sự')}</button>
        </fieldset>
        {error && <p role="alert" className="portal-alert">{t(error)}</p>}
      </form>
    </section>
    <section className="portal-card" aria-labelledby="staff-list-heading">
      <h2 id="staff-list-heading" className="portal-card-title">{t("Huấn luyện viên & Lễ tân")}</h2>
      {loading ? <LoadingSkeleton label={t("Đang tải tài khoản nhân sự")} variant="table" /> : loadError ? <div role="alert" className="portal-alert">
        {t(loadError)} <button className="btn-secondary" type="button" onClick={() => { setLoading(true); setReload(current => current + 1); }}>{t("Thử lại")}</button>
      </div> : accounts.length === 0 ? <p>{t("Chưa có tài khoản nhân sự.")}</p> : <div className="portal-table-wrapper">
        <table className="portal-table">
          <thead><tr><th scope="col">{t("Họ và tên")}</th><th scope="col">Email</th><th scope="col">{t("Vai trò")}</th><th scope="col">{t("Trạng thái")}</th><th scope="col">{t("Thao tác")}</th></tr></thead>
          <tbody>{accounts.map(account => <tr key={account.id}>
            <td>{account.fullName}</td><td>{account.email}</td>
            <td>{account.roleCode === 'COACH' ? t('Huấn luyện viên') : t('Lễ tân')}</td>
            <td>{account.status === 'active' ? t('Hoạt động') : account.status === 'locked' ? t('Đã khóa') : t('Chưa kích hoạt')}</td>
            <td>{account.status === 'active' || account.status === 'locked' ? <button className="btn-secondary btn-sm" type="button"
              disabled={busyId !== null} onClick={() => void toggleLock(account)}>
              {account.status === 'active' ? t('Khóa') : t('Mở khóa')}
            </button> : null}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    {confirmDialog}
  </div>;
}
