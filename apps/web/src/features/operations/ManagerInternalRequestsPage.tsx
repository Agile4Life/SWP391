import { useStaffI18n, type StaffMessage, staffMessage, staffError as errorMessage, staffNotify as notify } from './staffI18n';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Modal } from '../../shared/ui/Modal';
import { Select } from '../../shared/ui/Select';
import { RefreshButton } from '../../shared/ui/RefreshButton';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { ApiError } from '../../shared/api/client';
import { getSupportInbox } from '../member/memberSupportApi';
import {
  getAllStaffRequests,
  reviewStaffRequest,
  type StaffInternalRequestDto,
  type RequestType,
} from './staffRequestApi';

const StaffSupportChat = lazy(() =>
  import('../chat/StaffSupportChat').then((module) => ({ default: module.StaffSupportChat })),
);
import { formatCenterDate, formatCenterDateTime } from '../../shared/lib/centerTime';
import { isOverdueLeave } from './staffRequestDates';

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

const ROLE_DISPLAY: Record<string, { label: string; bg: string; color: string }> = {
  COACH: { label: 'Huấn luyện viên', bg: 'color-mix(in srgb, var(--portal-salmon) 15%, transparent)', color: 'var(--portal-salmon, var(--sol-accent))' },
  STAFF: { label: 'Nhân viên lễ tân', bg: 'color-mix(in srgb, var(--portal-info) 12%, transparent)', color: 'var(--portal-info)' },
  RECEPTIONIST: { label: 'Lễ tân quầy', bg: 'color-mix(in srgb, var(--portal-info) 12%, transparent)', color: 'var(--portal-info)' },
};

/**
 * Màn quản lý duyệt đơn từ nội bộ của nhân sự: lọc theo trạng thái và loại, đếm đơn chờ, duyệt hoặc từ chối kèm
 * ghi chú (từ chối bắt buộc có lý do).
 */
export function ManagerInternalRequestsPage() {
  const { t } = useStaffI18n();
  const inRouter = useInRouterContext();
  const [confirm, confirmDialog] = useConfirm();
  const [activeTab, setActiveTab] = useState<'internal' | 'complaints'>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'complaints' ? 'complaints' : 'internal',
  );
  const [complaintsUnread, setComplaintsUnread] = useState(0);
  const [requests, setRequests] = useState<StaffInternalRequestDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<StaffMessage>('');

  // Bộ lọc
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Hộp thoại duyệt đơn
  const [reviewTarget, setReviewTarget] = useState<StaffInternalRequestDto | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [managerNotes, setManagerNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<StaffMessage>('');

  // Tải toàn bộ đơn từ của nhân sự.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllStaffRequests();
      setRequests(data);
    } catch (err: unknown) {
      setError((errorMessage(err, 'Không thể tải danh sách đơn từ nhân sự.')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    let active = true;
    void getSupportInbox(0, '', false)
      .then((res) => {
        if (active) setComplaintsUnread(res.content.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [loadData]);

  // Số đơn đang chờ duyệt.
  const pendingCount = useMemo(() => {
    return requests.filter((r) => r.status === 'PENDING').length;
  }, [requests]);

  // Đơn sau khi lọc theo trạng thái, loại và nội dung tìm kiếm.
  const filteredRequests = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return requests.filter((r) => {
      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const matchType = typeFilter === 'ALL' || r.requestType === typeFilter;
      const matchSearch = !query || [r.userFullName, r.userEmail, r.title].some(value => value?.toLocaleLowerCase('vi').includes(query));
      return matchStatus && matchType && matchSearch;
    });
  }, [requests, statusFilter, typeFilter, search]);

  // Mở hộp duyệt đơn với ghi chú mặc định theo ngôn ngữ hiện tại.
  function handleOpenApprove(r: StaffInternalRequestDto) {
    setReviewTarget(r);
    setReviewAction('APPROVED');
    setManagerNotes(t('Đã xem xét và chấp thuận.', 'Reviewed and approved.'));
    setModalError('');
  }

  // Mở hộp từ chối đơn (ghi chú để trống, bắt buộc nhập).
  function handleOpenReject(r: StaffInternalRequestDto) {
    setReviewTarget(r);
    setReviewAction('REJECTED');
    setManagerNotes('');
    setModalError('');
  }

  // Gửi kết quả duyệt/từ chối: từ chối cần lý do; duyệt đơn nghỉ HLV kiểm tra xung đột lịch dạy/PT trước khi chốt.
  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewTarget) return;

    if (reviewAction === 'APPROVED' && isOverdueLeave(reviewTarget)) {
      setModalError(staffMessage('Quá hạn duyệt đơn nghỉ. Nhân viên tiếp tục đi làm theo lịch bình thường.', 'Leave approval deadline passed. The staff member continues working their normal schedule.'));
      return;
    }

    if (reviewAction === 'REJECTED' && !managerNotes.trim()) {
      setModalError(staffMessage(
        'Vui lòng nhập lý do từ chối đơn để nhân viên nắm rõ.',
        'Please enter a rejection reason so the staff member understands.',
      ));
      return;
    }

    const isCoachLeaveApproval = reviewAction === 'APPROVED'
      && reviewTarget.requestType === 'LEAVE'
      && reviewTarget.userRole === 'COACH';
    const notes = managerNotes.trim() || undefined;
    const staffDisplayName = reviewTarget.userFullName || t('nhân sự', 'staff member');

    setSubmitting(true);
    setModalError('');
    try {
      let reviewed: StaffInternalRequestDto;
      try {
        reviewed = await reviewStaffRequest(reviewTarget.id, {
          status: reviewAction,
          managerNotes: notes,
          ...(isCoachLeaveApproval ? { confirmConflicts: false } : {}),
        });
      } catch (err: unknown) {
        if (!(isCoachLeaveApproval && err instanceof ApiError && err.code === 'COACH_LEAVE_HAS_CONFLICTS')) {
          throw err;
        }
        const proceed = await confirm({
          title: staffMessage('HLV có lịch dạy trùng thời gian nghỉ', 'Coach has scheduled sessions during leave'),
          message: err.message,
          confirmLabel: staffMessage('Vẫn phê duyệt', 'Approve anyway'),
          cancelLabel: staffMessage('Kiểm tra lại', 'Review again'),
          danger: true,
        });
        if (!proceed) return;
        reviewed = await reviewStaffRequest(reviewTarget.id, {
          status: 'APPROVED',
          managerNotes: notes,
          confirmConflicts: true,
        });
      }

      const affectedClasses = reviewed?.affectedClassSessionCount ?? 0;
      const affectedPt = reviewed?.affectedPtSessionCount ?? 0;
      const hasImpact = affectedClasses > 0 || affectedPt > 0;
      notify(
        reviewAction === 'APPROVED'
          ? hasImpact
            ? staffMessage(
                `Đã phê duyệt đơn của ${staffDisplayName}. Lưu ý: cần sắp xếp người dạy thay cho ${[
                  affectedClasses > 0 ? `${affectedClasses} buổi lớp nhóm` : '',
                  affectedPt > 0 ? `${affectedPt} buổi PT 1:1` : '',
                ].filter(Boolean).join(' và ')}.`,
                `Approved request from ${staffDisplayName}. Note: find a substitute coach for ${[
                  affectedClasses > 0 ? `${affectedClasses} group class session(s)` : '',
                  affectedPt > 0 ? `${affectedPt} 1:1 PT session(s)` : '',
                ].filter(Boolean).join(' and ')}.`,
              )
            : staffMessage(`Đã phê duyệt đơn của ${staffDisplayName} thành công!`, `Approved request from ${staffDisplayName} successfully!`)
          : staffMessage(`Đã từ chối đơn của ${staffDisplayName}.`, `Rejected request from ${staffDisplayName}.`),
        'success',
      );
      window.dispatchEvent(new Event('member-notifications-changed'));
      setReviewTarget(null);
      await loadData();
    } catch (err: unknown) {
      setModalError(errorMessage(err, 'Không thể xử lý đơn từ. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-i18n-managed className="portal-container">
      {inRouter && <ComplaintsTabSync onOpen={() => setActiveTab('complaints')} />}
      <PageHeader
        title={t('Đơn từ & Khiếu nại', 'Requests & Tickets')}
        actions={
          activeTab === 'internal' ? (
            <RefreshButton label={t('Làm mới danh sách đơn từ', 'Refresh requests')} disabled={loading} onClick={() => void loadData()} />
          ) : undefined
        }
      />

      {/* Hai tab chính: Đơn từ nội bộ và Khiếu nại chuyển lên */}
      <div className="portal-tabs" role="tablist" aria-label={t('Phân mục xử lý', 'Management sections')} style={{ marginBottom: 20 }}>
        <button
          data-i18n-managed
          type="button"
          role="tab"
          aria-selected={activeTab === 'internal'}
          className={`portal-tab ${activeTab === 'internal' ? 'active' : ''}`}
          onClick={() => setActiveTab('internal')}
        >
          <span>{t('Đơn từ nội bộ', 'Internal requests')}</span>
          {pendingCount > 0 && (
            <span data-i18n-managed className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          data-i18n-managed
          type="button"
          role="tab"
          aria-selected={activeTab === 'complaints'}
          className={`portal-tab ${activeTab === 'complaints' ? 'active' : ''}`}
          onClick={() => setActiveTab('complaints')}
        >
          <span>{t('Khiếu nại chuyển lên', 'Escalated tickets')}</span>
          {complaintsUnread > 0 && (
            <span data-i18n-managed className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {complaintsUnread}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'complaints' ? (
        <Suspense fallback={<LoadingSkeleton label={t('Đang tải khiếu nại…', 'Loading tickets…')} count={4} />}>
          <StaffSupportChat
            manager
            split
            onBack={() => setActiveTab('internal')}
            onUnreadCountChange={setComplaintsUnread}
          />
        </Suspense>
      ) : (
        <>
          {/* Thanh bộ lọc và điều khiển */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          background: 'var(--portal-surface)',
          padding: '16px 20px',
          borderRadius: 16,
          border: '1px solid var(--portal-border)',
          marginBottom: 24,
        }}
      >
        <input
          type="search"
          className="portal-input"
          aria-label={t('Tìm đơn nội bộ', 'Search internal requests')}
          placeholder={t('Tìm nhân sự hoặc tiêu đề', 'Search staff or subject')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: '1 1 240px', minWidth: 180, maxWidth: 320 }}
        />
        {/* Các tab trạng thái */}
        <div className="portal-tabs" role="tablist" aria-label={t("Lọc trạng thái đơn nội bộ", "Filter internal request status")} style={{ marginBottom: 0 }}>
          {[
            { key: 'PENDING', label: t('Chờ duyệt', 'Pending'), count: pendingCount },
            { key: 'APPROVED', label: t('Đã duyệt', 'Approved') },
            { key: 'REJECTED', label: t('Từ chối', 'Rejected') },
            { key: 'ALL', label: t('Tất cả', 'All') },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button data-i18n-managed
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`portal-tab ${isActive ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab.key)}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span data-i18n-managed className="portal-tab-count" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bộ lọc loại đơn */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <label htmlFor="manager-request-type-filter" style={{ fontSize: 13, fontWeight: 700, color: 'var(--portal-paper)' }}>{t("Loại đơn:")}</label>
          <Select
            id="manager-request-type-filter"
            aria-label={t('Lọc theo loại đơn', 'Filter by request type')}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="ALL">{t("Tất cả loại đơn")}</option>
            <option value="LEAVE">{t("Xin nghỉ phép")}</option>
            <option value="SHIFT_EXCHANGE">{t("Đổi ca trực")}</option>
            <option value="SCHEDULE_CHANGE">{t("Đổi lịch dạy")}</option>
            <option value="OTHER">{t("Đề xuất khác")}</option>
          </Select>
        </div>
      </div>

      {error && (
        <div data-i18n-managed className="portal-alert" role="alert" style={{ marginBottom: 20 }}>
          <span>{t(error)}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn-secondary btn-sm" onClick={() => void loadData()}>
              {t('Thử lại', 'Retry')}
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setError('')}
              aria-label={t('Đóng thông báo lỗi', 'Dismiss error')}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div data-i18n-managed className="portal-card" role="status" aria-busy="true" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
            <div className="portal-skeleton" style={{ height: 56, borderRadius: 12 }} />
            <div className="portal-skeleton" style={{ height: 56, borderRadius: 12 }} />
          </div>
          <p style={{ margin: 0, color: 'var(--portal-muted)' }}>{t("Đang tải danh sách đơn từ...")}</p>
        </div>
      ) : error ? null : filteredRequests.length === 0 ? (
        <div data-i18n-managed
          className="portal-card"
          style={{
            padding: '48px 32px',
            textAlign: 'center',
            background: 'var(--portal-surface)',
            borderRadius: 16,
            border: '1px dashed var(--portal-border-strong, var(--portal-border))',
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--portal-paper)' }}>
            {requests.length > 0
              ? t('Không có đơn từ nào khớp bộ lọc hiện tại', 'No requests match the current filter')
              : t("Không có đơn từ nào cần xử lý")}</p>
          <span style={{ fontSize: 13, color: 'var(--portal-muted)' }}>
            {requests.length > 0
              ? t('Hãy thử từ khóa, trạng thái hoặc loại đơn khác.', 'Try a different search, status or request type.')
              : t("Không có đơn từ cần duyệt.")}</span>
        </div>
      ) : (
        <div data-i18n-managed style={{ display: 'grid', gap: 16 }}>
          {filteredRequests.map((req) => {
            const typeInfo = TYPE_LABELS[req.requestType] || TYPE_LABELS.OTHER;
            const statusInfo = STATUS_LABELS[req.status] || STATUS_LABELS.PENDING;
            const roleInfo = ROLE_DISPLAY[req.userRole] || {
              label: req.userRole || t('Nhân sự'),
              bg: 'var(--portal-raised)',
              color: 'var(--portal-muted)',
            };
            const isPending = req.status === 'PENDING';

            return (
              <div data-i18n-managed
                key={req.id}
                className="portal-card"
                style={{
                  padding: 24,
                  borderRadius: 16,
                  border: isPending
                    ? '1.5px solid var(--portal-salmon, var(--sol-accent))'
                    : '1px solid var(--portal-border)',
                  background: 'var(--portal-surface)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
                  display: 'grid',
                  gap: 14,
                }}
              >
                {/* Hàng tiêu đề: Thông tin người gửi & trạng thái */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      aria-hidden="true"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 99,
                        background: 'var(--sol-accent)',
                        color: 'var(--sol-on-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 15,
                      }}
                    >
                      {((req.userFullName ?? '').trim().charAt(0) || '?').toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--portal-paper)' }}>
                          {req.userFullName || t('Nhân sự', 'Staff')}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            padding: '2px 8px',
                            borderRadius: 99,
                            background: roleInfo.bg,
                            color: roleInfo.color,
                            fontWeight: 700,
                          }}
                        >
                          {t(roleInfo.label)}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--portal-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {req.userEmail} {t(" • Gửi lúc:")}{' '}
                        {formatCenterDateTime(req.createdAt)}
                      </span>
                    </div>
                  </div>

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
                </div>

                {/* Tiêu đề & lý do */}
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: 17, fontWeight: 800, color: 'var(--portal-paper)' }}>
                    {req.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--portal-muted)' }}>
                    {req.reason}
                  </p>
                </div>

                {/* Chi tiết phạm vi (ngày, ca mong muốn): chỉ hiển thị khi có thông tin, tránh hộp rỗng với đơn OTHER */}
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

                {/* Kết quả duyệt nếu đã được xử lý */}
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
                      {req.status === 'APPROVED' ? t('Đã phê duyệt') : t('Đã từ chối')} {t(" bởi")}{' '}
                      {req.reviewedByName || t('Ban Quản Lý')} (
                      {formatCenterDate(req.reviewedAt)})
                    </div>
                    {req.managerNotes && (
                      <div data-i18n-managed style={{ marginTop: 4, color: 'var(--portal-paper)', fontStyle: 'italic' }}>
                        {t("Lời phê / Lý do: \"")}{req.managerNotes}"
                      </div>
                    )}
                  </div>
                )}

                {/* Thao tác của quản lý (nút Duyệt / Từ chối cho đơn chờ duyệt) */}
                {isOverdueLeave(req) && <p role="note" className="portal-alert portal-alert--info">{t('Quá hạn duyệt — nhân viên tiếp tục đi làm theo lịch bình thường. Vẫn có thể từ chối đơn.', 'Approval deadline passed — the staff member continues working their normal schedule. Rejection is still available.')}</p>}
                {isPending && (
                  <div data-i18n-managed
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 12,
                      paddingTop: 8,
                      borderTop: '1px solid var(--portal-border)',
                    }}
                  >
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => handleOpenReject(req)}
                    >
                      {t("Từ chối đơn")}</button>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => handleOpenApprove(req)}
                      disabled={isOverdueLeave(req)}
                    >
                      {t("Phê duyệt đơn")}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Duyệt hoặc Từ chối đơn */}
      {reviewTarget && (
        <Modal
          busy={submitting}
          title={
            reviewAction === 'APPROVED'
              ? t(`Phê duyệt đơn: ${reviewTarget.title}`, `Approve request: ${reviewTarget.title}`)
              : t(`Từ chối đơn: ${reviewTarget.title}`, `Reject request: ${reviewTarget.title}`)
          }
          onClose={() => setReviewTarget(null)}
        >
          <form onSubmit={handleReviewSubmit} style={{ display: 'grid', gap: 16 }}>
            {modalError && (
              <div data-i18n-managed className="portal-alert" role="alert">
                <span>{t(modalError)}</span>
              </div>
            )}

            <div
              style={{
                background: 'var(--portal-raised)',
                padding: '12px 16px',
                borderRadius: 10,
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div>
                <strong>{t("Người làm đơn:")}</strong> {reviewTarget.userFullName || t('Nhân sự', 'Staff')} ({reviewTarget.userEmail})
              </div>
              <div>
                <strong>{t("Loại đơn:")}</strong> {t(TYPE_LABELS[reviewTarget.requestType]?.label)}
              </div>
              {reviewTarget.startDate && (
                <div data-i18n-managed>
                  <strong>{t("Thời gian đề xuất:")}</strong> {formatCenterDate(reviewTarget.startDate)}
                  {reviewTarget.endDate && reviewTarget.endDate !== reviewTarget.startDate
                    ? t(` đến ${formatCenterDate(reviewTarget.endDate)}`, ` to ${formatCenterDate(reviewTarget.endDate)}`)
                    : ''}
                  {reviewTarget.replacementUserFullName ? t(` · Thay thế: ${reviewTarget.replacementUserFullName}`, ` · Substitute: ${reviewTarget.replacementUserFullName}`) : ''}
                </div>
              )}
            </div>

            {reviewAction === 'APPROVED' && reviewTarget.requestType === 'LEAVE' && reviewTarget.userRole === 'COACH' && (
              <div data-i18n-managed className="portal-alert portal-alert--info" role="status">
                <span>
                  {t(
                    'Lưu ý: duyệt đơn nghỉ phép của HLV có thể ảnh hưởng đến các buổi lớp nhóm hoặc PT 1:1 đã xếp trong thời gian này. Hệ thống sẽ cảnh báo nếu phát hiện trùng lịch để bạn sắp xếp người dạy thay tại Phân công HLV.',
                    'Note: approving coach leave may impact scheduled group classes or 1:1 PT sessions during these dates. The system will warn you if conflicts exist so you can reassign them in Coach Assignments.',
                  )}
                </span>
              </div>
            )}

            <div>
              <label htmlFor="manager-review-notes" style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                {reviewAction === 'APPROVED'
                  ? t('Ghi chú / Lời nhắn của Quản lý gửi nhân viên (tùy chọn):')
                  : t('Lý do từ chối đơn (bắt buộc):')}
              </label>
              <textarea
                id="manager-review-notes"
                className="portal-textarea"
                rows={4}
                placeholder={
                  reviewAction === 'APPROVED'
                    ? t('Ví dụ: Đã bố trí nhân sự hỗ trợ, chúc bạn hoàn thành công việc...')
                    : t('Nêu rõ lý do từ chối (trùng lịch sự kiện, chưa có người thay thế...)')
                }
                value={managerNotes}
                onChange={(e) => setManagerNotes(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={submitting}
                onClick={() => setReviewTarget(null)}
              >
                {t("Hủy")}</button>
              <button
                type="submit"
                disabled={submitting}
                className={reviewAction === 'APPROVED' ? 'btn-primary' : 'btn-danger'}
              >
                {submitting
                  ? t('Đang xử lý...')
                  : reviewAction === 'APPROVED'
                  ? t('Xác nhận Phê duyệt')
                  : t('Xác nhận Từ chối')}
              </button>
            </div>
          </form>
        </Modal>
      )}
        </>
      )}
      {confirmDialog}
    </div>
  );
}

/** Đồng bộ khi điều hướng tới /manager/requests?tab=complaints từ thông báo. */
function ComplaintsTabSync({ onOpen }: { onOpen: () => void }) {
  const location = useLocation();
  const onOpenRef = useRef(onOpen);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => {
    if (new URLSearchParams(location.search).get('tab') === 'complaints') {
      onOpenRef.current();
    }
  }, [location.key, location.search]);
  return null;
}

