import { DaysLeft } from './DaysLeft';
import { memberText } from './memberI18n';
import { getMyCoachBookings, type CoachBookingDto } from './coachBookingApi';
import { getMyEnrollments, getSessionsBetween, type ClassSessionDto } from './memberClassesApi';
import { formatSlotShort } from '../schedule/slots';
import { useLanguage } from '../../shared/i18n/language';
import { LoadingImage } from '../../shared/ui/LoadingImage';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { centerNowParts, formatCenterDate, parseCenterTime } from '../../shared/lib/centerTime';

const DAY_MS = 86_400_000;
const CLASS_LOOKAHEAD_DAYS = 30;

/** Kiểm tra chuỗi ngày YYYY-MM-DD hợp lệ (ngày có thật trên lịch). */
function validDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Số thứ tự ngày của chuỗi YYYY-MM-DD theo lịch UTC (tránh lệch múi giờ trình duyệt). */
function dayNumberFromIso(iso: string): number {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Cộng số ngày vào chuỗi YYYY-MM-DD. */
function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Tiến độ gói đã trôi qua (phần trăm) từ ngày bắt đầu đến ngày kết thúc/đã trả tiền tới. */
function membershipProgress(
  subscription: MemberSubscription,
  todayIso: string,
): number {
  const start = dayNumberFromIso(subscription.startDate);
  const end = dayNumberFromIso(subscription.paidThroughDate ?? subscription.endDate);
  const duration = end - start + 1;

  if (duration <= 0) return 0;

  const used = dayNumberFromIso(todayIso) - start;
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

interface UpcomingScheduleItem {
  key: string;
  kind: 'pt' | 'class';
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  roomName?: string;
}

/** Trạng thái tải lịch tập (gộp PT 1:1 và lớp nhóm): đang tải, lỗi hoặc thành công. */
type ScheduleState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; bookings: CoachBookingDto[]; classSessions: ClassSessionDto[]; partialError?: boolean };

/**
 * Bảng điều khiển của hội viên: gói tập hiện tại và tiến độ, các buổi tập sắp tới (lớp nhóm + PT 1:1);
 * tự làm mới khi quay lại tab hoặc có mạng.
 */
export function MemberDashboardPage() {
  useLanguage();
  const userName = useCurrentUser()?.name || memberText('Hội viên');

  const [membershipState, setMembershipState] =
    useState<MembershipState>({ status: 'loading' });

  const [scheduleState, setScheduleState] =
    useState<ScheduleState>({ status: 'loading' });

  const mountedRef = useRef(true);
  const membershipSeqRef = useRef(0);
  const scheduleSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Tải gói hiện tại (silent thì không hiện trạng thái đang tải); có khóa chống race & unmount.
  const loadMembership = useCallback(async (silent = false) => {
    const seq = ++membershipSeqRef.current;
    if (!silent) setMembershipState({ status: 'loading' });

    try {
      const membership = await getCurrentMembership();
      if (!mountedRef.current || seq !== membershipSeqRef.current) return;
      setMembershipState({ status: 'success', membership });
    } catch {
      if (!mountedRef.current || seq !== membershipSeqRef.current) return;
      if (!silent) setMembershipState({ status: 'error' });
    }
  }, []);

  // Tải lịch PT 1:1 và các buổi lớp học nhóm đang ghi danh của hội viên.
  const loadSchedule = useCallback(async (silent = false) => {
    const seq = ++scheduleSeqRef.current;
    if (!silent) setScheduleState({ status: 'loading' });

    const todayIso = centerNowParts().date;
    const lookaheadEnd = addIsoDays(todayIso, CLASS_LOOKAHEAD_DAYS);

    const loadClassSessions = async (): Promise<ClassSessionDto[]> => {
      if (typeof getMyEnrollments !== 'function') return [];
      const enrollments = await getMyEnrollments();
      const activeList = Array.isArray(enrollments)
        ? enrollments.filter((item) => item.status?.toLowerCase() === 'enrolled')
        : [];
      if (activeList.length === 0) return [];
      const enrolledClassIds = new Set(activeList.map((item) => item.classId));
      if (typeof getSessionsBetween !== 'function') return [];
      const sessions = await getSessionsBetween(todayIso, lookaheadEnd);
      return Array.isArray(sessions)
        ? sessions.filter((session) => enrolledClassIds.has(session.classId))
        : [];
    };

    const [ptResult, classResult] = await Promise.allSettled([
      getMyCoachBookings(),
      loadClassSessions(),
    ]);

    if (!mountedRef.current || seq !== scheduleSeqRef.current) return;

    const ptFailed = ptResult.status === 'rejected';
    const classFailed = classResult.status === 'rejected';
    const bookings = ptResult.status === 'fulfilled' && Array.isArray(ptResult.value) ? ptResult.value : [];
    const classSessions = classResult.status === 'fulfilled' && Array.isArray(classResult.value) ? classResult.value : [];

    if (ptFailed && (classFailed || classSessions.length === 0)) {
      if (!silent) setScheduleState({ status: 'error' });
      return;
    }

    setScheduleState({
      status: 'success',
      bookings,
      classSessions,
      partialError: ptFailed || classFailed,
    });
  }, []);

  useEffect(() => {
    void loadMembership();
    void loadSchedule();
    // Làm mới ngầm khi tab đang hiển thị.
    const syncDashboard = () => {
      if (document.visibilityState === 'hidden') return;
      void loadMembership(true);
      void loadSchedule(true);
    };
    window.addEventListener('focus', syncDashboard);
    window.addEventListener('online', syncDashboard);
    document.addEventListener('visibilitychange', syncDashboard);
    return () => {
      window.removeEventListener('focus', syncDashboard);
      window.removeEventListener('online', syncDashboard);
      document.removeEventListener('visibilitychange', syncDashboard);
    };
  }, [loadMembership, loadSchedule]);

  const now = new Date();
  const todayIso = centerNowParts(now).date;

  const membership =
    membershipState.status === 'success' &&
    membershipState.membership?.status?.toLowerCase() === 'active' &&
    validDate(membershipState.membership.startDate) &&
    validDate(membershipState.membership.endDate) &&
    membershipState.membership.startDate.slice(0, 10) <= todayIso &&
    membershipState.membership.endDate.slice(0, 10) >= todayIso
      ? membershipState.membership
      : null;

  // Gộp buổi PT 1:1 đã xác nhận và buổi lớp học nhóm chưa kết thúc, sắp theo ngày & giờ tăng dần.
  const upcomingItems: UpcomingScheduleItem[] = scheduleState.status === 'success'
    ? [
        ...scheduleState.bookings
          .filter((item) => {
            if (
              item.status !== 'confirmed' ||
              String(item.paymentStatus ?? '').toLowerCase() === 'pending' ||
              !item.bookingDate ||
              !item.endTime
            ) {
              return false;
            }
            const endAt = parseCenterTime(`${item.bookingDate}T${item.endTime}`);
            return endAt !== null && endAt.getTime() > now.getTime();
          })
          .map((item): UpcomingScheduleItem => ({
            key: `pt-${item.id}`,
            kind: 'pt',
            title: item.coachName,
            date: item.bookingDate!,
            startTime: item.startTime ?? '',
            endTime: item.endTime ?? '',
          })),
        ...scheduleState.classSessions
          .filter((session) => {
            if (session.status?.toLowerCase() === 'cancelled' || !session.sessionDate || !session.endTime) return false;
            const endAt = parseCenterTime(`${session.sessionDate}T${session.endTime}`);
            return endAt !== null && endAt.getTime() > now.getTime();
          })
          .map((session): UpcomingScheduleItem => ({
            key: `class-${session.id}`,
            kind: 'class',
            title: session.className,
            date: session.sessionDate,
            startTime: session.startTime,
            endTime: session.endTime,
            roomName: session.roomName || undefined,
          })),
      ].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    : [];

  return (
    <div data-i18n-managed className="portal-container member-overview">
      <PageHeader
        title={memberText(`Xin chào, ${userName}`, `Hello, ${userName}`)}
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
                        membershipProgress(membership, todayIso),
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
                          width: `${membershipProgress(membership, todayIso)}%`,
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
          <div className="member-column-heading"><h2 id="board-classes">{memberText("Lịch tập của tôi")}</h2><Link to="/member/classes" aria-label={memberText("Xem lịch tập của tôi", "View my training schedule")}><PortalIcon name="arrow" size={16} /></Link></div>

          <section
            className="portal-card member-classes-card"
            aria-labelledby="upcoming-title"
          >
            <div className="portal-card-header">
              <h2
                id="upcoming-title"
                className="portal-card-title"
              >
                {memberText("Lịch tập sắp tới", "Upcoming sessions")}</h2>
            </div>

            {scheduleState.status === 'success' && <Link className="member-card-overlay-link" to="/member/classes" aria-label={memberText("Xem lịch tập của tôi", "View my training schedule")} />}
            {scheduleState.status === 'loading' && (
              <LoadingSkeleton label={memberText("Đang tải lịch tập…", "Loading schedule…")} count={3} />
            )}

            {scheduleState.status === 'error' && (
              <div role="alert">
                <p className="row-card__meta">
                  {memberText("Chưa thể tải lịch tập lúc này.", "Unable to load your schedule right now.")}</p>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: 16 }}
                  onClick={() => void loadSchedule()}
                >
                  {memberText("Thử lại")}</button>
              </div>
            )}

            {scheduleState.status === 'success' &&
              upcomingItems.length === 0 && (
                <div className="member-board-empty"><p className="row-card__meta">{memberText("Bạn chưa có lịch tập sắp tới.", "You have no upcoming sessions.")}</p><Link className="member-text-link" to="/member/classes?tab=pt">{memberText("Đặt lịch HLV 1:1")}<PortalIcon name="arrow" size={14} /></Link></div>
              )}

            {scheduleState.status === 'success' &&
              upcomingItems.length > 0 && (
                <div className="stack">
                  {upcomingItems.slice(0, 5).map((item) => (
                    <div key={item.key} className="row-card member-booking-row">
                      <div>
                        <span className={`badge ${item.kind === 'pt' ? 'badge-info' : 'badge-neutral'}`} style={{ marginBottom: 4 }}>
                          {item.kind === 'pt' ? memberText("PT 1:1", "1:1 PT") : memberText("Lớp nhóm", "Group class")}
                        </span>
                        <h3 className="row-card__title">
                          {item.title}
                        </h3>
                        <div className="row-card__meta">
                          {[
                            validDate(item.date) ? formatDate(item.date) : '',
                            formatSlotShort(item.startTime, item.endTime),
                            item.roomName ?? '',
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>
          <Link className="member-board-note" to="/member/classes?tab=pt"><span>{memberText("Đặt lịch HLV 1:1")}<small>{memberText("5 Slot cố định (07:00 – 20:30) · Đặt trước 2 tiếng", "5 fixed slots (07:00 – 20:30) · Book 2 hours ahead")}</small></span><PortalIcon name="arrow" size={14} /></Link>
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
