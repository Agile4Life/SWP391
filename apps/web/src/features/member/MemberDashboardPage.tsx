import { DaysLeft } from './DaysLeft';
import { memberText } from './memberI18n';
import { getMyCoachBookings, type CoachBookingDto } from './coachBookingApi';
import { useLanguage } from '../../shared/i18n/language';
import { LoadingImage } from '../../shared/ui/LoadingImage';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../../shared/api/useCurrentUser';
import { PageHeader } from '../../shared/ui/PageHeader';
import { LoadingSkeleton } from '../../shared/ui/LoadingSkeleton';
import { PortalIcon } from '../portal/PortalIcon';
import './member-board.css';
import {
  getCurrentMembership,
  type MemberSubscription,
} from './memberDashboardApi';
import { formatCenterDate } from '../../shared/lib/centerTime';

const DAY_MS = 86_400_000;

/** Kiểm tra chuỗi ngày YYYY-MM-DD hợp lệ (ngày có thật trên lịch). */
function validDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Đổi chuỗi ngày thành Date theo giờ địa phương. */
function localDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Số thứ tự ngày của một Date (bỏ phần giờ). */
function dayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
}

/** Tiến độ gói đã trôi qua (phần trăm) từ ngày bắt đầu đến ngày kết thúc/đã trả tiền tới. */
function membershipProgress(
  subscription: MemberSubscription,
  today: Date,
): number {
  const start = dayNumber(localDate(subscription.startDate));
  const end = dayNumber(localDate(subscription.paidThroughDate ?? subscription.endDate));
  const duration = end - start + 1;

  if (duration <= 0) return 0;

  const used = dayNumber(today) - start;
  return Math.min(100, Math.max(0, (used / duration) * 100));
}

/** Định dạng ngày thành dd/MM/yyyy. */
function formatDate(value: string): string {
  return formatCenterDate(value.slice(0, 10));
}

/** Trạng thái tải gói: đang tải, lỗi hoặc thành công kèm gói (có thể chưa có). */
type MembershipState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; membership: MemberSubscription | null };

/** Trạng thái tải lịch PT: đang tải, lỗi hoặc thành công kèm danh sách buổi. */
type PtState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; bookings: CoachBookingDto[] };

/**
 * Bảng điều khiển của hội viên: gói tập hiện tại và tiến độ, các buổi PT sắp tới; tự làm mới khi quay lại tab
 * hoặc có mạng.
 */
export function MemberDashboardPage() {
  useLanguage();
  const userName = useCurrentUser()?.name || memberText('Hội viên');

  const [membershipState, setMembershipState] =
    useState<MembershipState>({ status: 'loading' });

  const [ptState, setPtState] =
    useState<PtState>({ status: 'loading' });

  // Tải gói hiện tại (silent thì không hiện trạng thái đang tải).
  const loadMembership = useCallback(async (silent = false) => {
    if (!silent) setMembershipState({ status: 'loading' });

    try {
      const membership = await getCurrentMembership();
      setMembershipState({ status: 'success', membership });
    } catch {
      if (!silent) setMembershipState({ status: 'error' });
    }
  }, []);

  // Tải lịch PT 1:1 của hội viên.
  const loadPtBookings = useCallback(async (silent = false) => {
    if (!silent) setPtState({ status: 'loading' });

    try {
      // Dashboard chỉ lấy lịch PT thật, không gọi quota hay ghi danh lớp nhóm.
      const bookings = await getMyCoachBookings();
      setPtState({ status: 'success', bookings });
    } catch {
      if (!silent) setPtState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void loadMembership();
    void loadPtBookings();
    // Làm mới ngầm khi tab đang hiển thị.
    const syncDashboard = () => {
      if (document.visibilityState === 'hidden') return;
      void loadMembership(true);
      void loadPtBookings(true);
    };
    window.addEventListener('focus', syncDashboard);
    window.addEventListener('online', syncDashboard);
    document.addEventListener('visibilitychange', syncDashboard);
    return () => {
      window.removeEventListener('focus', syncDashboard);
      window.removeEventListener('online', syncDashboard);
      document.removeEventListener('visibilitychange', syncDashboard);
    };
  }, [loadMembership, loadPtBookings]);

  const today = new Date();

  const membership =
    membershipState.status === 'success' &&
    membershipState.membership?.status?.toLowerCase() === 'active' &&
    validDate(membershipState.membership.startDate) &&
    validDate(membershipState.membership.endDate) &&
    dayNumber(localDate(membershipState.membership.startDate)) <= dayNumber(today) &&
    dayNumber(localDate(membershipState.membership.endDate)) >= dayNumber(today)
      ? membershipState.membership
      : null;

  // Chỉ hiện buổi PT đã xác nhận và chưa kết thúc; lịch sử vẫn ở màn quản lý PT.
  const bookings = ptState.status === 'success'
    ? ptState.bookings.filter(item => item.status === 'confirmed' && new Date(item.bookingDate + 'T' + item.endTime + '+07:00').getTime() > today.getTime())
        .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.startTime.localeCompare(b.startTime))
    : [];

  return (
    <div data-i18n-managed className="portal-container member-overview">
      <PageHeader
        title={memberText(`Xin chào, ${userName}`, `Hello, ${userName}`)}
        actions={<Link className="btn-primary" to="/member/classes?tab=pt">{memberText("Đặt lịch HLV 1:1")}</Link>}
      />

      <div className="member-board" aria-label={memberText("Tổng quan hội viên")}>
        <section data-i18n-managed className="member-board-column member-board-column--pink" aria-labelledby="board-membership">
          <div className="member-column-heading"><h2 id="board-membership">{memberText("Gói tập của tôi")}</h2><Link to="/member/packages" aria-label={memberText("Xem các gói tập")}><PortalIcon name="arrow" size={16} /></Link></div>

          {membershipState.status === 'loading' && (
            <section data-i18n-managed className="portal-card member-board-loading" role="status">
              <div className="member-skeleton member-skeleton--image" aria-hidden="true" /><span>{memberText("Đang tải thông tin gói tập…")}</span>
            </section>
          )}

          {membershipState.status === 'error' && (
            <section data-i18n-managed className="portal-card portal-empty" role="alert">
              <h2 className="portal-card-title">
                {memberText("Không thể tải thông tin gói tập")}</h2>
              <p>{memberText("Vui lòng thử lại sau ít phút.")}</p>

              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 20 }}
                onClick={() => void loadMembership()}
              >
                {memberText("Thử lại")}</button>
            </section>
          )}

          {membershipState.status === 'success' && (
            <>
              {membership ? (
                <section
                  className="portal-card member-membership-card"
                  aria-labelledby="membership-title"
                >
                  <Link className="member-card-cover-link" to="/member/packages" aria-label={memberText("Xem gói tập của tôi")}><LoadingImage className="member-card-cover" src="/images/about-movement-studio.jpg" alt="" /></Link>
                  <div className="member-card-body">
                    <Link className="member-card-details-link" to="/member/packages" aria-label={memberText("Xem chi tiết gói tập của tôi")}>
                    <span className="badge badge-success">{memberText("Đang hoạt động")}</span>
                    <h2
                      id="membership-title"
                      className="portal-card-title"
                      style={{ marginTop: 12 }}
                    >
                      {membership.packageName}
                    </h2>

                    <p className="row-card__meta" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <span>{formatDate(membership.startDate)}{' – '}<strong>{formatDate(membership.paidThroughDate ?? membership.endDate)}</strong></span>
                      <DaysLeft endDate={membership.paidThroughDate ?? membership.endDate} />
                    </p>

                    <div
                      role="progressbar"
                      aria-label={memberText("Thời hạn gói tập đã sử dụng")}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(
                        membershipProgress(membership, today),
                      )}
                      style={{
                        height: 6,
                        background: 'var(--color-border-subtle)',
                        marginTop: 18,
                        borderRadius: 6,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${membershipProgress(membership, today)}%`,
                          height: '100%',
                          background: 'var(--portal-salmon)',
                        }}
                      />
                    </div>
                    </Link>
                  </div>
                </section>
              ) : (
                <section
                  className="portal-card portal-card--feature portal-empty"
                  aria-labelledby="membership-empty-title"
                >

                  <h2
                    id="membership-empty-title"
                    className="portal-card-title"
                    style={{ margin: '16px 0 10px' }}
                  >
                    {memberText("Chưa có gói tập đang hoạt động")}</h2>

                  <p>{memberText("Đăng ký gói tập để đặt lớp và check-in.")}</p>

                  <Link
                    to="/member/packages"
                    className="btn-primary"
                    style={{ marginTop: 24 }}
                  >
                    {memberText("Khám phá các gói tập")}</Link>
                </section>
              )}
            </>
          )}

        </section>

        <section data-i18n-managed className="member-board-column member-board-column--orange" aria-labelledby="board-classes">
          <div className="member-column-heading"><h2 id="board-classes">{memberText("Lịch tập của tôi")}</h2><Link to="/member/classes" aria-label={memberText("Xem lịch PT", "View PT schedule")}><PortalIcon name="arrow" size={16} /></Link></div>

          <section
            className="portal-card member-classes-card"
            aria-labelledby="upcoming-title"
          >
            <div className="portal-card-header">
              <h2
                id="upcoming-title"
                className="portal-card-title"
              >
                {memberText("Lịch PT đã đặt", "Booked PT sessions")}</h2>
            </div>

            {ptState.status === 'success' && <Link className="member-card-overlay-link" to="/member/classes" aria-label={memberText("Xem lịch PT của tôi", "View my PT schedule")} />}
            {ptState.status === 'loading' && (
              <LoadingSkeleton label={memberText("Đang tải lịch PT…", "Loading PT schedule…")} count={3} />
            )}

            {ptState.status === 'error' && (
              <div role="alert">
                <p className="row-card__meta">
                  {memberText("Chưa thể tải lịch PT lúc này.", "Unable to load PT sessions right now.")}</p>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: 16 }}
                  onClick={() => void loadPtBookings()}
                >
                  {memberText("Thử lại")}</button>
              </div>
            )}

            {ptState.status === 'success' &&
              bookings.length === 0 && (
                <div className="member-board-empty"><p className="row-card__meta">{memberText("Bạn chưa có lịch PT sắp tới.", "You have no upcoming PT sessions.")}</p><Link className="member-text-link" to="/member/classes?tab=pt">{memberText("Đặt lịch HLV 1:1")}<PortalIcon name="arrow" size={14} /></Link></div>
              )}

            {ptState.status === 'success' &&
              bookings.length > 0 && (
                <div className="stack">
                  {bookings.map((item) => (
                    <div key={item.id} className="row-card member-booking-row">
                      <div>
                        <h3 className="row-card__title">
                          {item.coachName}
                        </h3>
                        <div className="row-card__meta">
                          {[
                            validDate(item.bookingDate) ? formatDate(item.bookingDate!) : '',
                            item.startTime && item.endTime ? `${item.startTime.slice(0, 5)}–${item.endTime.slice(0, 5)}` : '',
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>
          <Link className="member-board-note" to="/member/classes?tab=pt"><span>{memberText("Đặt lịch HLV 1:1")}<small>{memberText("PT kèm riêng theo giờ · Đặt trước 2 tiếng")}</small></span><PortalIcon name="arrow" size={14} /></Link>
        </section>

        <section data-i18n-managed className="member-board-column member-board-column--blue" aria-labelledby="board-card">
          <div className="member-column-heading"><h2 id="board-card">{memberText("Thẻ & thanh toán")}</h2><Link to="/member/card" aria-label={memberText("Xem thẻ hội viên")}><PortalIcon name="arrow" size={16} /></Link></div>
          <Link className="member-digital-card" to="/member/card">
            <div className="member-digital-card-top"><span>SÖL</span><PortalIcon name="scan" size={24} /></div>
            <strong>{userName}</strong>
            <div className="member-digital-card-bottom"><span>{memberText("Xem thẻ & mã QR")}</span><PortalIcon name="arrow" size={17} /></div>
          </Link>
          <Link className="member-board-note" to="/member/invoices"><span>{memberText("Giao dịch & hóa đơn")}</span><PortalIcon name="arrow" size={14} /></Link>
        </section>

        <section data-i18n-managed className="member-board-column member-board-column--green" aria-labelledby="board-wellness">
          <div className="member-column-heading"><h2 id="board-wellness">{memberText("Hồ sơ hội viên", "Member profile")}</h2><Link to="/member/profile" aria-label={memberText("Xem hồ sơ hội viên", "View member profile")}><PortalIcon name="arrow" size={16} /></Link></div>
          <Link className="member-profile-card" to="/member/profile"><h3>{memberText("Hồ sơ tài khoản", "Account profile")}</h3><span className="member-text-link">{memberText("Cập nhật thông tin cá nhân", "Update personal details")}<PortalIcon name="arrow" size={14} /></span></Link>
        </section>
      </div>
    </div>
  );
}
