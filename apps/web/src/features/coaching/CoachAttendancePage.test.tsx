import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachAttendancePage } from './CoachAttendancePage';
import { attendanceApi } from './attendanceApi';
import { getCoachSchedule } from '../member/coachBookingApi';
import { todayISO } from '../schedule/timetable';

vi.mock('./attendanceApi', () => ({
  attendanceApi: {
    getCoachSessions: vi.fn(),
    getHistory: vi.fn(),
    getSessionStudents: vi.fn(),
    saveBatchAttendance: vi.fn(),
  },
}));
vi.mock('../member/coachBookingApi', () => ({ getCoachSchedule: vi.fn().mockResolvedValue([]) }));

describe('CoachAttendancePage (group class attendance)', () => {
  let host: HTMLDivElement;
  let root: Root;
  const today = todayISO();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    vi.mocked(attendanceApi.getCoachSessions).mockResolvedValue([
      {
        id: 88,
        className: 'Yoga Sáng',
        disciplineName: 'Yoga',
        roomName: 'Studio A',
        sessionDate: today,
        startTime: '07:00:00',
        endTime: '09:30:00',
        status: 'scheduled',
        capacity: 20,
        bookedCount: 1,
      },
    ]);
    vi.mocked(attendanceApi.getHistory).mockResolvedValue([]);
    vi.mocked(attendanceApi.getSessionStudents).mockResolvedValue([
      {
        id: 1,
        memberId: 50,
        fullName: 'Trần Thu Hà',
        membershipCode: 'MEM-050',
        status: 'present',
        progressScore: 80,
        notes: '',
        recorded: false,
      },
    ]);
    vi.mocked(attendanceApi.saveBatchAttendance).mockResolvedValue({ success: true, updatedCount: 1, message: 'OK' });
    vi.mocked(getCoachSchedule).mockResolvedValue([]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders timetable & attendance history tabs without retired evaluation tabs', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/coach/attendance']}>
          <Routes>
            <Route path="/coach/attendance" element={<CoachAttendancePage />} />
            <Route path="/coach/attendance/:sessionId" element={<CoachAttendancePage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await act(async () => { await Promise.resolve(); });

    const tabs = [...host.querySelectorAll('[role="tab"]')].map((el) => el.textContent);
    expect(tabs).toHaveLength(2);
    expect(tabs.join(' ')).not.toContain('đánh giá');
    expect(host.textContent).toContain('Yoga Sáng');
  });

  it('loads session roster at /coach/attendance/:sessionId and links back to /coach/attendance', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/coach/attendance/88']}>
          <Routes>
            <Route path="/coach/attendance" element={<CoachAttendancePage />} />
            <Route path="/coach/attendance/:sessionId" element={<CoachAttendancePage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await act(async () => { await Promise.resolve(); });

    expect(host.textContent).toContain('Trần Thu Hà');
    expect(host.querySelector('a[href="/coach/attendance"]')).not.toBeNull();
  });
});
