import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachClassesPage } from './CoachClassesPage';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import { coachingApi } from './coachingApi';

describe('CoachClassesPage (SCRUM-121: UI Coach Danh sách Lớp & Học viên Phụ trách)', () => {
  let host: HTMLDivElement;
  let root: Root;

  const mockSessions = [
    {
      id: 501,
      classId: 10,
      className: 'Reformer Pilates Core',
      disciplineId: 1,
      disciplineName: 'Pilates Reformer',
      coachId: 3,
      coachName: 'HLV Marcus Vance',
      roomId: 101,
      roomName: 'Studio 01 (Tầng 2)',
      sessionDate: '2026-10-19',
      startTime: '08:00',
      endTime: '09:30',
      status: 'scheduled',
      capacity: 12,
      bookedCount: 2,
      level: 'Mọi cấp độ',
      description: 'Lớp rèn luyện cơ lõi chuyên sâu',
    },
  ];

  const mockStudents = [
    {
      id: 1,
      memberId: 10,
      membershipCode: 'MB-2026-089',
      fullName: 'Nguyễn Văn An',
      email: 'an.nguyen@example.com',
      phone: '0901 234 567',
      fitnessGoal: 'Giảm 3kg mỡ, tăng cơ nạc và săn chắc vùng bụng dưới',
      healthNotes: 'Tiền sử thoát vị đĩa đệm nhẹ L4-L5, tránh deadlift tạ nặng',
      fitnessLevel: 'intermediate',
      enrolledAt: '2026-10-18T08:00:00Z',
      status: 'booked',
    },
    {
      id: 2,
      memberId: 11,
      membershipCode: 'MB-2026-054',
      fullName: 'Trần Thị Mai',
      email: 'mai.tran@example.com',
      phone: '0912 345 678',
      fitnessGoal: 'Tăng cường độ dẻo dai khớp vai và phục hồi dáng đứng',
      healthNotes: 'Không có tiền sử chấn thương, thể trạng tốt',
      fitnessLevel: 'beginner',
      enrolledAt: '2026-10-18T09:00:00Z',
      status: 'booked',
    },
  ];

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    // Mock HTMLDialogElement for Modal
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });

    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        id: '3',
        name: 'HLV Marcus Vance',
        identifier: 'COACH-003',
        role: 'COACH',
      })
    );

    vi.spyOn(coachingApi, 'getCoachSchedule').mockResolvedValue(mockSessions);
    vi.spyOn(coachingApi, 'getSessionStudents').mockResolvedValue(mockStudents);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderComponent() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });
  }

  it('denies access (403 Forbidden) when user is not a COACH or MANAGER', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        id: '1',
        name: 'Hội viên Thử nghiệm',
        identifier: 'MEMBER-001',
        role: 'MEMBER',
      })
    );

    await renderComponent();
    expect(host.textContent).toContain('Truy cập bị từ chối (403 Forbidden)');
  });

  it('renders weekly schedule and KPI cards for logged-in COACH', async () => {
    await renderComponent();

    // Verify Page Header and KPI metrics
    expect(host.textContent).toContain('Lớp học & Học viên phụ trách');
    expect(host.textContent).toContain('HLV Marcus Vance');
    expect(host.textContent).toContain('Lịch dạy tuần này');
    expect(host.textContent).toContain('Học viên đã ghi danh');

    // Verify session card renders
    expect(host.textContent).toContain('Reformer Pilates Core');
    expect(host.textContent).toContain('08:00 – 09:30');
    expect(host.textContent).toContain('Studio 01 (Tầng 2)');
    expect(host.textContent).toContain('2 / 12');
  });

  it('opens student roster modal showing fitness_goal and health_notes when clicking "Xem học viên"', async () => {
    await renderComponent();

    // Find and click the button to view students
    const viewBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Xem học viên')
    );
    expect(viewBtn).toBeDefined();

    await act(async () => {
      viewBtn?.click();
    });

    // Check modal header
    expect(host.textContent).toContain('Danh sách học viên: Reformer Pilates Core');

    // AC: Verify student 1 details, fitness_goal, and health_notes
    expect(host.textContent).toContain('Nguyễn Văn An');
    expect(host.textContent).toContain('MB-2026-089');
    expect(host.textContent).toContain('Mục tiêu thể lực (Fitness Goal)');
    expect(host.textContent).toContain('Giảm 3kg mỡ, tăng cơ nạc và săn chắc vùng bụng dưới');
    expect(host.textContent).toContain('Lưu ý sức khỏe & Tiền sử chấn thương (Health Notes)');
    expect(host.textContent).toContain('Tiền sử thoát vị đĩa đệm nhẹ L4-L5, tránh deadlift tạ nặng');

    // AC: Verify student 2 details
    expect(host.textContent).toContain('Trần Thị Mai');
    expect(host.textContent).toContain('Tăng cường độ dẻo dai khớp vai và phục hồi dáng đứng');
  });

  it('navigates weeks using "Tuần sau →" and "← Tuần trước" buttons', async () => {
    await renderComponent();

    const nextBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tuần sau')
    );
    expect(nextBtn).toBeDefined();

    await act(async () => {
      nextBtn?.click();
    });

    // coachingApi.getCoachSchedule should have been called again for next week
    expect(coachingApi.getCoachSchedule).toHaveBeenCalledTimes(2);
  });
});
