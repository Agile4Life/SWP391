import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser } from '../../shared/api/client';
import { PageHeader } from '../../shared/ui/PageHeader';
import {
  getCurrentMembership,
  getUpcomingBookings,
  type BookedClass,
  type MemberSubscription,
} from './memberDashboardApi';

const DAY_MS = 86_400_000;

function localDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
}

function remainingDays(endDate: string, today: Date): number {
  return Math.max(0, dayNumber(localDate(endDate)) - dayNumber(today));
}

function membershipProgress(
  subscription: MemberSubscription,
  today: Date,
): number {
  const start = dayNumber(localDate(subscription.startDate));
  const end = dayNumber(localDate(subscription.endDate));
  const duration = end - start;

  if (duration <= 0) return 0;

  const used = dayNumber(today) - start;
  return Math.min(100, Math.max(0, (used / duration) * 100));
}

function upcomingBookedClasses(
  classes: BookedClass[],
  today: Date,
): BookedClass[] {
  const start = dayNumber(today);
  const currentTime =
    `${String(today.getHours()).padStart(2, '0')}:` +
    `${String(today.getMinutes()).padStart(2, '0')}`;

  return classes
    .filter((item) => {
      if (
        !item.status ||
        !item.sessionDate ||
        !item.startTime
      ) {
        return false;
      }

      const day = dayNumber(localDate(item.sessionDate));

      return (
        item.status.toLowerCase() === 'booked' &&
        day >= start &&
        day < start + 7 &&
        (day !== start || item.startTime.slice(0, 5) >= currentTime)
      );
    })
    .sort((a, b) =>
      `${a.sessionDate}T${a.startTime}`.localeCompare(
        `${b.sessionDate}T${b.startTime}`,
      ),
    );
}

function formatDate(value: string): string {
  return localDate(value).toLocaleDateString('vi-VN');
}

type MembershipState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; membership: MemberSubscription | null };

type ClassesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; classes: BookedClass[] };

export function MemberDashboardPage() {
  const userName = getCurrentUser()?.name || 'Hội viên';

  const [membershipState, setMembershipState] =
    useState<MembershipState>({ status: 'loading' });

  const [classesState, setClassesState] =
    useState<ClassesState>({ status: 'loading' });

  const loadMembership = useCallback(async () => {
    setMembershipState({ status: 'loading' });

    try {
      const membership = await getCurrentMembership();
      setMembershipState({ status: 'success', membership });
    } catch {
      setMembershipState({ status: 'error' });
    }
  }, []);

  const loadClasses = useCallback(async () => {
    setClassesState({ status: 'loading' });

    try {
      const classes = await getUpcomingBookings();
      setClassesState({ status: 'success', classes });
    } catch {
      setClassesState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void loadMembership();
    void loadClasses();
  }, [loadMembership, loadClasses]);

  const today = new Date();

  const membership =
    membershipState.status === 'success' &&
    membershipState.membership?.status?.toLowerCase() === 'active' &&
    dayNumber(localDate(membershipState.membership.endDate)) >= dayNumber(today)
      ? membershipState.membership
      : null;

  const classes =
    classesState.status === 'success'
      ? upcomingBookedClasses(classesState.classes, today)
      : [];

  return (
    <div className="portal-container">
      <PageHeader
        eyebrow="Hội viên"
        title={`Xin chào, ${userName}`}
      />

      {membershipState.status === 'loading' && (
        <section className="portal-card" role="status">
          Đang tải thông tin gói tập…
        </section>
      )}

      {membershipState.status === 'error' && (
        <section className="portal-card portal-empty" role="alert">
          <h2 className="portal-card-title">
            Không thể tải thông tin gói tập
          </h2>
          <p>Vui lòng thử lại sau ít phút.</p>

          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 20 }}
            onClick={() => void loadMembership()}
          >
            Thử lại
          </button>
        </section>
      )}

      {membershipState.status === 'success' && (
        <>
          {membership ? (
            <section
              className="portal-card"
              aria-labelledby="membership-title"
            >
              <div className="meta-label">Gói tập hiện tại</div>

              <h2
                id="membership-title"
                className="portal-card-title"
                style={{ marginTop: 12 }}
              >
                {membership.packageName}
              </h2>

              <p className="row-card__meta">
                {formatDate(membership.startDate)}
                {' – '}
                {formatDate(membership.endDate)}
                {' · Còn '}
                {remainingDays(membership.endDate, today)}
                {' ngày'}
              </p>

              <div
                role="progressbar"
                aria-label="Thời hạn gói tập đã sử dụng"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(
                  membershipProgress(membership, today),
                )}
                style={{
                  height: 5,
                  background: 'var(--color-border-subtle)',
                  marginTop: 24,
                }}
              >
                <div
                  style={{
                    width: `${membershipProgress(membership, today)}%`,
                    height: '100%',
                    background: 'var(--color-accent-gold)',
                  }}
                />
              </div>
            </section>
          ) : (
            <section
              className="portal-card portal-card--feature portal-empty"
              aria-labelledby="membership-empty-title"
            >
              <div className="meta-label">SÖL WELLNESS</div>

              <h2
                id="membership-empty-title"
                className="portal-card-title"
                style={{ margin: '16px 0 10px' }}
              >
                Hành trình của bạn bắt đầu tại đây
              </h2>

              <p>Chọn gói tập phù hợp với nhịp sống của bạn.</p>

              <Link
                to="/member/packages"
                className="btn-primary"
                style={{ marginTop: 24 }}
              >
                Khám phá các gói tập
              </Link>
            </section>
          )}
        </>
      )}

      <section
        className="portal-card"
        aria-labelledby="upcoming-title"
      >
        <div className="portal-card-header">
          <h2
            id="upcoming-title"
            className="portal-card-title"
          >
            Lịch học 7 ngày tới
          </h2>
        </div>

        {classesState.status === 'loading' && (
          <p className="row-card__meta">
            Đang tải lịch học…
          </p>
        )}

        {classesState.status === 'error' && (
          <div role="alert">
            <p className="row-card__meta">
              Chưa thể tải lịch học lúc này.
            </p>

            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: 16 }}
              onClick={() => void loadClasses()}
            >
              Thử lại
            </button>
          </div>
        )}

        {classesState.status === 'success' &&
          classes.length === 0 && (
            <p className="row-card__meta">
              Bạn chưa có buổi học đã đặt trong 7 ngày tới.
            </p>
          )}

        {classesState.status === 'success' &&
          classes.length > 0 && (
            <div className="stack">
              {classes.map((item) => (
                <div key={item.id} className="row-card">
                  <h3 className="row-card__title">
                    {item.className}
                  </h3>

                  <div className="row-card__meta">
                    {formatDate(item.sessionDate)}
                    {' · '}
                    {item.startTime.slice(0, 5)}
                    {'–'}
                    {item.endTime.slice(0, 5)}
                    {' · '}
                    {item.roomName}
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>
    </div>
  );
}