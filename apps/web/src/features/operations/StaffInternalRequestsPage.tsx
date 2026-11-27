import { staffTranslation, staffMessage, useStaffI18n, type StaffMessage, staffError as errorMessage, staffNotify as notify } from './staffI18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Modal } from '../../shared/ui/Modal';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { Select } from '../../shared/ui/Select';
import {
  getMyStaffRequests,
  createStaffRequest,
  cancelStaffRequest,
  type StaffInternalRequestDto,
  type RequestType,
} from './staffRequestApi';
import { centerNowParts, formatCenterDate, formatCenterDateTime } from '../../shared/lib/centerTime';
import { ApiError } from '../../shared/api/client';
import { isOverdueLeave } from './staffRequestDates';

import { DatePicker } from '../../shared/ui/DatePicker';
const TYPE_LABELS: Record<RequestType, { label: string; bg: string; color: string }> = {
  LEAVE: { label: 'Xin nghỉ phép', bg: 'color-mix(in srgb, var(--portal-info) 12%, transparent)', color: 'var(--portal-info)' },
  SHIFT_EXCHANGE: { label: 'Đổi ca trực', bg: 'color-mix(in srgb, var(--portal-violet) 12%, transparent)', color: 'var(--portal-violet)' },
  SCHEDULE_CHANGE: { label: 'Đổi lịch dạy', bg: 'color-mix(in srgb, var(--portal-salmon) 15%, transparent)', color: 'var(--portal-salmon, var(--sol-accent))' },
  OTHER: { label: 'Đề xuất khác', bg: 'color-mix(in srgb, var(--portal-muted) 12%, transparent)', color: 'var(--portal-muted)' },
};

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING: { label: 'Chờ duyệt', bg: 'color-mix(in srgb, var(--portal-warning) 14%, transparent)', color: 'var(--portal-warning)' },
  APPROVED: { label: 'Đã duyệt', bg: 'color-mix(in srgb, var(--portal-success) 12%, transparent)', color: 'var(--portal-success)' },
  REJECTED: { label: 'Từ chối', bg: 'color-mix(in srgb, var(--portal-danger) 14%, transparent)', color: 'var(--portal-danger)' },
  CANCELLED: { label: 'Đã hủy', bg: 'color-mix(in srgb, var(--portal-muted) 15%, transparent)', color: 'var(--portal-muted)' },
};

/**
 * Màn nhân viên xem và gửi đơn từ của mình (nghỉ phép, đổi ca, đổi lịch...): lọc theo trạng thái, tạo đơn, hủy
 * đơn đang chờ.
 */
export function StaffInternalRequestsPage() {
  const { t } = useStaffI18n();
  const [confirm, confirmDialog] = useConfirm();
  const [requests, setRequests] = useState<StaffInternalRequestDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<StaffMessage>('');

  // Bộ lọc
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Hộp thoại tạo đơn mới
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createType, setCreateType] = useState<RequestType>('LEAVE');
  const [createTitle, setCreateTitle] = useState<string>('');
  const [createReason, setCreateReason] = useState<string>('');
  const [createStartDate, setCreateStartDate] = useState<string>('');
  const [createEndDate, setCreateEndDate] = useState<string>('');
  const [createTargetShift, setCreateTargetShift] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<StaffMessage>('');

  // Đơn đang thao tác hủy
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const todayDate = centerNowParts().date;
  const tomorrowDate = useMemo(() => {
    const [y, m, d] = todayDate.split('-').map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
    return tomorrow.toISOString().slice(0, 10);
  }, [todayDate]);
  // Nghỉ phép cần báo trước tối thiểu từ ngày mai; đổi ca / đổi lịch / đề xuất khác cho phép chọn ngay hôm nay.
  const minStartDate = createType === 'LEAVE' ? tomorrowDate : todayDate;

  // Tải đơn từ của chính người dùng.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyStaffRequests();
      setRequests(data);
    } catch (err: unknown) {
      setError((errorMessage(err, 'Không thể tải danh sách đơn từ của bạn.')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Đơn sau khi lọc theo trạng thái.
  const filteredRequests = useMemo(() => {
    if (statusFilter === 'ALL') return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  // Kiểm tra và gửi đơn mới; nghỉ phép trùng ngày thì hỏi xác nhận rồi mới gửi lại với confirmOverlap.
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!createTitle.trim()) {
      setFormError('Vui lòng nhập tiêu đề đơn.');
      return;
    }
    if (!createReason.trim()) {
      setFormError('Vui lòng nhập lý do cụ thể.');
      return;
    }
    if (createType === 'LEAVE' && (!createStartDate || !createEndDate)) {
      setFormError(staffMessage(
        'Đơn xin nghỉ phép bắt buộc phải chọn Ngày bắt đầu và Ngày kết thúc.',
        'A leave request requires both start date and end date.',
      ));
      return;
    }
    if (!createStartDate && createEndDate) {
      setFormError(staffMessage(
        'Vui lòng chọn Ngày bắt đầu khi đã nhập Ngày kết thúc.',
        'Please select a start date when an end date is provided.',
      ));
      return;
    }
    if (createStartDate && createEndDate && createEndDate < createStartDate) {
      setFormError(staffMessage(
        'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.',
        'End date cannot be earlier than start date.',
      ));
      return;
    }

    // Đọc lại ngày Việt Nam lúc gửi, không dùng ngày cũ khi mở trang qua nửa đêm.
    if (createType === 'LEAVE' && createStartDate <= centerNowParts().date) {
      setFormError(staffMessage('Ngày bắt đầu nghỉ phải từ ngày mai.', 'Leave must start tomorrow or later.'));
      return;
    }

    setSubmitting(true);
    setFormError('');
    const supportsShift = createType === 'SHIFT_EXCHANGE' || createType === 'SCHEDULE_CHANGE';
    // Dữ liệu đơn gửi lên backend.
    const payload = {
      requestType: createType,
      title: createTitle.trim(),
      reason: createReason.trim(),
      startDate: createStartDate || null,
      endDate: createEndDate || null,
      targetShift: supportsShift ? (createTargetShift.trim() || null) : null,
    };
    try {
      try {
        await createStaffRequest(payload);
      } catch (err: unknown) {
        // Đã có đơn nghỉ (chờ duyệt/đã duyệt) trùng ngày: hỏi lại trước khi gửi thêm đơn.
        if (!(err instanceof ApiError && err.code === 'LEAVE_OVERLAP')) throw err;
        const resend = await confirm({
          title: staffMessage('Đã có đơn nghỉ trùng ngày', 'Leave already requested for these days'),
          message: err.message,
          confirmLabel: staffMessage('Vẫn gửi đơn', 'Send anyway'),
          cancelLabel: staffMessage('Không gửi', 'Do not send'),
        });
        if (!resend) return;
        if (createType === 'LEAVE' && createStartDate <= centerNowParts().date) {
          setFormError(staffMessage('Ngày bắt đầu nghỉ phải từ ngày mai.', 'Leave must start tomorrow or later.'));
          return;
        }
        await createStaffRequest({ ...payload, confirmOverlap: true });
      }

      notify(staffMessage('Đã gửi đơn từ.', 'Request submitted.'), 'success');
      setShowCreateModal(false);
      resetForm();
      await loadData();
    } catch (err: unknown) {
      setFormError((errorMessage(err, 'Không thể gửi đơn từ. Vui lòng kiểm tra lại.')));
    } finally {
      setSubmitting(false);
    }
  }

  // Đặt lại biểu mẫu tạo đơn.
  function resetForm() {
    setCreateType('LEAVE');
    setCreateTitle('');
    setCreateReason('');
    setCreateStartDate('');
    setCreateEndDate('');
    setCreateTargetShift('');
    setFormError('');
  }

  // Hủy một đơn sau khi xác nhận, rồi tải lại danh sách.
  async function handleCancelRequest(id: number) {
    if (!(await confirm({ title: staffMessage('Hủy đơn từ?', staffTranslation('Hủy đơn từ?')), message: staffMessage('Đơn sẽ không còn được gửi tới quản lý để duyệt.', staffTranslation('Đơn sẽ không còn được gửi tới quản lý để duyệt.')), confirmLabel: staffMessage('Hủy đơn', staffTranslation('Hủy đơn')), cancelLabel: staffMessage('Giữ đơn', staffTranslation('Giữ đơn')), danger: true }))) return;
    setCancellingId(id);
    try {
      await cancelStaffRequest(id);
      notify(staffMessage('Đã hủy đơn thành công.', 'Request cancelled successfully.'), 'success');
      await loadData();
    } catch (err: unknown) {
      setError((errorMessage(err, 'Không thể hủy đơn từ.')));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div data-i18n-managed className="portal-container">
      <PageHeader
        title={t("Đơn từ nội bộ")}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RefreshButton label={t('Làm mới danh sách đơn từ', 'Refresh requests')} disabled={loading} onClick={() => void loadData()} />
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
            >
              {t("Tạo đơn từ mới")}
            </button>
          </div>
        }
      />

      {/* Lọc theo trạng thái */}
      <div className="filter-chips" role="group" aria-label={t("Lọc theo trạng thái")} style={{ marginBottom: 20 }}>
        {[
          { key: 'ALL', label: t('Tất cả', 'All') },
          { key: 'PENDING', label: t('Chờ duyệt', 'Pending') },
          { key: 'APPROVED', label: t('Đã duyệt', 'Approved') },
          { key: 'REJECTED', label: t('Từ chối', 'Rejected') },
          { key: 'CANCELLED', label: t('Đã hủy', 'Cancelled') },
        ].map((tab) => (
          <button data-i18n-managed
            key={tab.key}
            type="button"
            className={`filter-chip${statusFilter === tab.key ? ' is-active' : ''}`}
            aria-pressed={statusFilter === tab.key}
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div data-i18n-managed className="portal-alert" role="alert">
          <span>{t(error)}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn-secondary btn-sm" onClick={() => void loadData()}>{t('Thử lại', 'Retry')}</button>
            <button type="button" className="portal-icon-button" aria-label={t("Đóng")} onClick={() => setError('')}>✕</button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton label={t("Đang tải danh sách đơn từ...", "Loading requests...")} count={3} />
      ) : error ? null : filteredRequests.length === 0 ? (
        <EmptyState
          icon="file"
          title={requests.length > 0
            ? t('Không có đơn từ nào khớp bộ lọc hiện tại', 'No requests match the current filter')
            : t("Không có đơn từ nào trong danh sách", "No requests in this list")}
        />
      ) : (
        <div data-i18n-managed style={{ display: 'grid', gap: 16 }}>
          {filteredRequests.map((req) => {
            const typeInfo = TYPE_LABELS[req.requestType] || TYPE_LABELS.OTHER;
            const statusInfo = STATUS_LABELS[req.status] || STATUS_LABELS.PENDING;
            const isPending = req.status === 'PENDING';

            return (
              <div data-i18n-managed
                key={req.id}
                className="portal-card"
                style={{
                  padding: 24,
                  borderRadius: 16,
                  display: 'grid',
                  gap: 14,
                }}
              >
                {/* Hàng tiêu đề của thẻ */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 750,
                        background: typeInfo.bg,
                        color: typeInfo.color,
                      }}
                    >
                      {t(typeInfo.label)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--portal-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {t("Mã đơn #")}{req.id} {t(" • Ngày tạo:")}{' '}
                      {formatCenterDateTime(req.createdAt)}
                    </span>
                  </div>

                  <span
                    style={{
                      padding: '5px 12px',
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 750,
                      background: statusInfo.bg,
                      color: statusInfo.color,
                    }}
                  >
                    {t(statusInfo.label)}
                  </span>
                </div>

                {/* Tiêu đề & lý do */}
                {isOverdueLeave(req) && <p role="note" className="portal-alert portal-alert--info">{t('Quá hạn duyệt — tiếp tục đi làm theo lịch bình thường. Bạn vẫn có thể hủy đơn hoặc gửi đơn mới cho ngày hợp lệ khác.', 'Approval deadline passed — continue working your normal schedule. You can still cancel or submit a new request for another valid date.')}</p>}
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: 17, fontWeight: 800, color: 'var(--portal-paper)' }}>
                    {req.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--portal-muted)' }}>
                    {req.reason}
                  </p>
                </div>

                {/* Chi tiết phạm vi (ngày, ca mong muốn) */}
                {(req.startDate || req.targetShift || req.replacementUserFullName) && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 18,
                      background: 'var(--portal-raised)',
                      padding: '10px 16px',
                      borderRadius: 10,
                      fontSize: 13,
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--portal-paper)',
                    }}
                  >
                    {req.startDate && (
                      <div data-i18n-managed>
                        <strong style={{ color: 'var(--portal-muted)' }}>{t("Thời gian:")}</strong>{' '}
                        {formatCenterDate(req.startDate)}
                        {req.endDate && req.endDate !== req.startDate ? t(` đến ${formatCenterDate(req.endDate)}`, ` to ${formatCenterDate(req.endDate)}`) : ''}
                        {req.replacementUserFullName ? t(` · Thay thế: ${req.replacementUserFullName}`, ` · Substitute: ${req.replacementUserFullName}`) : ''}

                      </div>
                    )}

                    {req.targetShift && (
                      <div data-i18n-managed>
                        <strong style={{ color: 'var(--portal-muted)' }}>{t("Ca / Buổi liên quan:")}</strong>{' '}
                        {req.targetShift}
                      </div>
                    )}
                  </div>
                )}

                {/* Kết quả duyệt của quản lý */}
                {req.reviewedAt && (
                  <div data-i18n-managed
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      background:
                        req.status === 'APPROVED'
                          ? 'color-mix(in srgb, var(--portal-success) 8%, transparent)'
                          : 'color-mix(in srgb, var(--portal-danger) 8%, transparent)',
                      border: `1px solid ${req.status === 'APPROVED' ? 'color-mix(in srgb, var(--portal-success) 34%, transparent)' : 'color-mix(in srgb, var(--portal-danger) 34%, transparent)'}`,
                      fontSize: 13,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: req.status === 'APPROVED' ? 'var(--portal-success)' : 'var(--portal-danger)' }}>
                      {req.status === 'APPROVED' ? t('Quản lý chấp thuận') : t('Quản lý từ chối')} •{' '}
                      {t("Người duyệt: ")}{req.reviewedByName || t('Ban Quản Lý')} (
                      {formatCenterDate(req.reviewedAt)})
                    </div>
                    {req.managerNotes && (
                      <div data-i18n-managed style={{ marginTop: 4, color: 'var(--portal-paper)', fontStyle: 'italic' }}>
                        {t("Lời phê: \"")}{req.managerNotes}"
                      </div>
                    )}
                  </div>
                )}

                {/* Thao tác chân thẻ (nút Hủy khi đơn đang chờ duyệt) */}
                {isPending && (
                  <div data-i18n-managed style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 6 }}>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      disabled={cancellingId === req.id}
                      onClick={() => handleCancelRequest(req.id)}
                    >
                      {cancellingId === req.id ? t('Đang hủy...') : t('Hủy đơn từ này')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal tạo đơn từ mới */}
      {showCreateModal && (
        <Modal title={t("Tạo đơn từ & đề xuất mới")} onClose={() => setShowCreateModal(false)} busy={submitting}>
          <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gap: 16 }}>
            {formError && (
              <div data-i18n-managed className="portal-alert" role="alert">
                {t(formError)}
              </div>
            )}

            <div>
              <label htmlFor="internal-request-type" style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                {t("Loại đơn từ:")}</label>
              <Select
                id="internal-request-type"
                value={createType}
                onChange={(e) => {
                  const nextType = e.target.value as RequestType;
                  setCreateType(nextType);
                  if (nextType !== 'SHIFT_EXCHANGE' && nextType !== 'SCHEDULE_CHANGE') {
                    setCreateTargetShift('');
                  }
                }}
                style={{ width: '100%' }}
              >
                <option value="LEAVE">{t("Xin nghỉ phép", "Leave request")}</option>
                <option value="SHIFT_EXCHANGE">{t("Đổi ca làm việc", "Shift exchange")}</option>
                <option value="SCHEDULE_CHANGE">{t("Đổi lịch đứng lớp", "Class schedule change")}</option>
                <option value="OTHER">{t("Đề xuất công việc khác", "Other request")}</option>
              </Select>
            </div>

            <div>
              <label htmlFor="internal-request-title" style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                {t("Tiêu đề đơn:")}</label>
              <input
                id="internal-request-title"
                type="text"
                className="portal-input"
                placeholder={t("Ví dụ: Xin nghỉ phép cá nhân ngày 05/11, Đổi ca trực sáng...")}
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10 }}
              />
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div>
                <label htmlFor="internal-request-start" style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  {createType === 'LEAVE' ? t('Ngày bắt đầu nghỉ:') : t('Ngày áp dụng:')}
                </label>
                <DatePicker
                  id="internal-request-start"
                  value={createStartDate}
                  min={minStartDate}
                  onChange={(e) => setCreateStartDate(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="internal-request-end" style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  {createType === 'LEAVE' ? t('Ngày kết thúc nghỉ:') : t('Ngày kết thúc (tùy chọn):')}
                </label>
                <DatePicker
                  id="internal-request-end"
                  value={createEndDate}
                  min={createStartDate && createStartDate >= minStartDate ? createStartDate : minStartDate}
                  onChange={(e) => setCreateEndDate(e.target.value)}
                />
              </div>
            </div>

            {(createType === 'SHIFT_EXCHANGE' || createType === 'SCHEDULE_CHANGE') && (
              <div data-i18n-managed>
                <label htmlFor="internal-request-shift" style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  {t("Ca trực / Khung giờ dạy cần đổi:")}</label>
                <input data-i18n-managed
                  id="internal-request-shift"
                  type="text"
                  className="portal-input"
                  placeholder={t("Ví dụ: đổi Ca sáng sang Ca tối")}
                  value={createTargetShift}
                  onChange={(e) => setCreateTargetShift(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10 }}
                />
              </div>
            )}

            <div>
              <label htmlFor="internal-request-reason" style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                {t("Lý do & Nội dung chi tiết:")}</label>
              <textarea
                id="internal-request-reason"
                className="portal-textarea"
                rows={4}
                placeholder={t("Nêu rõ lý do, kế hoạch bàn giao hoặc người hỗ trợ thay thế...")}
                value={createReason}
                onChange={(e) => setCreateReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={submitting}
                onClick={() => setShowCreateModal(false)}
              >
                {t("Hủy")}</button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? t('Đang gửi đơn...') : t('Gửi đơn tới Quản Lý')}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}

