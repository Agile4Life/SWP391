import { staffText } from '../operations/staffI18n';
import { formatSlotLabel } from '../schedule/slots';
import { shortDate, toMinutes, todayISO, type TimetableEvent } from '../schedule/timetable';

/** Dạng dữ liệu buổi học mà bảng lịch của HLV cần. */
interface SessionLike {
  id: number;
  className: string;
  coachName?: string;
  roomName?: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status?: string;
  bookedCount: number;
  capacity: number;
}

/** Dạng dữ liệu buổi kèm 1:1 mà bảng lịch của HLV cần. */
interface PtBookingLike {
  id: number;
  memberName: string;
  disciplineName?: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
}

/** Buổi học đã kết thúc chưa so với thời điểm now. */
export function hasEnded(session: Pick<SessionLike, 'sessionDate' | 'endTime'>, now: Date): boolean {
  const today = todayISO(now);
  return session.sessionDate < today
    || (session.sessionDate === today && toMinutes(session.endTime) <= now.getHours() * 60 + now.getMinutes());
}

/**
 * Buổi dạy của HLV thành khối trên thời khóa biểu.
 * mode "schedule": còn chỗ / đầy / đã qua / đã hủy. mode "attendance": đã điểm danh / chưa điểm danh (đã diễn ra) / sắp diễn ra / đã hủy.
 */
export function coachSessionEvents(
  sessions: SessionLike[],
  mode: 'schedule' | 'attendance',
  savedSessionIds: ReadonlySet<number> = new Set(),
  now: Date = new Date(),
): TimetableEvent[] {
  return sessions.map((session) => {
    const ended = hasEnded(session, now);
    const seats = `${session.bookedCount}/${session.capacity}`;
    let tone: TimetableEvent['tone'];
    let badge: string;
    let statusText: string;
    if (session.status === 'cancelled') {
      tone = 'cancelled'; badge = staffText('Đã hủy', 'Cancelled'); statusText = staffText('đã hủy', 'cancelled');
    } else if (mode === 'attendance') {
      if (savedSessionIds.has(session.id)) { tone = 'mine'; badge = staffText('Đã điểm danh', 'Attendance recorded'); statusText = staffText('đã điểm danh', 'attendance recorded'); }
      else if (ended) { tone = 'full'; badge = staffText('Chưa điểm danh', 'Attendance not recorded'); statusText = staffText('đã diễn ra, chưa điểm danh', 'past, attendance not recorded'); }
      else { tone = 'open'; badge = seats; statusText = staffText('sắp diễn ra', 'upcoming'); }
    } else if (ended) {
      tone = 'past'; badge = seats; statusText = staffText('đã qua', 'past');
    } else if (session.bookedCount >= session.capacity) {
      tone = 'full'; badge = staffText('Đầy', 'Full'); statusText = staffText('đã đầy', 'full');
    } else {
      tone = 'open'; badge = seats; statusText = staffText('còn chỗ', 'spaces available');
    }
    return {
      id: String(session.id),
      date: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      title: session.className,
      meta: session.roomName || undefined,
      detail: session.coachName || `${seats} ${staffText('học viên', 'members')}`,
      badge,
      tone,
      ariaLabel: `${session.className}, ${shortDate(session.sessionDate)} ${formatSlotLabel(session.startTime, session.endTime)}${session.roomName ? `, ${session.roomName}` : ''}, ${seats} ${staffText('học viên', 'members')}, ${statusText}`,
    };
  });
}

/** Buổi kèm 1:1 đã xác nhận, hiện cùng bảng với lớp nhóm. id có tiền tố `pt-`. */
export function ptBookingEvents(bookings: PtBookingLike[]): TimetableEvent[] {
  return bookings
    .filter((booking) => booking.status && booking.status.toLowerCase() !== 'cancelled')
    .map((booking) => {
      const isCompleted = booking.status.toLowerCase() === 'completed';
      const slotText = formatSlotLabel(booking.startTime, booking.endTime);
      return {
        id: `pt-${booking.id}`,
        date: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        title: `PT 1:1 · ${booking.memberName}`,
        meta: booking.disciplineName || staffText('Huấn luyện cá nhân', 'Personal training'),
        detail: isCompleted ? staffText('Hoàn thành', 'Completed') : staffText('Đã xác nhận', 'Confirmed'),
        badge: isCompleted ? staffText('Hoàn thành', 'Completed') : '1:1',
        tone: 'mine' as const,
        ariaLabel: staffText(`Kèm riêng 1:1 với ${booking.memberName}, ${shortDate(booking.bookingDate)} ${slotText}`, `One-to-one coaching with ${booking.memberName}, ${shortDate(booking.bookingDate)} ${slotText}`),
      };
    });
}
