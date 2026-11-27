import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../../shared/i18n/language';
import { ManagerCoachAssignmentsPage } from './ManagerCoachAssignmentsPage';
import { coachAssignmentsApi, type CoachAssignmentData } from './coachAssignmentsApi';

const assignmentsCss = readFileSync(resolve(__dirname, 'manager-coach-assignments.css'), 'utf8');


vi.mock('./coachAssignmentsApi', () => ({
  coachAssignmentsApi: {
    getOverview: vi.fn(),
  },
}));

vi.mock('../../shared/api/client', () => ({
  apiFetch: vi.fn(),
}));

describe('ManagerCoachAssignmentsPage', () => {
  let host: HTMLDivElement;
  let root: Root;

  const mockData: CoachAssignmentData = {
    availableCoaches: [
      { coachId: 10, coachName: 'HLV Trần Văn A', specialization: 'Fitness & Bulking' },
      { coachId: 11, coachName: 'HLV Nguyễn Thị B', specialization: 'Pilates & Yoga' },
    ],
    stats: {
      totalCoaches: 2,
      activeCoaches: 2,
      totalAssignedStudents: 3,
      totalPtStudents: 1,
      totalPlanStudents: 1,
      totalClassStudents: 1,
    },
    coaches: [
      {
        coachId: 10,
        coachName: 'HLV Trần Văn A',
        coachEmail: 'coach.a@solfitness.vn',
        coachPhone: '0901234567',
        specialization: 'Fitness & Bulking',
        bio: '10 năm kinh nghiệm',
        employmentStatus: 'ACTIVE',
        totalStudentsCount: 2,
        ptStudentsCount: 1,
        planStudentsCount: 1,
        classStudentsCount: 0,
        students: [
          {
            memberId: 101,
            membershipCode: 'MEM-001',
            fullName: 'Nguyễn Văn Member',
            phone: '0912345678',
            email: 'member1@test.com',
            avatarUrl: null,
            fitnessGoal: 'Tăng cơ giảm mỡ',
            fitnessLevel: 'INTERMEDIATE',
            healthNotes: 'Không có chấn thương',
            assignmentType: 'PT_1_1',
            assignmentTypeLabel: 'Kèm riêng 1:1',
            detail: 'Buổi PT Fitness cá nhân',
            startDate: '2026-11-01',
            endDate: '2026-11-30',
            nextSession: '2026-11-10 09:00',
            status: 'confirmed',
            referenceId: 501,
          },
          {
            memberId: 102,
            membershipCode: 'MEM-002',
            fullName: 'Lê Thị Hoa',
            phone: '0933333333',
            email: 'hoa.le@test.com',
            avatarUrl: null,
            fitnessGoal: 'Giảm 3kg mỡ',
            fitnessLevel: 'BEGINNER',
            healthNotes: 'Đau khớp gối nhẹ',
            assignmentType: 'TRAINING_PLAN',
            assignmentTypeLabel: 'Giáo án riêng',
            detail: 'Kế hoạch siết cơ 4 tuần',
            startDate: '2026-11-05',
            endDate: '2026-12-05',
            nextSession: null,
            status: 'active',
            referenceId: 601,
            membershipIssue: 'FROZEN',
          },
        ],
      },
      {
        coachId: 11,
        coachName: 'HLV Nguyễn Thị B',
        coachEmail: 'coach.b@solfitness.vn',
        coachPhone: '0909999999',
        specialization: 'Pilates & Yoga',
        bio: 'Chứng chỉ quốc tế',
        employmentStatus: 'ACTIVE',
        totalStudentsCount: 1,
        ptStudentsCount: 0,
        planStudentsCount: 0,
        classStudentsCount: 1,
        students: [
          {
            memberId: 103,
            membershipCode: 'MEM-003',
            fullName: 'Phạm Minh Tuấn',
            phone: '0988888888',
            email: 'tuan.pm@test.com',
            avatarUrl: null,
            fitnessGoal: 'Dẻo dai',
            fitnessLevel: 'ALL',
            healthNotes: null,
            assignmentType: 'CLASS',
            assignmentTypeLabel: 'Lớp học nhóm',
            detail: 'Lớp Pilates Sáng Thứ 7',
            startDate: '2026-11-08',
            endDate: '2026-11-08',
            nextSession: '2026-11-08 07:00',
            status: 'confirmed',
            referenceId: 701,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    vi.mocked(coachAssignmentsApi.getOverview).mockImplementation(async (params) => {
      if (params?.search === 'Lê Thị Hoa') {
        return {
          stats: mockData.stats,
          availableCoaches: mockData.availableCoaches,
          coaches: [
            {
              ...mockData.coaches[0],
              students: [mockData.coaches[0].students[1]],
              totalStudentsCount: 1,
            },
          ],
        };
      }
      return mockData;
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    setLanguage('vi');
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // Dựng component vào DOM giả để kiểm thử.
  async function renderComponent() {
    await act(async () => {
      root.render(<ManagerCoachAssignmentsPage />);
    });
    // Chờ bộ hẹn giờ debounce 200ms và hoàn tất promise tải dữ liệu
    await act(async () => {
      await new Promise((r) => setTimeout(r, 260));
    });
  }

  it('renders the header and summary stats correctly', async () => {
    await renderComponent();

    expect(host.textContent).toContain('HLV & học viên phụ trách');
    expect(host.textContent).toContain('Học viên đang phụ trách');
    expect(host.textContent).toContain('Tất cả HLV (2 đang hoạt động)');
    expect(host.textContent).not.toContain('Tổng học viên đang theo kèm');
    expect(host.textContent).toContain('Học viên tập 1:1 (PT)');
    expect(host.textContent).toContain('Theo giáo án riêng');
    expect(host.textContent).toContain('HLV Trần Văn A');
    expect(host.textContent).toContain('HLV Nguyễn Thị B');
    expect(host.textContent).toContain('Nguyễn Văn Member');
    expect(host.textContent).toContain('Lê Thị Hoa');
    expect(host.textContent).toContain('Phạm Minh Tuấn');
    expect(host.textContent).toContain('Lớp học nhóm');
    expect(host.querySelector('option[value="CLASS"]')).not.toBeNull();
  });

  it('tags only the student whose plan is on hold', async () => {
    await renderComponent();
    const tags = host.querySelectorAll('.coach-membership-issue');
    expect(tags).toHaveLength(1);
    expect(tags[0].textContent).toBe('Đang bảo lưu');
  });

  it('filters students based on search input', async () => {
    await renderComponent();

    const searchInput = host.querySelector('input[type="search"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      nativeInputValueSetter?.call(searchInput, 'Lê Thị Hoa');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 260));
    });

    expect(host.textContent).toContain('Lê Thị Hoa');
    expect(host.textContent).not.toContain('Nguyễn Văn Member');
  });

  it('keeps the coach filter and search independent', async () => {
    await renderComponent();
    const search = host.querySelector('input[type="search"]') as HTMLInputElement;
    const coach = host.querySelector('select[aria-label="Lọc theo Huấn luyện viên"]') as HTMLSelectElement;
    await act(async () => { coach.value = '11'; coach.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(search, 'Trần Văn A');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 260)); });
    expect(coach.value).toBe('11');
    expect(coachAssignmentsApi.getOverview).toHaveBeenLastCalledWith(expect.objectContaining({ coachId: 11, search: 'Trần Văn A' }));
  });

  it('is view-only: no transfer or end-assignment actions on any row', async () => {
    await renderComponent();
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent ?? '');
    expect(labels.some((text) => text.includes('Chuyển') || text.includes('Kết thúc'))).toBe(false);
    await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Bảng danh sách'))!.click(); });
    const rowButtons = [...host.querySelectorAll('.coach-table tbody button')].map((b) => b.textContent);
    expect(rowButtons.every((text) => text === 'Chi tiết')).toBe(true);
  });

  it('labels coaches who are no longer employed', async () => {
    vi.mocked(coachAssignmentsApi.getOverview).mockResolvedValue({
      ...mockData, coaches: [{ ...mockData.coaches[0], employmentStatus: 'terminated' }],
    });
    await renderComponent();
    expect(host.querySelector('.coach-card-header h3')?.textContent).toContain('Đã nghỉ việc');
  });

  it('switches between cards and table view mode', async () => {
    await renderComponent();

    const tableModeBtn = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Bảng danh sách')
    );
    expect(tableModeBtn).toBeTruthy();

    await act(async () => {
      tableModeBtn?.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(host.querySelector('.coach-table-container')).toBeTruthy();
    expect(host.textContent).toContain('MEM-001');
    expect(host.textContent).toContain('MEM-002');
    expect(host.textContent).toContain('Hết hạn giáo án / Buổi kế tiếp');
    const rows = [...host.querySelectorAll('.coach-table tbody tr')];
    expect(rows.find(row => row.textContent?.includes('MEM-001'))?.querySelectorAll('td')[4]?.textContent).toBe('09:00 10/11/2026');
    expect(rows.find(row => row.textContent?.includes('MEM-002'))?.querySelectorAll('td')[4]?.textContent).toBe('05/12/2026');
  });

  it('shows unavailable schedule data without claiming the assignment is active', async () => {
    const coach = mockData.coaches[0];
    vi.mocked(coachAssignmentsApi.getOverview).mockResolvedValue({
      ...mockData, coaches: [{ ...coach, students: [{ ...coach.students[0], nextSession: null }] }],
    });
    await renderComponent();
    await act(async () => { [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Bảng danh sách'))?.click(); });
    expect(host.querySelector('.coach-table tbody tr td:nth-child(5)')?.textContent).toBe('Chưa có thông tin');
  });

  it('shows a member once per coach even when they hold several assignments', async () => {
    const [coachA] = mockData.coaches;
    const [pt, plan] = coachA.students;
    vi.mocked(coachAssignmentsApi.getOverview).mockResolvedValue({
      ...mockData,
      coaches: [{ ...coachA, students: [pt, { ...plan, memberId: pt.memberId, membershipCode: pt.membershipCode, fullName: pt.fullName }] }],
    });
    await renderComponent();
    const rows = [...host.querySelectorAll('.coach-student-row')];
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelectorAll('.student-name-block strong')).toHaveLength(1);
    expect(rows[0].querySelectorAll('.coach-assignment-line')).toHaveLength(2);
  });

  it('shows one Chi tiết per member, the grouped PT session count and every assignment in the profile', async () => {
    const [coachA] = mockData.coaches;
    const [pt, plan] = coachA.students;
    vi.mocked(coachAssignmentsApi.getOverview).mockResolvedValue({
      ...mockData,
      coaches: [{ ...coachA, students: [{ ...plan, memberId: pt.memberId, membershipIssue: null }, { ...pt, sessionCount: 2 }] }],
    });
    await renderComponent();
    const row = host.querySelector('.coach-student-row')!;
    const buttons = [...row.querySelectorAll('button')].map(b => b.textContent);
    expect(buttons.filter(text => text === 'Chi tiết')).toHaveLength(1);
    expect(buttons.filter(text => text?.includes('Chuyển') || text?.includes('Kết thúc'))).toHaveLength(0);
    expect(row.textContent).toContain('09:00 10/11/2026 · 2 buổi sắp tới');
    await act(async () => { [...row.querySelectorAll('button')].find(b => b.textContent === 'Chi tiết')!.click(); });
    expect(host.querySelectorAll('dialog .coach-student-type-pill')).toHaveLength(2);
  });

  it('closes the student detail modal via the top-right close button without a duplicate Đóng button', async () => {
    await renderComponent();
    const detailBtn = [...host.querySelectorAll<HTMLButtonElement>('.coach-student-row button')].find(
      (b) => b.textContent?.trim() === 'Chi tiết',
    )!;
    await act(async () => {
      detailBtn.click();
    });

    const dialog = host.querySelector('dialog[open]');
    expect(dialog).not.toBeNull();
    const closeIconBtn = dialog!.querySelector<HTMLButtonElement>('.portal-dialog__close');
    expect(closeIconBtn).not.toBeNull();
    expect(
      [...dialog!.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent?.trim() === 'Đóng' || b.textContent?.trim() === 'Close',
      ),
    ).toBeUndefined();

    await act(async () => {
      closeIconBtn!.click();
    });
    expect(host.querySelector('dialog')).toBeNull();
  });

  it('displays group class assignments as view-only without coach reassignment button', async () => {
    await renderComponent();
    const row = [...host.querySelectorAll('.coach-student-row')].find(r => r.textContent?.includes('Phạm Minh Tuấn'));
    expect(row).toBeDefined();
    expect(row!.textContent).toContain('Lớp học nhóm');
    expect(row!.textContent).not.toContain('Chuyển');
  });

  it('formats assignment deadlines and PT times', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T18:05:00Z'));
    await renderComponent();
    expect(host.textContent).toContain('09:00 10/11/2026');
    expect(host.textContent).toContain('Ngày kết thúc giáo án: 05/12/2026');
  });

  it('requests sorted coaches list when sort dropdown value changes', async () => {
    await renderComponent();

    const sortSelect = host.querySelector('select[aria-label="Sắp xếp danh sách HLV"]') as HTMLSelectElement;
    expect(sortSelect).toBeTruthy();
    expect(sortSelect.querySelector('option[value="pt_desc"]')).toBeNull();

    expect(coachAssignmentsApi.getOverview).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'name', sortDir: 'asc' })
    );

    await act(async () => {
      sortSelect.value = 'students_desc';
      sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      await new Promise(r => setTimeout(r, 260));
    });

    expect(coachAssignmentsApi.getOverview).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'totalStudentsCount', sortDir: 'desc' })
    );

  });

  it('sorts coaches by Vietnamese names and distinct visible members in both views', async () => {
    const [base, legacy] = mockData.coaches;
    const [pt, plan] = base.students;
    const a = { ...base, coachId: 20, coachName: 'HLV Ánh', students: [pt, { ...pt, referenceId: 502 }, { ...plan, memberId: pt.memberId }] };
    const b = { ...base, coachId: 30, coachName: 'HLV Bình', students: [pt, plan] };
    const c = { ...legacy, coachId: 40, coachName: 'HLV An', students: [legacy.students[0]] };
    vi.mocked(coachAssignmentsApi.getOverview).mockImplementation(async params => ({
      ...mockData,
      coaches: [b, a, c].map(coach => {
        const students = coach.students.filter(student => !params?.type || student.assignmentType === params.type);
        const count = (type?: string) => new Set(students.filter(st => !type || st.assignmentType === type).map(st => st.memberId)).size;
        return { ...coach, students, totalStudentsCount: count(), ptStudentsCount: count('PT_1_1'), planStudentsCount: count('TRAINING_PLAN'), classStudentsCount: count('CLASS') };
      }),
    }));
    await renderComponent();
    const names = () => [...host.querySelectorAll('.coach-card-header h3')].map(el => el.textContent);
    const counts = () => [...host.querySelectorAll('.coach-card-header')].map(el => [...el.querySelectorAll('.student-count-pill strong')].map(x => x.textContent));
    expect(names()).toEqual(['HLV An', 'HLV Ánh', 'HLV Bình']);
    expect(counts()).toEqual([['1', '0', '0', '1'], ['1', '1', '1', '0'], ['2', '1', '1', '0']]);
    const select = host.querySelector('select[aria-label="Sắp xếp danh sách HLV"]') as HTMLSelectElement;
    const choose = async (value: string) => {
      await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
      await act(async () => { await new Promise(r => setTimeout(r, 260)); });
    };
    await choose('name_desc');
    expect(names()).toEqual(['HLV Bình', 'HLV Ánh', 'HLV An']);
    await choose('students_desc');
    expect(names()).toEqual(['HLV Bình', 'HLV An', 'HLV Ánh']);
    await choose('students_asc');
    expect(names()).toEqual(['HLV An', 'HLV Ánh', 'HLV Bình']);
    await act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Bảng danh sách'))!.click(); });
    expect([...host.querySelectorAll('.coach-table tbody tr')].map(row => row.querySelectorAll('td')[1].textContent)).toEqual([
      'HLV An', 'HLV Ánh', 'HLV Ánh', 'HLV Ánh', 'HLV Bình', 'HLV Bình',
    ]);
    await act(async () => { [...host.querySelectorAll('button')].find(button => button.textContent === 'Theo HLV')!.click(); });
    const typeFilter = host.querySelector('select[aria-label="Lọc theo hình thức"]') as HTMLSelectElement;
    await act(async () => { typeFilter.value = 'PT_1_1'; typeFilter.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { await new Promise(r => setTimeout(r, 260)); });
    expect(names()).toEqual(['HLV An', 'HLV Ánh', 'HLV Bình']);
    expect(counts()).toEqual([['0', '0', '0', '0'], ['1', '1', '0', '0'], ['1', '1', '0', '0']]);
  });

  it('P1-FE-20, P2-FE-41 & P2-FE-76: displays detail on CLASS & PT rows, renders Group classes KPI/pill, localizes type pills, and uses theme CSS tokens', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await renderComponent();

      // KPI & pill include Group class members
      expect(host.textContent).toContain('Học viên lớp nhóm');
      expect(host.textContent).toContain('Lớp nhóm');
      // Card view renders detail for CLASS and PT_1_1 (not only TRAINING_PLAN)
      expect(host.textContent).toContain('Lớp Pilates Sáng Thứ 7');
      expect(host.textContent).toContain('Buổi PT Fitness cá nhân');

      // Table view also renders detail for CLASS and PT_1_1
      await act(async () => {
        [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Bảng danh sách'))?.click();
      });
      const tableText = host.querySelector('.coach-table')?.textContent ?? '';
      expect(tableText).toContain('Lớp Pilates Sáng Thứ 7');
      expect(tableText).toContain('Buổi PT Fitness cá nhân');

      // Switching language to EN translates assignmentType pills dynamically
      await act(async () => {
        setLanguage('en');
      });
      const enTableText = host.querySelector('.coach-table')?.textContent ?? '';
      expect(enTableText).toContain('1:1 PT');
      expect(enTableText).toContain('Training plan');
      expect(enTableText).toContain('Group class');
      await act(async () => {
        setLanguage('vi');
      });

      // Clearing target coach select resets to empty string (not 0) and disables submit
      // CSS tokens check (no hardcoded coral rgba(255, 122, 89, ...))
      expect(assignmentsCss).not.toContain('rgba(255, 122, 89');
      expect(assignmentsCss).toContain('rgb(var(--sol-accent-rgb)');
      expect(assignmentsCss).toContain('var(--portal-raised)');

      // Retry button styling on load error
      vi.mocked(coachAssignmentsApi.getOverview).mockRejectedValueOnce(new Error('Mất kết nối'));
      await act(async () => root.unmount());
      root = createRoot(host);
      await renderComponent();
      const retryBtn = host.querySelector<HTMLButtonElement>('[role="alert"] button')!;
      expect(retryBtn.className).toContain('btn-secondary');
      expect(retryBtn.className).toContain('btn-sm');

      // No React duplicate-key warning
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('same key'), expect.anything(), expect.anything());
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

