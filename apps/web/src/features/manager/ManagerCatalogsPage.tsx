import { staffLocale, staffTranslation, staffMessage, useStaffI18n, type StaffMessage, staffError as errorMessage, staffNotify as notify } from '../operations/staffI18n';
import { formatPrice } from '../../shared/lib/membershipPresentation';
import { Select } from '../../shared/ui/Select';
import { useCallback, useEffect, useState } from 'react';
import { catalogApi, type Discipline, type MembershipPackage, type Room } from './catalogApi';
import { Modal } from '../../shared/ui/Modal';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { PageHeader } from '../../shared/ui/PageHeader';
import './manager-catalog.css';

/** Ba tab danh mục: bộ môn, phòng tập và gói tập. */
type Tab = 'disciplines' | 'rooms' | 'packages';
/** Dữ liệu biểu mẫu dạng cặp khóa–chuỗi. */
type Form = Record<string, string>;

const ROOM_STATUS_LABEL = { available: 'Đang hoạt động', maintenance: 'Bảo trì', closed: 'Đã đóng' } as const;
const PACKAGE_TIER_LABEL: Record<string, StaffMessage> = {
  SILVER: staffMessage('Cơ bản (Silver)', 'Silver · Basic'),
  GOLD: staffMessage('Trung cấp (Gold)', 'Gold · Standard'),
  PLATINUM: staffMessage('Cao cấp (Platinum)', 'Platinum · VIP'),
};
const QUICK_PRICE_PRESETS = [199000, 299000, 549000, 599000, 799000, 1599000, 1990000, 2990000, 5990000];
const QUICK_DURATION_PRESETS = [
  { days: 90, vi: '3 tháng (90 ngày)', en: '3 months (90 days)' },
  { days: 180, vi: '6 tháng (180 ngày)', en: '6 months (180 days)' },
  { days: 270, vi: '9 tháng (270 ngày)', en: '9 months (270 days)' },
  { days: 365, vi: '12 tháng (365 ngày)', en: '12 months (365 days)' },
];
const ROOM_LOCATION_MAX_LENGTH = 150;

const vnd = formatPrice;

/** Xác định hạng gói: dùng tier khai báo nếu hợp lệ, không thì suy ra từ tên gói. */
function resolvePackageTier(pkg: { name?: string; tier?: string | null }): 'SILVER' | 'GOLD' | 'PLATINUM' {
  const explicit = pkg.tier?.trim().toUpperCase();
  if (explicit === 'SILVER' || explicit === 'GOLD' || explicit === 'PLATINUM') {
    return explicit;
  }
  const upper = (pkg.name ?? '').toUpperCase();
  if (upper.includes('PLATINUM') || upper.includes('VIP')) return 'PLATINUM';
  if (upper.includes('GOLD') || upper.includes('STANDARD')) return 'GOLD';
  return 'SILVER';
}

/** Màn quản lý danh mục của quản lý: thêm/sửa/xóa bộ môn, phòng tập và gói tập, đổi nhanh giá và trạng thái gói. */
export function ManagerCatalogsPage() {
  const { t } = useStaffI18n();
  const [confirm, confirmDialog] = useConfirm();
  const [tab, setTab] = useState<Tab>('disciplines');
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<StaffMessage>('');
  const [formError, setFormError] = useState<StaffMessage>('');
  const [quickPriceError, setQuickPriceError] = useState<StaffMessage>('');
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null);
  const [quickPricePkg, setQuickPricePkg] = useState<{ pkg: MembershipPackage; price: string } | null>(null);

  // Tải bộ môn, phòng và gói cùng lúc.
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [d, r, p] = await Promise.all([catalogApi.disciplines(), catalogApi.rooms(), catalogApi.packages()]);
      setDisciplines(d);
      setRooms(r);
      setPackages(p);
    } catch (err) {
      setLoadError(errorMessage(err, 'Không thể tải danh mục.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Chạy một thao tác ghi: tách lỗi modal khỏi lỗi tải trang để không hiện trùng 2 nơi và không ẩn bảng dữ liệu.
  const run = async (
    action: () => Promise<unknown>,
    successMsg: StaffMessage = 'Thao tác thành công!',
    errorTarget: 'form' | 'quickPrice' | 'toast' = 'toast',
  ) => {
    if (errorTarget === 'form') setFormError('');
    if (errorTarget === 'quickPrice') setQuickPriceError('');
    setIsSubmitting(true);
    try {
      await action();
      setEditing(null);
      setQuickPricePkg(null);
      await load();
      notify(successMsg, 'success');
    } catch (err) {
      const msg = errorMessage(err, 'Thao tác thất bại.');
      if (errorTarget === 'form') setFormError(msg);
      else if (errorTarget === 'quickPrice') setQuickPriceError(msg);
      else notify(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Biểu mẫu trống mặc định theo tab đang chọn.
  const emptyForm = (): Form =>
    tab === 'disciplines'
      ? { name: '', description: '' }
      : tab === 'rooms'
        ? { name: '', location: '', capacity: '10', status: 'available', tier: 'STANDARD' }
        : { name: '', description: '', price: '199000', durationDays: '90', classCreditLimit: '', status: 'active', tier: 'SILVER' };

  const nameMaxLength = tab === 'packages' ? 150 : 100;

  // Gửi biểu mẫu thêm/sửa theo tab hiện tại sau khi kiểm tra dữ liệu (trim & maxLength khớp backend).
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || isSubmitting) return;
    const { id, form: f } = editing;
    const isNew = id == null;
    setFormError('');

    const trimmedName = (f.name ?? '').trim();
    if (!trimmedName) {
      setFormError(staffMessage('Vui lòng nhập tên hiển thị.', 'Please enter a display name.'));
      return;
    }
    if (trimmedName.length > nameMaxLength) {
      setFormError(
        staffMessage(
          `Tên hiển thị tối đa ${nameMaxLength} ký tự.`,
          `Display name must be at most ${nameMaxLength} characters.`,
        ),
      );
      return;
    }

    if (tab === 'rooms') {
      const trimmedLocation = (f.location ?? '').trim();
      if (trimmedLocation.length > ROOM_LOCATION_MAX_LENGTH) {
        setFormError(
          staffMessage(
            `Vị trí / tầng tối đa ${ROOM_LOCATION_MAX_LENGTH} ký tự.`,
            `Location must be at most ${ROOM_LOCATION_MAX_LENGTH} characters.`,
          ),
        );
        return;
      }
      const parsedCap = Number(f.capacity);
      if (!Number.isInteger(parsedCap) || parsedCap < 1 || parsedCap > 200) {
        setFormError(
          staffMessage(
            'Sức chứa phòng phải là số nguyên từ 1 đến 200 người.',
            'Room capacity must be a whole number between 1 and 200.',
          ),
        );
        return;
      }
    }

    if (tab === 'packages') {
      const parsedPrice = Number(f.price);
      const parsedDuration = Number(f.durationDays);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        setFormError(staffMessage('Giá bán gói tập phải từ 0 đ trở lên.', 'Membership price must be 0 VND or higher.'));
        return;
      }
      const outOfRange = parsedDuration !== 3 && (parsedDuration < 90 || parsedDuration > 365);
      // Các gói hiện có giữ nguyên thời hạn đã lưu trừ khi được thay đổi; máy chủ sẽ kiểm tra quy tắc khi chỉnh sửa.
      if (!Number.isFinite(parsedDuration) || (isNew && outOfRange)) {
        setFormError(
          staffMessage(
            'Thời hạn gói tập phải từ 3 đến 12 tháng (90–365 ngày); chỉ gói trải nghiệm 3 ngày được ngắn hơn.',
            'Membership duration must be 3 to 12 months (90–365 days); only the 3-day trial can be shorter.',
          ),
        );
        return;
      }
    }

    void run(
      async () => {
        if (tab === 'disciplines') {
          return catalogApi.saveDiscipline(id, { name: trimmedName, description: (f.description ?? '').trim() });
        }
        if (tab === 'rooms') {
          const room = {
            name: trimmedName,
            location: (f.location ?? '').trim(),
            capacity: Number(f.capacity),
            status: f.status as Room['status'],
            tier: (f.tier as Room['tier']) || undefined,
          };
          return id == null ? catalogApi.createRoom(room) : catalogApi.updateRoom(id, room);
        }
        return catalogApi.savePackage(id, {
          name: trimmedName,
          description: (f.description ?? '').trim(),
          price: Number(f.price),
          durationDays: Number(f.durationDays),
          classCreditLimit: f.classCreditLimit === '' ? null : Number(f.classCreditLimit),
          status: (f.status as MembershipPackage['status']) || 'active',
          tier: (f.tier as MembershipPackage['tier']) || resolvePackageTier({ name: trimmedName }),
        });
      },
      isNew ? 'Đã thêm mới danh mục thành công!' : 'Đã cập nhật danh mục thành công!',
      'form',
    );
  };

  // Gửi giá mới của gói trong hộp đổi nhanh giá.
  const submitQuickPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPricePkg || isSubmitting) return;
    setQuickPriceError('');
    const nextPrice = Number(quickPricePkg.price);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      const msg = staffMessage('Giá bán không hợp lệ.', 'Invalid price.');
      setQuickPriceError(msg);
      return;
    }
    const p = quickPricePkg.pkg;
    void run(
      () =>
        catalogApi.savePackage(p.id, {
          name: p.name,
          description: p.description,
          price: nextPrice,
          durationDays: p.durationDays,
          classCreditLimit: p.classCreditLimit,
          status: p.status,
          tier: resolvePackageTier(p),
        }),
      staffMessage(`Đã cập nhật giá gói "${p.name}" thành ${vnd(nextPrice)}!`, `Updated membership "${p.name}" price to ${vnd(nextPrice)}!`),
      'quickPrice',
    );
  };

  // Mở hộp thêm/sửa với dữ liệu cho trước.
  const openEditor = (value: { id: number | null; form: Form }) => {
    setFormError('');
    setEditing(value);
  };

  // Xóa một mục sau khi xác nhận; mục đã được dùng sẽ bị backend từ chối.
  const remove = async (what: string, name: string, action: () => Promise<unknown>) => {
    const confirmed = await confirm({
      title: staffMessage(`Xóa ${what}?`, `Delete ${staffTranslation(what)}?`),
      message: staffMessage(`"${name}" sẽ bị xóa vĩnh viễn. Nếu đã được sử dụng, hệ thống sẽ từ chối và bạn nên chuyển sang trạng thái ngừng dùng.`, `"${name}" will be permanently deleted. If it is already in use, the system will reject deletion; disable it instead.`),
      confirmLabel: staffMessage('Xóa', staffTranslation('Xóa')),
      danger: true,
    });
    if (confirmed) void run(action, staffMessage(`Đã xóa ${what} "${name}".`, `Deleted ${staffTranslation(what)} "${name}".`));
  };

  // Đổi một trường của biểu mẫu và xóa lỗi cũ.
  const set = (key: string, value: string) => {
    setFormError('');
    if (editing) setEditing({ ...editing, form: { ...editing.form, [key]: value } });
  };

  // Tăng/giảm giá trong biểu mẫu (không âm).
  const adjustFormPrice = (delta: number) => {
    if (!editing) return;
    const current = Number(editing.form.price) || 0;
    const next = Math.max(0, current + delta);
    set('price', String(next));
  };

  // Tiêu đề hộp thoại theo tab và thêm/sửa.
  const modalTitle = () => {
    if (!editing) return '';
    const isNew = editing.id == null;
    if (tab === 'disciplines') return isNew ? 'Thêm bộ môn' : 'Chỉnh sửa bộ môn';
    if (tab === 'rooms') return isNew ? 'Thêm phòng tập' : 'Chỉnh sửa phòng tập';
    return isNew ? 'Tạo gói tập mới' : 'Chỉnh sửa gói tập & giá bán';
  };

  const rowCount = tab === 'disciplines' ? disciplines.length : tab === 'rooms' ? rooms.length : packages.length;

  return (
    <div data-i18n-managed className="portal-container">
      <PageHeader
        title={t("Danh mục vận hành")}
        actions={(
          <div style={{ display: 'flex', gap: 10 }}>
            <button data-i18n-managed
              type="button"
              className="btn-primary"
              onClick={() => openEditor({ id: null, form: emptyForm() })}
            >
              {tab === 'packages' ? t('Tạo gói tập mới', 'Create membership plan') : t('Thêm mới', 'Add new')}
            </button>
          </div>
        )}
      />

      <div className="portal-tabs" role="tablist" aria-label={t('Danh mục vận hành', 'Operational catalogs')}>
        {(
          [
            ['disciplines', t('Bộ môn', 'Disciplines'), disciplines.length],
            ['rooms', t('Phòng tập', 'Rooms'), rooms.length],
            ['packages', t('Gói tập', 'Memberships'), packages.length],
          ] as const
        ).map(([key, label, count]) => (
          <button data-i18n-managed
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`portal-tab ${tab === key ? 'active' : ''}`}
            onClick={() => {
              setTab(key);
              setEditing(null);
            }}
          >
            {label}
            <span className="portal-tab-count">{count}</span>
          </button>
        ))}
      </div>

      {loadError && (
        <div
          data-i18n-managed
          className="portal-alert portal-alert--error"
          role="alert"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}
        >
          <span>{t(loadError)}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => void load()}>
            {t("Thử lại", "Retry")}
          </button>
        </div>
      )}

      {/* Hộp thoại sửa giá nhanh */}
      {quickPricePkg && (
        <Modal
          title={t(`Sửa giá nhanh: ${quickPricePkg.pkg.name}`, `Quick price edit: ${quickPricePkg.pkg.name}`)}
          busy={isSubmitting}
          onClose={() => {
            if (!isSubmitting) {
              setQuickPricePkg(null);
              setQuickPriceError('');
            }
          }}
        >
          <form onSubmit={submitQuickPrice} style={{ display: 'grid', gap: 14 }} noValidate>
            {quickPriceError && <p role="alert" className="portal-alert portal-alert--error">{t(quickPriceError)}</p>}
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="quick-pkg-price">
                {t("Giá bán mới (VNĐ) *")}</label>
              <input
                id="quick-pkg-price"
                className="portal-input"
                type="number"
                min="0"
                step="1000"
                required
                autoFocus
                value={quickPricePkg.price}
                onChange={(e) => setQuickPricePkg({ ...quickPricePkg, price: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_PRICE_PRESETS.map((preset) => (
                <button data-i18n-managed
                  key={preset}
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setQuickPricePkg({ ...quickPricePkg, price: String(preset) })}
                >
                  {vnd(preset)}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[-100000, -50000, -10000, 10000, 50000, 100000].map((delta) => (
                <button data-i18n-managed
                  key={delta}
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    const current = Number(quickPricePkg.price) || 0;
                    setQuickPricePkg({ ...quickPricePkg, price: String(Math.max(0, current + delta)) });
                  }}
                >
                  {delta > 0 ? `+${(delta / 1000).toLocaleString(staffLocale())}k` : `${(delta / 1000).toLocaleString(staffLocale())}k`}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isSubmitting}
                onClick={() => setQuickPricePkg(null)}
              >
                {t("Hủy")}</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? t('Đang lưu...') : t('Lưu giá mới')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Hộp thoại thêm/chỉnh sửa hỗ trợ truy cập */}
      {editing && (
        <Modal title={t(modalTitle())} busy={isSubmitting} onClose={() => !isSubmitting && setEditing(null)}>
          <form onSubmit={submit} style={{ display: 'grid', gap: 14 }} noValidate>
            {formError && <p role="alert" className="portal-alert portal-alert--error">{t(formError)}</p>}
            <div className="portal-form-group">
              <label className="portal-label" htmlFor="cat-name">{t("Tên hiển thị *")}</label>
              <input
                id="cat-name"
                className="portal-input"
                type="text"
                maxLength={nameMaxLength}
                required
                autoFocus
                placeholder={tab === 'packages' ? t('Vd: SILVER, GOLD 3 THÁNG, PLATINUM VIP...', 'e.g. SILVER, GOLD 3 MONTHS, PLATINUM VIP...') : t('Vd: Gym, Boxing, Yoga...', 'e.g. Gym, Boxing, Yoga...')}
                value={editing.form.name ?? ''}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>

            {tab === 'rooms' && (
              <>
                <div data-i18n-managed className="portal-form-group">
                  <label className="portal-label" htmlFor="cat-location">{t("Vị trí / tầng")}</label>
                  <input data-i18n-managed
                    id="cat-location"
                    className="portal-input"
                    type="text"
                    maxLength={ROOM_LOCATION_MAX_LENGTH}
                    placeholder={t("Vd: Tầng 2, Khu Đông", "e.g. Floor 2, East Wing")}
                    value={editing.form.location ?? ''}
                    onChange={(e) => set('location', e.target.value)}
                  />
                </div>
                <div data-i18n-managed className="portal-form-group">
                  <label className="portal-label" htmlFor="cat-capacity">{t("Sức chứa tối đa (người) *")}</label>
                  <input data-i18n-managed
                    id="cat-capacity"
                    className="portal-input"
                    type="number"
                    min="1"
                    max="200"
                    required
                    value={editing.form.capacity ?? ''}
                    onChange={(e) => set('capacity', e.target.value)}
                  />
                </div>
              </>
            )}

            {tab === 'packages' && (
              <div data-i18n-managed className="portal-form-group">
                <label className="portal-label" htmlFor="cat-package-tier">{t("Hạng gói tập", "Membership tier")}</label>
                <Select
                  id="cat-package-tier"
                  className="portal-select"
                  value={editing.form.tier || resolvePackageTier({ name: editing.form.name })}
                  onChange={(e) => set('tier', e.target.value)}
                >
                  <option value="SILVER">{t("Silver · Cơ bản", "Silver · Basic")}</option>
                  <option value="GOLD">{t("Gold · Trung cấp", "Gold · Standard")}</option>
                  <option value="PLATINUM">{t("Platinum · VIP Cao cấp", "Platinum · VIP")}</option>
                </Select>
              </div>
            )}

            {tab === 'packages' && (
              <>
                <div data-i18n-managed className="grid-2">
                  <div className="portal-form-group">
                    <label className="portal-label" htmlFor="cat-price">{t("Đơn giá (VND) *")}</label>
                    <input
                      id="cat-price"
                      className="portal-input"
                      type="number"
                      min="0"
                      step="1000"
                      required
                      placeholder={t("Vd: 199000", "e.g. 199000")}
                      value={editing.form.price ?? ''}
                      onChange={(e) => set('price', e.target.value)}
                    />
                  </div>
                  <div className="portal-form-group">
                    <label className="portal-label" htmlFor="cat-duration">{t("Thời hạn (ngày) *")}</label>
                    <input
                      id="cat-duration"
                      className="portal-input"
                      type="number"
                      min="3"
                      max="365"
                      required
                      placeholder={t("Vd: 90", "e.g. 90")}
                      value={editing.form.durationDays ?? ''}
                      onChange={(e) => set('durationDays', e.target.value)}
                    />
                  </div>
                </div>

                <div data-i18n-managed style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--portal-muted)' }}>{t("Chọn nhanh giá:")}</span>
                  {QUICK_PRICE_PRESETS.slice(0, 6).map((preset) => (
                    <button data-i18n-managed
                      key={preset}
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => set('price', String(preset))}
                    >
                      {vnd(preset)}
                    </button>
                  ))}
                  <button type="button" className="btn-secondary btn-sm" onClick={() => adjustFormPrice(-50000)}>
                    -50k
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => adjustFormPrice(50000)}>
                    +50k
                  </button>
                </div>

                <div data-i18n-managed style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--portal-muted)' }}>{t("Chọn nhanh kỳ hạn:")}</span>
                  {QUICK_DURATION_PRESETS.map((preset) => (
                    <button data-i18n-managed
                      key={preset.days}
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => set('durationDays', String(preset.days))}
                    >
                      {t(preset.vi, preset.en)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {tab === 'packages' && (
              <div data-i18n-managed className="portal-form-group">
                <label className="portal-label" htmlFor="cat-credit">
                  {t("Số buổi lớp kèm theo (để trống = không giới hạn)")}</label>
                <input data-i18n-managed
                  id="cat-credit"
                  className="portal-input"
                  type="number"
                  min="0"
                  placeholder={t("Vd: 2, 5, 15 hoặc để trống (không giới hạn)")}
                  value={editing.form.classCreditLimit ?? ''}
                  onChange={(e) => set('classCreditLimit', e.target.value)}
                />
              </div>
            )}

            {(
              <div data-i18n-managed className="portal-form-group">
                <label className="portal-label" htmlFor="cat-desc">
                  {tab === 'packages' ? t('Mô tả & Quyền lợi chi tiết trong gói') : t('Mô tả chi tiết')}
                </label>
                <textarea data-i18n-managed
                  id="cat-desc"
                  className="portal-textarea"
                  rows={tab === 'packages' ? 6 : 3}
                  placeholder={
                    tab === 'packages'
                      ? t('Nhập chi tiết từng quyền lợi của gói tập (mỗi dòng một quyền lợi)...')
                      : t('Mô tả công năng hoặc quyền lợi...')
                  }
                  value={editing.form.description ?? ''}
                  onChange={(e) => set('description', e.target.value)}
                />
              </div>
            )}

            {tab !== 'disciplines' && (
              <div data-i18n-managed className="portal-form-group">
                <label className="portal-label" htmlFor="cat-status">{t("Trạng thái vận hành")}</label>
                <Select
                  id="cat-status"
                  className="portal-select"
                  value={editing.form.status}
                  onChange={(e) => set('status', e.target.value)}
                >
                  {tab === 'rooms' ? (
                    <>
                      <option data-i18n-managed value="available">{t("Đang hoạt động")}</option>
                      <option data-i18n-managed value="maintenance">{t("Bảo trì")}</option>
                      <option data-i18n-managed value="closed">{t("Đã đóng")}</option>
                    </>
                  ) : (
                    <>
                      <option data-i18n-managed value="active">{t("Đang bán")}</option>
                      <option data-i18n-managed value="inactive">{t("Ngừng bán")}</option>
                    </>
                  )}
                </Select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isSubmitting}
                onClick={() => setEditing(null)}
              >
                {t("Hủy")}</button>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span data-i18n-managed className="spinner" />
                    <span data-i18n-managed>{t("Đang lưu...")}</span>
                  </>
                ) : (
                  t('Lưu thay đổi')
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {loading ? (
        <div data-i18n-managed className="portal-card" aria-busy="true">
          <div style={{ display: 'grid', gap: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div data-i18n-managed key={n} className="portal-skeleton" style={{ height: 52, borderRadius: 8 }} />
            ))}
          </div>
        </div>
      ) : loadError ? null : rowCount === 0 ? (
        <div data-i18n-managed className="portal-card">
          <div className="portal-state">
            <h3 className="portal-state__title">
              {tab === 'disciplines' && t('Chưa có bộ môn nào')}
              {tab === 'rooms' && t('Chưa có cơ sở phòng tập nào')}
              {tab === 'packages' && t('Chưa có gói hội viên nào')}
            </h3>
            {tab !== 'rooms' && (
              <>
                <p style={{ color: 'var(--portal-muted)' }}>
                  {t("Hãy nhấn nút thêm để cấu hình danh mục phục vụ vận hành.")}</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => openEditor({ id: null, form: emptyForm() })}
                >
                  {tab === 'packages' ? t('Tạo gói tập mới', 'Create membership plan') : t('Thêm mới', 'Add new')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div data-i18n-managed className="portal-card portal-card--flush">
          <div className="portal-table-wrapper">
            <table className="portal-table manager-catalog-table" style={tab === 'packages' ? { tableLayout: 'fixed', minWidth: 1400 } : undefined}>
              {tab === 'packages' && <colgroup><col style={{ width: '25%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '9%' }} /><col style={{ width: '9%' }} /><col style={{ width: '10%' }} /><col style={{ width: '27%' }} /></colgroup>}
              {tab === 'disciplines' && (
                <>
                  <thead data-i18n-managed>
                    <tr>
                      <th style={{ width: '25%' }}>{t("Tên bộ môn")}</th>
                      <th>{t("Mô tả")}</th>
                      <th className="actions" style={{ width: '200px' }}>{t("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody data-i18n-managed>
                    {disciplines.map((d) => (
                      <tr data-i18n-managed key={d.id}>
                        <td><strong>{d.name}</strong></td>
                        <td style={{ color: 'var(--portal-muted)' }}>{d.description || <span className="muted">{t("Không có mô tả")}</span>}</td>
                        <td className="actions" style={{ whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => openEditor({ id: d.id, form: { name: d.name, description: d.description ?? '' } })}
                          >
                            {t("Chỉnh sửa")}</button>
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            style={{ marginLeft: 8 }}
                            disabled={isSubmitting}
                            onClick={() => void remove('bộ môn', d.name, () => catalogApi.deleteDiscipline(d.id))}
                          >
                            {t("Xóa")}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {tab === 'rooms' && (
                <>
                  <thead data-i18n-managed>
                    <tr>
                      <th>{t("Phòng tập")}</th>
                      <th>{t("Vị trí")}</th>
                      <th>{t("Sức chứa")}</th>
                      <th>{t("Trạng thái")}</th>
                      <th className="actions">{t("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody data-i18n-managed>
                    {rooms.map((r) => {
                      return (
                      <tr data-i18n-managed key={r.id}>
                        <td><strong>{r.name}</strong></td>
                        <td>{r.location || <span className="muted">—</span>}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}><strong>{r.capacity} {t("người", "people")}</strong></td>
                        <td>
                          <span className={`badge ${r.status === 'available' ? 'badge-success' : 'badge-warning'}`}>
                            {t(ROOM_STATUS_LABEL[r.status]) || r.status}
                          </span>
                        </td>
                        <td className="actions" style={{ whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() =>
                              openEditor({
                                id: r.id,
                                form: { name: r.name, location: r.location ?? '', capacity: String(r.capacity), status: r.status, tier: r.tier ?? '' },
                              })
                            }
                          >
                            {t("Chỉnh sửa")}</button>
                          <button type="button" className="btn-danger btn-sm" style={{ marginLeft: 8 }}
                            disabled={isSubmitting} onClick={() => void remove('phòng tập', r.name, () => catalogApi.deleteRoom(r.id))}>
                            {t('Xóa', 'Delete')}
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </>
              )}

              {tab === 'packages' && (
                <>
                  <thead data-i18n-managed>
                    <tr>
                      <th>{t("Tên gói & Quyền lợi")}</th>
                      <th>{t("Hạng gói")}</th>
                      <th>{t("Giá gói")}</th>
                      <th>{t("Thời hạn")}</th>
                      <th>{t("Số buổi lớp")}</th>
                      <th>{t("Trạng thái")}</th>
                      <th className="actions">{t("Thao tác")}</th>
                    </tr>
                  </thead>
                  <tbody data-i18n-managed>
                    {packages.map((p) => {
                      const tier = resolvePackageTier(p);
                      return (
                        <tr data-i18n-managed key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                            {p.description && (
                              <div data-i18n-managed className="muted" style={{ whiteSpace: 'pre-line', maxHeight: 72, overflow: 'hidden' }}>
                                {p.description}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-neutral">
                              {t(PACKAGE_TIER_LABEL[tier]) || tier}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--portal-salmon)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {vnd(p.price)}
                          </td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{p.durationDays} {t("ngày", "days")}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{p.classCreditLimit ?? t('Không giới hạn')}</td>
                          <td>
                            <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                              {p.status === 'active' ? t('Đang bán') : t('Ngừng bán')}
                            </span>
                          </td>
                          <td className="actions" style={{ whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => {
                                setQuickPriceError('');
                                setQuickPricePkg({ pkg: p, price: String(p.price) });
                              }}
                            >
                              {t("Sửa giá nhanh")}</button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() =>
                                openEditor({
                                  id: p.id,
                                  form: {
                                    name: p.name,
                                    description: p.description ?? '',
                                    price: String(p.price),
                                    durationDays: String(p.durationDays),
                                    classCreditLimit: p.classCreditLimit == null ? '' : String(p.classCreditLimit),
                                    status: p.status,
                                    tier,
                                  },
                                })
                              }
                            >
                              {t("Sửa")}</button>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={async () => {
                                const nextStatus = p.status === 'active' ? 'inactive' : 'active';
                                const label = nextStatus === 'active' ? 'mở bán' : 'ngừng bán';
                                const confirmed = await confirm({
                                  title: nextStatus === 'active' ? staffMessage('Mở bán gói tập?', staffTranslation('Mở bán gói tập?')) : staffMessage('Ngừng bán gói tập?', staffTranslation('Ngừng bán gói tập?')),
                                  message: nextStatus === 'active'
                                    ? staffMessage(`Gói "${p.name}" sẽ hiển thị lại cho hội viên đăng ký.`, `Membership "${p.name}" will be available for members to register again.`)
                                    : staffMessage(`Hội viên sẽ không đăng ký mới được gói "${p.name}". Gói đang dùng không bị ảnh hưởng.`, `Members will not be able to register for membership "${p.name}". Existing memberships are unaffected.`),
                                  confirmLabel: nextStatus === 'active' ? staffMessage('Mở bán', staffTranslation('Mở bán')) : staffMessage('Ngừng bán', staffTranslation('Ngừng bán')),
                                  danger: nextStatus !== 'active',
                                });
                                if (confirmed) {
                                  void run(
                                    () => catalogApi.setPackageStatus(p.id, nextStatus),
                                    staffMessage(`Đã chuyển gói "${p.name}" sang ${label}.`, `Changed membership "${p.name}" to ${staffTranslation(label)}.`)
                                  );
                                }
                              }}
                            >
                              {p.status === 'active' ? t('Ngừng bán') : t('Mở bán')}
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-sm"
                              style={{ marginLeft: 8 }}
                              disabled={isSubmitting}
                              onClick={() => void remove('gói tập', p.name, () => catalogApi.deletePackage(p.id))}
                            >
                              {t("Xóa")}</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
