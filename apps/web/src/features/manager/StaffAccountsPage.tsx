import { staffTranslation, useStaffI18n, type StaffMessage, staffMessage, staffError as errorMessage, staffNotify as notify } from '../operations/staffI18n';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Select } from '../../shared/ui/Select';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { createStaffAccount, listStaffAccounts, setStaffAccountLocked, type StaffAccount, type StaffAccountInput } from './staffAccountsApi';
import {
  PASSWORD_RULE_ERROR,
  PASSWORD_RULE_HINT,
  isValidEmailAddress,
  isValidPassword,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from '../auth/authValidation';

const initialForm: StaffAccountInput = {
  fullName: '', email: '', phone: '', password: '', gender: 'male', roleCode: 'COACH',
};

/** Kiểm tra họ và tên nhân sự: sau khi bỏ khoảng trắng phải có tối thiểu 2 ký tự. */
function validateStaffName(raw: string): string | undefined {
  const clean = raw.trim();
  if (clean.length < 2) return 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự).';
  if (clean.length > 150) return 'Họ và tên tối đa 150 ký tự.';
  return undefined;
}

/** Kiểm tra mật khẩu nhân sự khớp với PasswordPolicy của backend (8–50 ký tự, có chữ và số, không khoảng trắng). */
function validateStaffPassword(raw: string): string | undefined {
  if (!raw || !isValidPassword(raw)) return PASSWORD_RULE_ERROR;
  return undefined;
}

/** Kiểm tra email nhân sự: bắt buộc, đúng định dạng (cảnh báo gõ nhầm @gmail.co) và không trùng tài khoản khác. */
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

/** Kiểm tra số điện thoại nhân sự (không bắt buộc): đúng 10 số và không trùng tài khoản khác. */
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

/** Màn quản lý tài khoản nhân sự (HLV, lễ tân): danh sách có sắp xếp, tạo tài khoản mới, khóa/mở khóa. */
export function StaffAccountsPage() {
  const { t } = useStaffI18n();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [sortOption, setSortOption] = useState<'name_asc' | 'name_desc'>('name_asc');
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; phone?: string; password?: string }>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<StaffMessage>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<StaffMessage>('');
  const [reload, setReload] = useState(0);

  // Danh sách tài khoản sau khi sắp xếp theo lựa chọn.
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      switch (sortOption) {
        case 'name_desc':
          return b.fullName.localeCompare(a.fullName, 'vi');
        case 'name_asc':
        default:
          return a.fullName.localeCompare(b.fullName, 'vi');
      }
    });
  }, [accounts, sortOption]);

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

  // Khóa hoặc mở khóa tài khoản sau khi xác nhận.
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

  // Tạo tài khoản nhân sự sau khi kiểm tra họ tên, email, số điện thoại và mật khẩu.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fullNameError = validateStaffName(form.fullName);
    const emailError = validateStaffEmail(form.email, accounts);
    const phoneError = validateStaffPhone(form.phone, accounts);
    const passwordError = validateStaffPassword(form.password);
    if (fullNameError || emailError || phoneError || passwordError) {
      setFieldErrors({ fullName: fullNameError, email: emailError, phone: phoneError, password: passwordError });
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
      <form onSubmit={event => void submit(event)} noValidate>
        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="portal-form-grid">
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="staff-name">{t("Họ và tên *")}</label>
              <input
                id="staff-name"
                className="portal-input"
                required
                minLength={2}
                maxLength={150}
                autoComplete="name"
                aria-invalid={!!fieldErrors.fullName}
                aria-describedby={fieldErrors.fullName ? 'staff-name-error' : undefined}
                value={form.fullName}
                onChange={e => {
                  const value = e.target.value;
                  setForm({ ...form, fullName: value });
                  if (fieldErrors.fullName) {
                    setFieldErrors(prev => ({ ...prev, fullName: validateStaffName(value) }));
                  }
                }}
                onBlur={() => {
                  if (form.fullName.length > 0 || fieldErrors.fullName) {
                    setFieldErrors(prev => ({ ...prev, fullName: validateStaffName(form.fullName) }));
                  }
                }}
              />
              {fieldErrors.fullName && (
                <p id="staff-name-error" role="alert" className="form-error">
                  {t(fieldErrors.fullName, 'Please enter full name (at least 2 characters).')}
                </p>
              )}
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
              <input
                id="staff-password"
                className="portal-input"
                type="password"
                required
                minLength={8}
                maxLength={50}
                autoComplete="new-password"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'staff-password-error' : 'staff-password-hint'}
                value={form.password}
                onChange={e => {
                  const value = e.target.value;
                  setForm({ ...form, password: value });
                  if (fieldErrors.password) {
                    setFieldErrors(prev => ({ ...prev, password: validateStaffPassword(value) }));
                  }
                }}
                onBlur={() => {
                  if (form.password.length > 0 || fieldErrors.password) {
                    setFieldErrors(prev => ({ ...prev, password: validateStaffPassword(form.password) }));
                  }
                }}
              />
              <small id="staff-password-hint" className="meta-label" style={{ display: 'block', marginTop: 4, color: 'var(--portal-muted)' }}>
                {t(PASSWORD_RULE_HINT, '8–50 characters, with letters and numbers, no spaces')}
              </small>
              {fieldErrors.password && (
                <p id="staff-password-error" role="alert" className="form-error">
                  {t(fieldErrors.password, 'Password must be 8–50 characters with at least 1 letter and 1 number, and no spaces.')}
                </p>
              )}
            </div>
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="staff-gender">{t("Giới tính *")}</label>
              <Select id="staff-gender" className="portal-select" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as StaffAccountInput['gender'] })}>
                <option value="male">{t("Nam")}</option><option value="female">{t("Nữ")}</option>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <h2 id="staff-list-heading" className="portal-card-title" style={{ margin: 0 }}>{t("Huấn luyện viên & Lễ tân", "Coaches & Receptionists")}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="staff-sort-select" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--portal-muted)' }}>
            {t("Sắp xếp:", "Sort:")}
          </label>
          <Select
            id="staff-sort-select"
            className="portal-select"
            value={sortOption}
            onChange={e => setSortOption(e.target.value as 'name_asc' | 'name_desc')}
            aria-label={t("Sắp xếp danh sách nhân sự", "Sort staff list")}
            data-testid="staff-sort-select"
          >
            <option value="name_asc">{t("Tên (A–Z)", "Name (A–Z)")}</option>
            <option value="name_desc">{t("Tên (Z–A)", "Name (Z–A)")}</option>
          </Select>
        </div>
      </div>
      {loading ? <LoadingSkeleton label={t("Đang tải tài khoản nhân sự")} variant="table" /> : loadError ? <div role="alert" className="portal-alert">
        {t(loadError)} <button className="btn-secondary" type="button" onClick={() => { setLoading(true); setReload(current => current + 1); }}>{t("Thử lại")}</button>
      </div> : sortedAccounts.length === 0 ? <p>{t("Chưa có tài khoản nhân sự.")}</p> : <div className="portal-table-wrapper">
        <table className="portal-table">
          <thead><tr><th scope="col">{t("Họ và tên")}</th><th scope="col">Email</th><th scope="col">{t("Vai trò")}</th><th scope="col">{t("Trạng thái")}</th><th scope="col">{t("Thao tác")}</th></tr></thead>
          <tbody>{sortedAccounts.map(account => <tr key={account.id}>
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
