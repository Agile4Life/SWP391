import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberClassesPage } from './MemberClassesPage';
import { setLanguage } from '../../shared/i18n/language';
import { ApiError } from '../../shared/api/client';
import { clearNotices, getNotices } from '../../shared/lib/portalNotices';

const noticeText = () => getNotices().map((notice) => notice.message).join(' ');

const mocks = vi.hoisted(() => ({
  sessions: vi.fn(),
  enrollments: vi.fn(),
  upcoming: vi.fn(),
  cancelEnrollment: vi.fn(),
  mySubscription: vi.fn(),
  coaches: vi.fn(),
  coachSlots: vi.fn(),
  myCoachBookings: vi.fn(),
  quota: vi.fn(),
  checkout: vi.fn(),
  enroll: vi.fn(),
  classes: vi.fn(),
}));

vi.mock('./memberClassesApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./memberClassesApi')>();
  return {
    ...original,
    getSessions: mocks.sessions,
    getMyEnrollments: mocks.enrollments,
    getUpcomingSessions: mocks.upcoming,
    cancelEnrollment: mocks.cancelEnrollment,
    getMyQuota: mocks.quota,
    enrollCourse: mocks.enroll,
    checkoutCourse: mocks.checkout,
    getClasses: mocks.classes,
  };
});

vi.mock('./memberCardApi', () => ({
  getMySubscription: mocks.mySubscription,
}));

vi.mock('../coaching/coachReviewApi', () => ({
  getMyCoachReviews: vi.fn().mockResolvedValue([]),
  createCoachReview: vi.fn(),
}));

vi.mock('./coachBookingApi', () => ({
  getCoaches: mocks.coaches,
  getAvailableSlots: mocks.coachSlots,
  getMyCoachBookings: mocks.myCoachBookings,
  createCoachBooking: vi.fn(),
  cancelCoachBooking: vi.fn(),
  getMemberQuotaStatus: vi.fn().mockResolvedValue({ packageName: 'GOLD', monthlyQuota: 3, usedThisMonth: 1, remainingQuota: 2 }),
  getCoachSchedule: vi.fn().mockResolvedValue([]),
}));

const course = {
  id: 3, name: 'Yoga Flow', disciplineId: 2, disciplineName: 'Yoga', coachId: 4, coachName: 'An',
  roomId: 5, roomName: 'Studio', capacity: 12, level: 'Beginner', description: null, status: 'active',
  price: 500000, startDate: '2099-10-01', endDate: '2099-10-29', recurringDays: 'MONDAY,WEDNESDAY,FRIDAY',
  startTime: '08:00:00', endTime: '09:00:00',
};
const silverQuota = { tier: 'SILVER', totalCredits: 2, usedCredits: 1, remainingCredits: 1, unlimited: false };
const enrollment = { id: 41, sessionId: null, classId: 3, className: 'Yoga Flow', memberId: 9, sessionDate: null,
  startTime: null, endTime: null, status: 'enrolled', enrolledAt: '2099-09-20T08:00:00', cancelledAt: null, cancelReason: null };

describe('MemberClassesPage', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    setLanguage('vi');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    clearNotices();
    mocks.sessions.mockReset().mockResolvedValue([]);
    mocks.mySubscription.mockReset().mockResolvedValue(null);
    mocks.enrollments.mockReset().mockResolvedValue([]);
    mocks.upcoming.mockReset();
    mocks.cancelEnrollment.mockReset();
    mocks.coaches.mockReset().mockResolvedValue([]);
    mocks.coachSlots.mockReset().mockResolvedValue([]);
    mocks.myCoachBookings.mockReset().mockResolvedValue([]);
    mocks.quota.mockReset().mockResolvedValue(null);
    mocks.checkout.mockReset();
    mocks.enroll.mockReset();
    mocks.classes.mockReset().mockResolvedValue([]);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  async function render(path = '/?tab=list') { await act(async () => root.render(<MemoryRouter initialEntries={[path]}><MemberClassesPage /></MemoryRouter>)); }
  const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text));
  async function clickText(text: string) { await act(async () => button(text)!.click()); }
  const titles = () => [...host.querySelectorAll('h3.row-card__title')].map(el => el.textContent);

  it('switches schedule header, tabs and empty state between VI and EN', async () => {
    await render();
    await act(async () => setLanguage('en'));
    expect(host.querySelector('h1')!.textContent).toBe('Classes & bookings');
    expect([...host.querySelectorAll('[role="tab"]')].map(node => node.textContent?.trim())).toEqual(['My schedule', 'Class schedule', 'Book a personal trainer (PT)']);
    expect(host.textContent).toContain('No courses available');
    await act(async () => setLanguage('vi'));
    expect(host.querySelector('h1')!.textContent).toBe('Lịch học & đặt chỗ');
  });

  it('shows only the course list: no weekly-session view, week navigation or weekday picker', async () => {
    mocks.classes.mockResolvedValue([course]);
    await render('/member/classes?tab=list&week=1');
    expect(host.textContent).not.toContain('Buổi học theo tuần');
    expect(host.textContent).not.toContain('Khóa học định kỳ (Trọn gói)');
    expect(button('Tuần này')).toBeUndefined();
    expect(button('Tuần kế tiếp')).toBeUndefined();
    expect(host.querySelector('select')).toBeNull();
    expect(host.querySelector('[data-testid="course-count"]')?.textContent).toBe('1 khóa học');
    expect(titles()).toEqual(['Yoga Flow']);
    expect(mocks.sessions).not.toHaveBeenCalled();
  });

  it('opens on the discipline from the sport page link and ignores unknown values', async () => {
    mocks.classes.mockResolvedValue([
      { ...course, id: 1, name: 'Gym sáng', disciplineName: 'Gym' },
      { ...course, id: 2, name: 'Boxing tối', disciplineName: 'Boxing & Kickfit' },
    ]);
    await render('/member/classes?tab=list&discipline=Boxing');
    expect(titles()).toEqual(['Boxing tối']);
    await act(async () => root.unmount());
    root = createRoot(host);
    await render('/member/classes?tab=list&discipline=Karate');
    expect(titles()).toHaveLength(2);
  });

  it('filters by discipline locally and reports when nothing matches', async () => {
    mocks.classes.mockResolvedValue([course, { ...course, id: 4, name: 'Boxing Basics', disciplineName: 'Boxing' }]);
    await render();
    await act(async () => [...host.querySelectorAll('button')].find(item => item.textContent === 'Boxing')!.click());
    expect(titles()).toEqual(['Boxing Basics']);
    expect(host.querySelector('[data-testid="course-count"]')?.textContent).toBe('1 khóa học');
    await act(async () => [...host.querySelectorAll('button')].find(item => item.textContent === 'Tennis')!.click());
    expect(host.textContent).toContain('Không có khóa học phù hợp');
    await clickText('Tất cả bộ môn');
    expect(titles()).toHaveLength(2);
    expect(mocks.classes).toHaveBeenCalledTimes(1);
  });

  it('lists open courses before courses that have already started and disables joining a started one', async () => {
    mocks.quota.mockResolvedValue(silverQuota);
    mocks.classes.mockResolvedValue([
      { ...course, id: 7, name: 'Started Course', startDate: '2000-01-03', endDate: '2000-02-28' },
      { ...course, id: 8, name: 'Open Course' },
    ]);
    await render();
    expect(titles()).toEqual(['Open Course', 'Started Course']);
    expect(button('Khóa đã bắt đầu')?.disabled).toBe(true);
    expect(host.querySelector('[data-testid="enroll-course-8"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="enroll-course-7"]')).toBeNull();
  });

  it('shows loading, then an error, and retries the course request', async () => {
    let fail!: (reason: unknown) => void;
    mocks.classes.mockReturnValueOnce(new Promise((_, reject) => { fail = reject; })).mockResolvedValueOnce([course]);
    await render();
    expect(host.textContent).toContain('Đang tải khóa học');
    await act(async () => fail(new Error('offline')));
    expect(host.textContent).toContain('Không tải được danh sách khóa học');
    await act(async () => [...host.querySelectorAll('button')].find(item => item.textContent === 'Thử lại')!.click());
    expect(titles()).toEqual(['Yoga Flow']);
    expect(mocks.classes).toHaveBeenCalledTimes(2);
  });

  it('waits for personal enrollment data before offering an enroll action and retries only it', async () => {
    mocks.quota.mockResolvedValue(silverQuota);
    mocks.classes.mockResolvedValue([course]);
    mocks.enrollments.mockRejectedValueOnce(new ApiError('Không tải được đăng ký', 500)).mockResolvedValueOnce([enrollment]);
    await render();
    expect(host.textContent).toContain('Không tải được lịch học của tôi');
    expect(host.querySelector('[data-testid="enroll-course-3"]')).toBeNull();
    expect(button('Chưa thể kiểm tra đăng ký')?.disabled).toBe(true);
    await clickText('Thử lại lịch học của tôi');
    expect(host.textContent).toContain('Hủy khóa học');
    expect(mocks.classes).toHaveBeenCalledTimes(1);
  });

  it('shows the buy-a-package hint only for a member without an active package', async () => {
    mocks.classes.mockResolvedValue([course]);
    await render();
    expect(host.textContent).toContain('Cần gói tập đang hoạt động');
    await act(async () => root.unmount());
    root = createRoot(host);
    const end = new Date(Date.now() + 20 * 86400000).toLocaleDateString('en-CA');
    mocks.mySubscription.mockResolvedValue({ id: 1, status: 'active', endDate: end });
    await render();
    expect(host.textContent).not.toContain('Cần gói tập đang hoạt động');
  });

  it('enrolls the whole course once with plan credit and cancels it as a whole course', async () => {
    mocks.quota.mockResolvedValue(silverQuota);
    mocks.classes.mockResolvedValue([course]);
    mocks.enrollments.mockResolvedValueOnce([]).mockResolvedValueOnce([enrollment]).mockResolvedValue([]);
    let finish!: (value: unknown) => void;
    mocks.enroll.mockReturnValue(new Promise((done) => { finish = done; }));
    await render();
    const enroll = host.querySelector<HTMLButtonElement>('[data-testid="enroll-course-3"]')!;
    await act(async () => { enroll.click(); enroll.click(); });
    expect(mocks.enroll).toHaveBeenCalledExactlyOnceWith(3);
    expect(enroll.disabled).toBe(true);
    await act(async () => finish({ id: 41 }));
    expect(noticeText()).toContain('Đã đăng ký khóa học "Yoga Flow"');
    await clickText('Hủy khóa học');
    mocks.cancelEnrollment.mockResolvedValueOnce({ id: 41, status: 'cancelled' });
    await clickText('Xác nhận hủy');
    expect(mocks.cancelEnrollment).toHaveBeenCalledWith(41);
  });

  it('reports a rejected enrollment as a centred toast instead of an inline banner', async () => {
    mocks.quota.mockResolvedValue(silverQuota);
    mocks.classes.mockResolvedValue([course]);
    mocks.enroll.mockRejectedValue(new ApiError('Hội viên đã có chỗ trong lớp học này.', 400));
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="enroll-course-3"]')!.click());
    expect(document.querySelector('dialog.sol-toast--error')?.textContent).toContain('Hội viên đã có chỗ trong lớp học này.');
    expect(host.textContent).not.toContain('Hội viên đã có chỗ trong lớp học này.');
  });

  it('normalizes legacy ?tab=my to the Lịch của tôi calendar tab while keeping exactly 3 tabs', async () => {
    await render('/member/classes?tab=my');
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((item) => item.textContent?.trim())).toEqual(['Lịch của tôi', 'Lịch lớp học', 'Đặt lịch HLV 1:1 (PT)']);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
  });

  it('renders coach 1:1 booking tab and switches correctly', async () => {
    mocks.coaches.mockResolvedValue([{ id: 101, fullName: 'Trần Văn Nam', specialization: 'Gym & Thể hình', defaultHourlyRate: 200000 }]);
    await render();
    await clickText('Đặt lịch HLV 1:1');
    expect(host.textContent).toContain('Chọn Huấn luyện viên cá nhân (PT 1:1)');
    expect(host.textContent).toContain('Trần Văn Nam');
  });

  describe('course quota and pricing', () => {
    it('displays membership course quota banner with tier and remaining credits', async () => {
      mocks.quota.mockResolvedValue(silverQuota);
      await render();
      const quotaBanner = host.querySelector('[data-testid="course-quota-banner"]');
      expect(quotaBanner?.textContent).toContain('GÓI SILVER');
      expect(quotaBanner?.textContent).toContain('Còn 1/2 khóa học miễn phí');
    });

    it('hides the course quota banner for a member who has no plan yet', async () => {
      mocks.quota.mockResolvedValue({ tier: '', totalCredits: 0, usedCredits: 0, remainingCredits: 0, unlimited: false });
      await render();
      expect(host.querySelector('[data-testid="course-quota-banner"]')).toBeNull();
      expect(host.textContent).not.toContain('Còn 0/0 khóa học miễn phí');
    });

    it('shows upgrade link when member course quota is exhausted', async () => {
      mocks.quota.mockResolvedValue({ ...silverQuota, usedCredits: 2, remainingCredits: 0 });
      await render();
      const quotaBanner = host.querySelector('[data-testid="course-quota-banner"]');
      expect(quotaBanner?.textContent).toContain('Còn 0/2 khóa học miễn phí');
      expect(quotaBanner?.textContent).toContain('Nâng cấp gói tập');
    });

    it('shows course duration and cadence and opens the course detail modal', async () => {
      mocks.classes.mockResolvedValue([{ ...course, description: 'Lớp học yoga tăng cường dẻo dai' }]);
      mocks.quota.mockResolvedValue({ tier: 'GOLD', totalCredits: 3, usedCredits: 1, remainingCredits: 2, unlimited: false });
      await render();
      expect(host.textContent).toContain('Khóa 4 tuần (3 buổi / tuần)');
      expect(host.textContent).toContain('Thứ 2, Thứ 4, Thứ 6');
      await clickText('Xem chi tiết & Lộ trình');
      expect(host.textContent).toContain('Thông tin khóa học & Gói tập');
      expect(host.textContent).toContain('4 tuần (12 buổi học)');
      expect(host.textContent).toContain('Bạn còn 2/3 khóa học miễn phí theo hạn mức gói');
      expect(host.textContent).toContain('Xác nhận đăng ký (Miễn phí theo gói)');
    });

    it('charges tuition once plan credits are used up', async () => {
      mocks.classes.mockResolvedValue([{ ...course, id: 5, name: 'Pilates Mastery', disciplineName: 'Pilates', price: 600000,
        startDate: '2099-11-01', endDate: '2099-12-27', recurringDays: 'TUESDAY,THURSDAY' }]);
      mocks.quota.mockResolvedValue({ tier: 'BRONZE', totalCredits: 1, usedCredits: 1, remainingCredits: 0, unlimited: false });
      await render();
      expect(host.textContent).toContain('Khóa 8 tuần (2 buổi / tuần)');
      expect(host.textContent).toContain('16 buổi trọn gói');
      expect(host.textContent).toContain('Học phí ngoài gói: 600.000 VNĐ');
      await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="pay-course-5"]')!.click());
      expect(host.textContent).toContain('Thanh toán học phí khóa học');
    });
  });
});
