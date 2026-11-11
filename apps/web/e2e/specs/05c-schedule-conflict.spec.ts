import { test, expect } from '../fixtures';
import { apiWith, createCourse } from '../helpers/api';
import { memberWithPlan, PACKAGES } from '../helpers/session';

/** Một hội viên không được giữ đồng thời lớp học, sân và HLV 1:1 trong cùng khung giờ (mọi chiều). */
test.describe.configure({ mode: 'serial' });

const hhmm = (t: string) => t.slice(0, 5);
const plusHour = (t: string, h = 1) => `${String(Number(t.slice(0, 2)) + h).padStart(2, '0')}:${t.slice(3, 5)}`;
const TENNIS = 6;
const COACH_HUNG = 5; // HLV Yoga (mai): khác HLV dạy khóa học e2e (hung) để lỗi trùng đến từ phía hội viên

async function courtBook(token: string, date: string, start: string) {
  return apiWith(token, 'POST', '/court-bookings', { roomId: TENNIS, date, startTime: start, paymentMethod: 'cash' });
}
async function coachBook(token: string, date: string, start: string) {
  return apiWith(token, 'POST', '/coach-bookings', { coachId: COACH_HUNG, bookingDate: date, startTime: start, endTime: plusHour(start), paymentMethod: 'cash' });
}

test('đã có lớp học: không đặt được sân hay HLV 1:1 cùng giờ, nhưng giờ khác thì được', async () => {
  const m = await memberWithPlan(PACKAGES.PLATINUM_3M, 1599000);
  const course = await createCourse({ startInDays: 5, price: 0 });
  const start = hhmm(course.raw.startTime);
  expect((await apiWith(m.token, 'POST', `/classes/${course.id}/enroll`, {})).status).toBe(201);

  const court = await courtBook(m.token, course.startDate, start);
  expect(court.status, JSON.stringify(court.body)).toBe(409);
  const pt = await coachBook(m.token, course.startDate, start);
  expect(pt.status, JSON.stringify(pt.body)).toBe(409);
  expect(pt.body.code).toBe('MEMBER_SCHEDULE_CONFLICT');

  const later = plusHour(start, 3);
  if (Number(later.slice(0, 2)) <= 20) {
    const ok = await courtBook(m.token, course.startDate, later);
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
  }
});

test('đã có đặt sân: không đăng ký được lớp và không đặt được HLV 1:1 cùng giờ', async () => {
  const m = await memberWithPlan(PACKAGES.PLATINUM_3M, 1599000);
  const course = await createCourse({ startInDays: 6, price: 0 });
  const start = hhmm(course.raw.startTime);
  const court = await courtBook(m.token, course.startDate, start);
  test.skip(court.status !== 201, `không đặt được sân để dựng tình huống: ${court.status}`);
  const enroll = await apiWith(m.token, 'POST', `/classes/${course.id}/enroll`, {});
  expect(enroll.status, JSON.stringify(enroll.body)).toBe(409);
  expect(enroll.body.code).toBe('MEMBER_SCHEDULE_CONFLICT');
  const pt = await coachBook(m.token, course.startDate, start);
  expect(pt.status).toBe(409);
});

test('đã có HLV 1:1: không đăng ký được lớp và không đặt được sân cùng giờ', async () => {
  const m = await memberWithPlan(PACKAGES.PLATINUM_3M, 1599000);
  const course = await createCourse({ startInDays: 7, price: 0 });
  const start = hhmm(course.raw.startTime);
  const pt = await coachBook(m.token, course.startDate, start);
  test.skip(pt.status >= 300, `không đặt được HLV để dựng tình huống: ${pt.status} ${pt.body?.code}`);
  const enroll = await apiWith(m.token, 'POST', `/classes/${course.id}/enroll`, {});
  expect(enroll.status, JSON.stringify(enroll.body)).toBe(409);
  const court = await courtBook(m.token, course.startDate, start);
  expect(court.status).toBe(409);
});
