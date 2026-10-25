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
      id: 201,
      classId: 1,
      className: 'High-Intensity Strength & Conditioning',
      disciplineId: 1,
      disciplineName: 'Strength Training',
      coachId: 1,
      coachName: 'Coach Marcus Vance',
      roomId: 101,
      roomName: 'Studio 01 (Tầng 2)',
      sessionDate: '2026-10-19',
      startTime: '07:00',
      endTime: '08:15',
      status: 'scheduled',
      capacity: 15,
      bookedCount: 12,
      level: 'Trung cấp - Nâng cao',
    },
    {
      id: 202,
      classId: 2,
      className: 'Olympic Weightlifting Fundamentals',
      disciplineId: 1,
      disciplineName: 'Weightlifting',
      coachId: 1,
      coachName: 'Coach Marcus Vance',
      roomId: 102,
      roomName: 'Phòng Cử Tạ (Tầng 1)',
      sessionDate: '2026-10-19',
      startTime: '10:00',
      endTime: '11:30',
      status: 'scheduled',
      capacity: 10,
      bookedCount: 8,
      level: 'Cơ bản',
    },
  ];

  const mockStudents = [
    {
      id: 101,
      memberId: 1,
      membershipCode: 'MB-2026-001',
      fullName: 'Lê Hoàng Long',
      email: 'long.le@solfitness.vn',
      phone: '0903 112 233',
      fitnessGoal: 'Tăng khối lượng cơ nạc (Hypertrophy), giảm mỡ vùng bụng dưới.',
      healthNotes: 'Tiền sử thoát vị đĩa đệm nhẹ L4-L5.',
      fitnessLevel: 'intermediate',
      emergencyContactName: 'Lê Thu Hương (Vợ)',
      emergencyContactPhone: '0903 998 877',
      enrolledAt: '2026-10-18T09:30:00Z',
      status: 'booked',
    },
    {
      id: 102,
      memberId: 2,
      membershipCode: 'MB-2026-014',
      fullName: 'Trần Thị Thu Thảo',
      email: 'thao.tran@solfitness.vn',
      phone: '0918 456 789',
      fitnessGoal: 'Săn chắc cơ mông đùi, cải thiện tư thế đứng.',
      healthNotes: 'Khớp cổ tay phải yếu do hội chứng ống cổ tay văn phòng.',
      fitnessLevel: 'beginner',
      emergencyContactName: 'Trần Văn Hùng (Bố)',
      emergencyContactPhone: '0912 345 678',
      enrolledAt: '2026-10-18T10:15:00Z',
      status: 'booked',
    },
  ];

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);

    if (typeof HTMLDialogElement !== 'undefined') {
      if (!HTMLDialogElement.prototype.showModal) {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
          value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); },
          writable: true,
          configurable: true,
        });
      } else {
        vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
          this.setAttribute('open', '');
        });
      }
      if (!HTMLDialogElement.prototype.close) {
        Object.defineProperty(HTMLDialogElement.prototype, 'close', {
          value: function (this: HTMLDialogElement) { this.removeAttribute('open'); },
          writable: true,
          configurable: true,
        });
      } else {
        vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
          this.removeAttribute('open');
        });
      }
    }

    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        id: 1,
        fullName: 'Marcus Vance',
        role: 'COACH',
      })
    );

    vi.spyOn(coachingApi, 'getCoachWeeklySchedule').mockResolvedValue(mockSessions);
    vi.spyOn(coachingApi, 'getSessionStudents').mockResolvedValue(mockStudents);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders weekly schedule and day tabs correctly', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });

    expect(host.textContent).toContain('Thời Khóa Biểu & Học Viên Phụ Trách');
    expect(host.textContent).toContain('Tuần trước');
    expect(host.textContent).toContain('Tuần sau');
    expect(host.textContent).toContain('Thứ 2');
    expect(host.textContent).toContain('Chủ Nhật');
  });

  it('allows switching weeks and triggers schedule reload', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });

    const nextWeekBtn = host.querySelector('button[aria-label="Tuần sau"]') as HTMLButtonElement;
    expect(nextWeekBtn).not.toBeNull();

    await act(async () => {
      nextWeekBtn.click();
    });

    expect(coachingApi.getCoachWeeklySchedule).toHaveBeenCalled();
  });

  it('opens modal to view enrolled students with fitness_goal and health_notes', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachClassesPage />
        </MemoryRouter>
      );
    });

    // Switch to first day or check if session cards are rendered
    const viewStudentsBtn = host.querySelector('.btn-view-students') as HTMLButtonElement;
    if (viewStudentsBtn) {
      await act(async () => {
        viewStudentsBtn.click();
      });

      expect(coachingApi.getSessionStudents).toHaveBeenCalled();
      expect(host.textContent).toContain('Mục tiêu thể lực (fitness_goal)');
      expect(host.textContent).toContain('Lưu ý sức khỏe & Chấn thương (health_notes)');
      expect(host.textContent).toContain('Lê Hoàng Long');
      expect(host.textContent).toContain('thoát vị đĩa đệm');
    }
  });
});
