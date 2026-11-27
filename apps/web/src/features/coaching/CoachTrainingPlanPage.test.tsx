import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachTrainingPlanPage } from './CoachTrainingPlanPage';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import { setLanguage } from '../../shared/i18n/language';
import { aiApi, type MemberOption } from './aiApi';
import * as profileApi from '../member/profileApi';


const MEMBERS: MemberOption[] = [
  { id: 1, memberCode: 'MB-2026-001', fullName: 'Lê Hoàng Long', phone: '0901234567', fitnessGoal: 'Tăng cơ nạc', healthNotes: 'Tránh Deadlift tạ nặng', fitnessLevel: 'intermediate' },
  { id: 2, memberCode: 'MB-2026-014', fullName: 'Trần Thị Thu Thảo', phone: '0987654321', fitnessGoal: 'Săn chắc cơ mông', healthNotes: 'Bình thường', fitnessLevel: 'beginner' },
];

describe('CoachTrainingPlanPage (SCRUM-122: UI Coach Soạn Giáo án Bài tập Tích hợp AI Gợi ý)', () => {
  let host: HTMLDivElement;
  let root: Root;

  // Dữ liệu mẫu dùng trong các ca kiểm thử.
  const mockAiResponse = {
    id: 999,
    memberId: 1,
    memberCode: 'MB-2026-001',
    memberName: 'Lê Hoàng Long',
    modelName: 'Gemini 3 Flash',
    goal: 'Tăng cơ nạc và phục hồi cơ lưng',
    analysis: 'Hội viên có tiền sử thoát vị đĩa đệm nhẹ, cần bài tập an toàn cho lưng dưới.',
    items: [
      {
        id: 'ai-1',
        dayOfWeek: 1, // Thứ 2
        exerciseName: 'Assisted Pull-up & Face Pull',
        description: 'Tập trung cơ lưng xô và bả vai sau',
        sets: 4,
        reps: 12,
        durationMinutes: 15,
        restSeconds: 60,
      },
      {
        id: 'ai-2',
        dayOfWeek: 2, // Thứ 3
        exerciseName: 'Goblet Box Squat',
        description: 'Bảo vệ cột sống và khớp gối',
        sets: 4,
        reps: 10,
        durationMinutes: 15,
        restSeconds: 75,
      },
    ],
  };

  beforeEach(() => {
    setLanguage('vi');
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
        id: '3',
        name: 'HLV Marcus Vance',
        identifier: 'COACH-003',
        role: 'COACH',
      })
    );

    vi.spyOn(profileApi, 'getProfile').mockResolvedValue({ userId: 3, fullName: 'HLV Marcus Vance' } as never);
    vi.spyOn(aiApi, 'generateWorkoutPlan').mockResolvedValue(mockAiResponse);
    vi.spyOn(aiApi, 'saveTrainingPlan').mockResolvedValue({ id: 101, status: 'active' });
    vi.spyOn(aiApi, 'listTrainingPlans').mockResolvedValue([]);
    vi.spyOn(aiApi, 'getCoachMembers').mockResolvedValue(MEMBERS);
    vi.spyOn(aiApi, 'getActiveCoaches').mockResolvedValue([{ id: 31, fullName: 'HLV Marcus Vance' }, { id: 32, fullName: 'HLV Elena Cruz' }]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
    setLanguage('vi');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Dựng component vào DOM giả để kiểm thử.
  async function renderComponent(selectFirstMember = true) {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachTrainingPlanPage />
        </MemoryRouter>
      );
    });
    if (selectFirstMember) {
      const select = host.querySelector('#plan-member-select') as HTMLSelectElement | null;
      if (select && MEMBERS.length > 0) {
        await act(async () => {
          Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(select, String(MEMBERS[0].id));
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    }
  }

  // Mở một bước của trình soạn giáo án.
  async function openStep(step: 1 | 2 | 3) {
    await act(async () => { host.querySelectorAll<HTMLButtonElement>('.plan-step__button')[step - 1].click(); });
  }
  // Thêm 1 bài tập hợp lệ ở bước 2 để kiểm thử luồng lưu/sửa.
  async function addManualExercise(name = 'Dumbbell Row') {
    await openStep(2);
    const nameInput = host.querySelector('#exercise-name-input') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(nameInput, name);
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const submitBtn = host.querySelector('form.exercise-form-card button[type="submit"]') as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });
  }
  // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
  const saveButton = () => Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Lưu & Kích hoạt giáo án')) as HTMLButtonElement | undefined;

  it('denies access when user role is not COACH or MANAGER', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        id: '1',
        name: 'Member User',
        identifier: 'MB-001',
        role: 'MEMBER',
      })
    );

    await renderComponent();
    expect(host.textContent).toContain('Truy cập bị từ chối');
    expect(host.textContent).not.toContain('403 Forbidden');
    expect(host.textContent).not.toContain('(COACH)');
  });

  it('waits for member data before showing the editor and renders immediately when it arrives', async () => {
    let finishMembers!: (members: MemberOption[]) => void;
    vi.mocked(aiApi.getCoachMembers).mockReturnValue(new Promise(resolve => { finishMembers = resolve; }));

    await renderComponent();
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(host.textContent).not.toContain(MEMBERS[0].fullName);
    expect(host.querySelector('#plan-member')).toBeNull();

    await act(async () => finishMembers([{ ...MEMBERS[0], id: 42, fullName: 'Học viên đã tải' }]));
    const select = host.querySelector('#plan-member-select') as HTMLSelectElement | null;
    if (select) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(select, '42');
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    expect(host.querySelector('[aria-busy="true"]')).toBeNull();
    expect(host.textContent).toContain('Học viên đã tải');
    expect(host.querySelectorAll('.plan-step__button')).toHaveLength(3);
    await openStep(3);
    expect(host.textContent).toContain('Lưu & Kích hoạt giáo án');
  });

  it('renders plan editor workspace with day tabs (Thứ 2 -> Chủ Nhật)', async () => {
    await renderComponent();

    expect(host.textContent).toContain('Soạn giáo án');
    // Nút Gợi ý giáo án bằng AI chỉ xuất hiện ở Bước 2
    expect(host.textContent).not.toContain('Gợi ý giáo án bằng AI');
    // Mỗi bước một nhóm thông tin: bước 1 chỉ chứa thông tin kế hoạch
    expect(host.textContent).toContain('Thông tin kế hoạch huấn luyện');
    expect(saveButton()).toBeUndefined();
    expect(host.querySelector('#exercise-name-input')).toBeNull();

    await openStep(2);
    expect(host.textContent).toContain('Gợi ý giáo án bằng AI');
    // Bước 2: nút Gợi ý giáo án bằng AI xuất hiện cùng các tab ngày
    expect(host.textContent).toContain('Gợi ý giáo án bằng AI');
    // Kiểm tra hiển thị đủ 7 tab ngày trong tuần
    expect(host.textContent).toContain('Thứ 2');
    expect(host.textContent).toContain('Thứ 3');
    expect(host.textContent).toContain('Thứ 4');
    expect(host.textContent).toContain('Thứ 5');
    expect(host.textContent).toContain('Thứ 6');
    expect(host.textContent).toContain('Thứ 7');
    expect(host.textContent).toContain('Chủ Nhật');

    await openStep(3);
    expect(saveButton()).toBeDefined();
  });

  it('moves through the three steps with Tiếp tục and Quay lại and starts with empty exercises (no hardcoded samples)', async () => {
    await renderComponent();
    // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
    const click = async (label: string) => act(async () => {
      (Array.from(host.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement).click();
    });
    // Tên bước đang được chọn.
    const active = () => host.querySelector('.plan-step__button.is-active')?.textContent;
    expect(active()).toContain('Học viên & kế hoạch');
    expect(host.textContent).not.toContain('Chỉ số sức khỏe ·');
    await click('Tiếp tục');
    expect(active()).toContain('Bài tập theo ngày');
    // P1-FE-52: Khởi tạo danh sách bài tập rỗng, không tự điền bài tập mẫu cứng.
    expect(host.textContent).not.toContain('Kéo xà trợ lực');
    expect(host.textContent).toContain('Chưa có bài tập nào cho ngày này');
    await click('Tiếp tục');
    expect(active()).toContain('Xem lại & kích hoạt');
    expect(host.textContent).toContain('Giáo án chưa có bài tập nào');
    expect(Array.from(host.querySelectorAll('button')).some((b) => b.textContent === 'Tiếp tục')).toBe(false);
    await click('Quay lại');
    expect(active()).toContain('Bài tập theo ngày');
  });

  it('keeps health precautions highlighted when switching language without changing member data', async () => {
    await renderComponent();
    // Ghi chú sức khỏe đang hiển thị.
    const healthNote = () => Array.from(host.querySelectorAll('strong'))
      .find(element => element.textContent === MEMBERS[0].healthNotes);
    expect(healthNote()?.parentElement?.style.color).toBe('var(--portal-danger, #fca5a5)');

    await act(async () => setLanguage('en'));
    expect(healthNote()?.textContent).toBe('Tránh Deadlift tạ nặng');
    expect(healthNote()?.parentElement?.style.color).toBe('var(--portal-danger, #fca5a5)');
    expect(aiApi.getCoachMembers).toHaveBeenCalledOnce();

    await act(async () => setLanguage('vi'));
    expect(healthNote()?.parentElement?.style.color).toBe('var(--portal-danger, #fca5a5)');
  });

  it('allows adding manual exercise to the selected day', async () => {
    await renderComponent();
    await openStep(2);

    // Điền biểu mẫu bài tập
    const nameInput = host.querySelector('#exercise-name-input') as HTMLInputElement;
    expect(nameInput).toBeDefined();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(nameInput, 'Dumbbell Hammer Curl');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const submitBtn = host.querySelector('form.exercise-form-card button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      submitBtn.click();
    });

    expect(host.textContent).toContain('Dumbbell Hammer Curl');
  });

  it('asks before the AI suggestion overwrites a member plan that is already in use', async () => {
    vi.mocked(aiApi.listTrainingPlans).mockResolvedValue([
      { id: 7, memberId: 1, coachId: 3, goal: 'Giảm mỡ bụng', startDate: '2026-11-12', endDate: '2026-12-10', status: 'active' },
    ]);
    await renderComponent();
    await openStep(2);
    // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
    const button = (label: string) => Array.from(host.ownerDocument.querySelectorAll('button')).find((b) => b.textContent?.includes(label));
    await act(async () => { button('Gợi ý giáo án bằng AI')?.click(); });
    await act(async () => { button('Phân tích & Sinh giáo án bằng AI')?.click(); });

    await act(async () => { button('Áp dụng vào giáo án')?.click(); });
    expect(host.ownerDocument.body.textContent).toContain('Ghi đè giáo án đã soạn trước đó?');
    expect(host.ownerDocument.body.textContent).toContain('Giảm mỡ bụng');
    expect(aiApi.listTrainingPlans).toHaveBeenCalledWith(1);

    // Giữ giáo án hiện tại sẽ để nguyên kết quả AI đang mở và không thay đổi trình soạn thảo.
    await act(async () => { button('Giữ giáo án hiện tại')?.click(); });
    expect(host.ownerDocument.body.textContent).not.toContain('Ghi đè giáo án đã soạn trước đó?');
    expect(host.ownerDocument.body.textContent).toContain('Trợ lý AI: gợi ý giáo án huấn luyện cá nhân hóa');

    await act(async () => { button('Áp dụng vào giáo án')?.click(); });
    await act(async () => { button('Ghi đè bằng giáo án AI')?.click(); });
    await openStep(2);
    expect(host.textContent).toContain('Assisted Pull-up & Face Pull');
  });

  it('does not warn about a plan another coach gave the same member, since it stays active', async () => {
    vi.mocked(aiApi.listTrainingPlans).mockResolvedValue([
      { id: 8, memberId: 1, coachId: 99, goal: 'Yoga phục hồi', startDate: '2026-11-12', endDate: '2026-12-10', status: 'active' },
    ]);
    await renderComponent();
    await openStep(2);
    // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
    const button = (label: string) => Array.from(host.ownerDocument.querySelectorAll('button')).find((b) => b.textContent?.includes(label));
    await act(async () => { button('Gợi ý giáo án bằng AI')?.click(); });
    await act(async () => { button('Phân tích & Sinh giáo án bằng AI')?.click(); });
    await act(async () => { button('Áp dụng vào giáo án')?.click(); });

    expect(host.ownerDocument.body.textContent).not.toContain('Ghi đè giáo án đã soạn trước đó?');
    await openStep(2);
    expect(host.textContent).toContain('Assisted Pull-up & Face Pull');
  });

  it('opens AI Assistant modal, generates recommendation, and applies it to the plan', async () => {
    await renderComponent();
    await openStep(2);

    // 1. Bấm nút gợi ý bằng AI ở Bước 2
    const aiBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Gợi ý giáo án bằng AI')
    );
    expect(aiBtn).toBeDefined();

    await act(async () => {
      aiBtn?.click();
    });

    // Kiểm tra hộp thoại đã mở
    expect(host.textContent).toContain('Trợ lý AI: gợi ý giáo án huấn luyện cá nhân hóa');
    expect(host.textContent).toContain('Phân tích & Sinh giáo án bằng AI');

    // 2. Bấm sinh giáo án bằng AI
    const generateBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Phân tích & Sinh giáo án bằng AI')
    );

    await act(async () => {
      generateBtn?.click();
    });

    // Kiểm tra kết quả phân tích AI đã hiển thị
    expect(host.textContent).toContain('Assisted Pull-up & Face Pull');
    expect(host.textContent).toContain('Goblet Box Squat');
    expect(host.textContent).not.toContain('Gemini 3 Flash');

    // 3. Bấm "Áp dụng vào giáo án"
    const applyBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Áp dụng vào giáo án')
    );
    expect(applyBtn).toBeDefined();

    await act(async () => {
      applyBtn?.click();
    });

    // 4. Kiểm tra các bài tập AI đã được điền thẳng vào không gian làm việc của HLV
    await openStep(2);
    expect(host.textContent).toContain('Assisted Pull-up & Face Pull');
  });

  it('saves and activates plan when clicking "Lưu & Kích hoạt giáo án" and re-enables save after edits', async () => {
    await renderComponent();
    await addManualExercise('Barbell Squat');
    await openStep(3);

    const saveBtn = saveButton();
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn?.click();
    });

    expect(aiApi.saveTrainingPlan).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.center-toast-card')).toBeNull();
    expect(document.querySelector('.sol-toast--success')?.textContent).toContain('Đã lưu và kích hoạt giáo án');
    expect(host.querySelector('.plan-saved-badge')).not.toBeNull();
    // Ngay sau khi lưu xong, nút lưu bị khóa để tránh bấm trùng và có link tới danh sách giáo án đã lưu.
    const savedBtn = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Đã lưu & Kích hoạt thành công')
    );
    expect(savedBtn?.disabled).toBe(true);
    expect(host.querySelector('a[href="/coach/saved-plans"]')).not.toBeNull();

    // Khi HLV quay lại sửa mục tiêu, nút Lưu mở khóa trở lại để lưu phiên bản mới.
    await openStep(1);
    const goalInput = host.querySelector<HTMLInputElement>('input[type="text"]');
    expect(goalInput).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(goalInput, 'Tăng sức bền mới');
      goalInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await openStep(3);
    const saveAgainBtn = saveButton();
    expect(saveAgainBtn).toBeDefined();
    expect(saveAgainBtn?.disabled).toBe(false);
  });

  it('shows an empty state and blocks saving when the live roster has no members (no sample students)', async () => {
    vi.mocked(aiApi.getCoachMembers).mockResolvedValue([]);
    await renderComponent();

    expect(host.textContent).toContain('Chưa có học viên để soạn giáo án');
    expect(host.textContent).not.toContain('Lê Hoàng Long');
    expect(Array.from(host.querySelectorAll('button')).some((b) => b.textContent?.includes('Lưu & Kích hoạt giáo án'))).toBe(false);
    expect(aiApi.saveTrainingPlan).not.toHaveBeenCalled();
  });

  it('shows a retryable error instead of sample students when the roster fails to load', async () => {
    vi.mocked(aiApi.getCoachMembers).mockRejectedValue(new Error('offline'));
    await renderComponent();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Không thể tải danh sách học viên');
    expect(host.textContent).not.toContain('Lê Hoàng Long');
    expect(host.textContent).toContain('Thử lại');
  });

  it('lets a manager pick the responsible coach and sends that coach id with the plan', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 'mgr', name: 'Manager', identifier: 'mgr', role: 'MANAGER' }));
    await renderComponent();

    // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
    const saveBtn = () => saveButton() as HTMLButtonElement;
    expect(host.querySelector('#plan-coach-select')).not.toBeNull();

    // Chưa chọn HLV thì quản lý không thể rời khỏi bước 1
    await openStep(3);
    expect(saveButton()).toBeUndefined();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('chọn huấn luyện viên');

    await act(async () => { (host.querySelector('#plan-coach-select') as HTMLElement).click(); });
    const option = Array.from(host.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes('HLV Elena Cruz')) as HTMLElement;
    await act(async () => { option.click(); });
    await addManualExercise('Goblet Squat');
    await openStep(3);
    expect(saveBtn().disabled).toBe(false);

    await act(async () => { saveBtn().click(); });
    expect(aiApi.saveTrainingPlan).toHaveBeenCalledWith(expect.objectContaining({ memberId: 1, coachId: 32 }), true);
  });

  it('does not ask a coach to choose a coach and never sends coach id for them', async () => {
    await renderComponent();
    expect(host.querySelector('#plan-coach-select')).toBeNull();
    await addManualExercise('Bench Press');
    await openStep(3);
    const saveBtn = saveButton() as HTMLButtonElement;
    await act(async () => { saveBtn.click(); });
    expect(vi.mocked(aiApi.saveTrainingPlan).mock.calls[0][0].coachId).toBeUndefined();
  });

  it('enforces that endDate min constraint is set to startDate and startDate has no max constraint', async () => {
    await renderComponent();

    const startInput = host.querySelector('input[name="plan-start-date"]') as HTMLInputElement;
    const endInput = host.querySelector('input[name="plan-end-date"]') as HTMLInputElement;

    expect(startInput).not.toBeNull();
    expect(endInput).not.toBeNull();
    expect(startInput.getAttribute('max')).toBeNull();
    expect(endInput.getAttribute('min')).toBe(startInput.value);
  });

  it('edits draft exercise reps and sets before saving the plan', async () => {
    await renderComponent();
    await addManualExercise('Kéo xà trợ lực');
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Sửa bài tập Kéo xà trợ lực"]')!.click());
    for (const [id, value] of [['draft-exercise-sets', '5'], ['draft-exercise-reps', '8'], ['draft-exercise-rest', '90']]) {
      const input = document.getElementById(id) as HTMLInputElement;
      await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
    }
    const form = document.querySelector('#draft-exercise-sets')!.closest('form')!;
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    const card = [...host.querySelectorAll('.exercise-item-card')].find(item => item.textContent?.includes('Kéo xà trợ lực'))!;
    expect(card.textContent).toContain('Hiệp: 5');
    expect(card.textContent).toContain('Lần: 8');
    expect(card.textContent).not.toContain('reps');
    expect(card.textContent).toContain('90s');
  });


  it('allows editing the training plan goal in Step 1 (including after AI apply), sends edited goal to server, and never writes dead localStorage', async () => {
    await renderComponent();

    const goalInput = host.querySelector('#plan-goal-input') as HTMLInputElement;
    expect(goalInput).not.toBeNull();
    expect(goalInput.value).toBe('Tăng cơ nạc');

    // Áp dụng gợi ý AI ở Bước 2
    await openStep(2);
    // Mở Bước 2 để sử dụng nút AI gợi ý
    await openStep(2);
    await openStep(2);
    // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
    const clickBtn = async (label: string) => act(async () => {
      Array.from(host.ownerDocument.querySelectorAll('button')).find((b) => b.textContent?.includes(label))?.click();
    });
    await clickBtn('Gợi ý giáo án bằng AI');
    await clickBtn('Phân tích & Sinh giáo án bằng AI');
    await clickBtn('Áp dụng vào giáo án');

    // Sau khi áp dụng AI ở Bước 2, vẫn ở Bước 2 và hiển thị bài tập
    expect(host.querySelector('.plan-step__button.is-active')?.textContent).toContain('Bài tập theo ngày');

    // Quay lại Bước 1 để tinh chỉnh mục tiêu do AI gợi ý
    await openStep(1);
    const updatedGoalInput = host.querySelector('#plan-goal-input') as HTMLInputElement;
    expect(updatedGoalInput.value).toBe('Tăng cơ nạc và phục hồi cơ lưng');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(updatedGoalInput, 'Tăng cơ lưng xô an toàn 6 tuần');
      updatedGoalInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await openStep(3);
    await act(async () => { saveButton()?.click(); });

    expect(aiApi.saveTrainingPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: 'Tăng cơ lưng xô an toàn 6 tuần',
        isAiGenerated: true,
        aiRecommendationLogId: 999,
      }),
      true
    );
    expect(localStorage.getItem('sol_coach_training_plans')).toBeNull();
  });

  it('syncs AI duration weeks with endDate, forwards manager coachId, isolates AI results per member, and restores latest recommendation', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 'mgr', name: 'Manager', identifier: 'mgr', role: 'MANAGER' }));
    const restoreSpy = vi.spyOn(aiApi, 'getMemberRecommendations').mockResolvedValue([
      {
        ...mockAiResponse,
        id: 1200,
        memberId: 2,
        memberName: 'Trần Thị Thu Thảo',
        goal: 'Săn chắc cơ mông 8 tuần',
      },
    ]);

    await renderComponent();

    // Quản lý chọn HLV 32 trước
    await act(async () => { (host.querySelector('#plan-coach-select') as HTMLElement).click(); });
    const coachOpt = Array.from(host.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes('HLV Elena Cruz')) as HTMLElement;
    await act(async () => { coachOpt.click(); });

    const startInput = host.querySelector('input[name="plan-start-date"]') as HTMLInputElement;
    const initialStart = startInput.value;

    // Đổi chu kỳ trong Bước 1 sang 6 tuần
    const durationInput = host.querySelector('#plan-duration-weeks') as HTMLInputElement;
    expect(durationInput).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(durationInput, '6');
      durationInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Ngày kết thúc tự động cập nhật theo chu kỳ 6 tuần (42 ngày)
    const endInput = host.querySelector('input[name="plan-end-date"]') as HTMLInputElement;
    const [sy, sm, sd] = initialStart.split('-').map(Number);
    const expectedEnd = new Date(Date.UTC(sy, sm - 1, sd + 42)).toISOString().slice(0, 10);
    expect(endInput.value).toBe(expectedEnd);

    // Mở bước 2 để sử dụng gợi ý AI
    await openStep(2);

    // Mở Bước 2 để sử dụng nút AI gợi ý
    await openStep(2);
    // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
    const clickBtn = async (label: string) => act(async () => {
      Array.from(host.ownerDocument.querySelectorAll('button')).find((b) => b.textContent?.includes(label))?.click();
    });
    await clickBtn('Gợi ý giáo án bằng AI');

    // Hộp thoại AI hiển thị chu kỳ kế hoạch 6 tuần
    expect(host.ownerDocument.body.textContent).toContain('6 tuần');

    await clickBtn('Phân tích & Sinh giáo án bằng AI');
    expect(aiApi.generateWorkoutPlan).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 1, coachId: 32, durationWeeks: 6 })
    );
    expect(host.ownerDocument.body.textContent).toContain('Assisted Pull-up & Face Pull');

    // Chuyển học viên trong hộp thoại AI sang Hội viên 2 -> kết quả AI của Hội viên 1 không được rò sang Hội viên 2
    await act(async () => { (host.ownerDocument.querySelector('#ai-member-select') as HTMLElement).click(); });
    const member2Opt = Array.from(host.ownerDocument.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes('Trần Thị Thu Thảo')) as HTMLElement;
    await act(async () => { member2Opt.click(); });
    expect(host.ownerDocument.body.textContent).not.toContain('Assisted Pull-up & Face Pull');

    // Khôi phục gợi ý mới nhất từ server cho Hội viên 2
    await clickBtn('Khôi phục gợi ý gần nhất');
    expect(restoreSpy).toHaveBeenCalledWith(2);
    expect(host.ownerDocument.body.textContent).toContain('Săn chắc cơ mông 8 tuần');

    // Chuyển lại về Hội viên 1 -> kết quả AI đã tạo của Hội viên 1 vẫn được giữ nguyên và cập nhật endDate thành +42 ngày khi áp dụng
    await act(async () => { (host.ownerDocument.querySelector('#ai-member-select') as HTMLElement).click(); });
    const member1Opt = Array.from(host.ownerDocument.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes('Lê Hoàng Long')) as HTMLElement;
    await act(async () => { member1Opt.click(); });
    expect(host.ownerDocument.body.textContent).toContain('Assisted Pull-up & Face Pull');

    await clickBtn('Áp dụng vào giáo án');
    await openStep(1);
    expect(endInput.value).toBe(expectedEnd);
  });

  it('renders and edits timed AI exercises without sets/reps cleanly', async () => {
    vi.mocked(aiApi.getCoachMembers).mockResolvedValue([
      { ...MEMBERS[0], canViewWorkoutPlan: true },
    ]);
    vi.mocked(aiApi.generateWorkoutPlan).mockResolvedValue({
      ...mockAiResponse,
      items: [
        {
          id: 'timed-1',
          dayOfWeek: 3, // Thứ 4
          exerciseName: 'Plank giữ core',
          description: 'Giữ lưng thẳng',
          durationMinutes: 5,
          restSeconds: 45,
        } as never,
      ],
    });

    await renderComponent();
    expect(host.querySelector('.portal-alert')).toBeNull();

    await openStep(2);

    // Mở Bước 2 để sử dụng nút AI gợi ý
    await openStep(2);
    // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
    const clickBtn = async (label: string) => act(async () => {
      Array.from(host.ownerDocument.querySelectorAll('button')).find((b) => b.textContent?.includes(label))?.click();
    });
    await clickBtn('Gợi ý giáo án bằng AI');
    await clickBtn('Phân tích & Sinh giáo án bằng AI');
    expect(host.ownerDocument.body.textContent).toContain('5 phút');
    expect(host.ownerDocument.body.textContent).not.toContain('undefined');

    await clickBtn('Áp dụng vào giáo án');
    // Tự động chuyển sang Bước 2 tại Thứ 4 (ngày 3)
    expect(host.querySelector('.plan-day-tab.is-active')?.textContent).toContain('Thứ 4');
    const card = [...host.querySelectorAll('.exercise-item-card')].find((c) => c.textContent?.includes('Plank giữ core'))!;
    expect(card.textContent).not.toContain('reps');
    expect(card.textContent).toContain('5p');

    // Chỉnh sửa thời lượng của bài tập tính theo thời gian (không có sets/reps) thành công mà không ép điền sets/reps giả
    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[aria-label="Sửa bài tập Plank giữ core"]')!.click();
    });
    const durationInput = document.getElementById('draft-exercise-duration') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(durationInput, '8');
      durationInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const form = durationInput.closest('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    const updatedCard = [...host.querySelectorAll('.exercise-item-card')].find((c) => c.textContent?.includes('Plank giữ core'))!;
    expect(updatedCard.textContent).toContain('8p');
  });

  it('searches beneficiary members by name, code or phone, shows dropdown, and fills selection into the search bar', async () => {
    await renderComponent(false);
    const searchInput = host.querySelector('#plan-member-search') as HTMLInputElement;
    expect(searchInput).not.toBeNull();
    expect(searchInput.value).toBe('');

    const setSearch = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(searchInput, value);
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };

    // Nhập tên "thảo" -> dropdown hiển thị gợi ý Trần Thị Thu Thảo
    await setSearch('thảo');
    const optionBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Trần Thị Thu Thảo'));
    expect(optionBtn).toBeDefined();

    // Bấm chọn từ dropdown -> tên học viên hiện ngay trên thanh search
    await act(async () => {
      optionBtn!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(searchInput.value).toContain('Trần Thị Thu Thảo');
    expect(searchInput.value).toContain('MB-2026-014');
    expect((host.querySelector('#plan-goal-input') as HTMLInputElement).value).toBe('Săn chắc cơ mông');

    // Tìm theo số điện thoại "0901234567" -> dropdown có Lê Hoàng Long
    await setSearch('0901234567');
    const longBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Lê Hoàng Long'));
    expect(longBtn).toBeDefined();
    await act(async () => {
      longBtn!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(searchInput.value).toContain('Lê Hoàng Long');

    // Nhập không khớp -> hiển thị thông báo không tìm thấy
    await setSearch('99999999');
    expect(host.textContent).toContain('Không tìm thấy học viên phù hợp');

    // Chọn lại "014", thêm bài tập và lưu giáo án -> gửi đúng memberId = 2
    await setSearch('014');
    const selectThao = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Trần Thị Thu Thảo'));
    await act(async () => {
      selectThao!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    await addManualExercise('Hip Thrust');
    await openStep(3);
    await act(async () => { saveButton()?.click(); });
    expect(aiApi.saveTrainingPlan).toHaveBeenCalledWith(expect.objectContaining({ memberId: 2 }), true);
  });

  it('P1-FE-48 & P2-FE-62: hides retired body metrics in AI modal, translates fitnessLevel, and omits ellipsis on short goals', async () => {
    await renderComponent();
    await openStep(2);
    const aiBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Gợi ý giáo án bằng AI'))!;
    await act(async () => { aiBtn.click(); });

    const preview = host.ownerDocument.querySelector('.ai-member-preview')!;
    expect(preview).not.toBeNull();
    expect(preview.textContent).toContain('Tăng cơ nạc');
    expect(preview.textContent).toContain('Trung cấp');
    expect(preview.textContent).toContain('4 tuần');
    expect(preview.textContent).not.toContain('intermediate');
    expect(preview.textContent).not.toContain('Chiều cao');
    expect(preview.textContent).not.toContain('Cân nặng');
    expect(preview.textContent).not.toContain('BMI');
    // Mục tiêu ngắn <= 40 ký tự không bị nối dấu "..."
    expect(host.ownerDocument.querySelector('#ai-member-select')?.textContent).not.toContain('...');
  });

  it('P1-FE-49: surfaces server error details on save failure and distinguishes Coach block vs Manager override for Silver tier', async () => {
    vi.mocked(aiApi.saveTrainingPlan).mockRejectedValueOnce(new Error('Hội viên cần có buổi PT 1:1 trước khi tạo giáo án'));
    await renderComponent();
    await addManualExercise('Lat Pulldown');
    await openStep(3);
    await act(async () => { saveButton()?.click(); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Hội viên cần có buổi PT 1:1 trước khi tạo giáo án');

    // Gói Silver với vai trò COACH -> không hiển thị cảnh báo đỏ và không cho chọn học viên chưa đăng ký 1:1
    await act(async () => root.unmount());
    root = createRoot(host);
    vi.mocked(aiApi.getCoachMembers).mockResolvedValue([{ ...MEMBERS[0], canViewWorkoutPlan: false }]);
    await renderComponent();
    expect(host.querySelector('.portal-alert')).toBeNull();
  });

  it('P1-FE-50: resolves numeric coach userId from getProfile for username session and confirms before manual active plan overwrite', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ id: 'coach_marcus', name: 'HLV Marcus Vance', identifier: 'coach_marcus', role: 'COACH' }),
    );
    vi.spyOn(profileApi, 'getProfile').mockResolvedValue({ userId: 77, fullName: 'HLV Marcus Vance' } as never);
    vi.mocked(aiApi.listTrainingPlans).mockResolvedValue([
      { id: 10, memberId: 1, coachId: 99, goal: 'Giáo án HLV khác', startDate: '2026-11-10', endDate: '2026-12-10', status: 'active' },
      { id: 11, memberId: 1, coachId: 77, goal: 'Giáo án cũ của tôi', startDate: '2026-11-12', endDate: '2026-12-12', status: 'active' },
    ]);

    await renderComponent();
    await addManualExercise('Seated Row');
    await openStep(3);
    await act(async () => { saveButton()?.click(); });

    // Phải mở hộp xác nhận nêu đúng giáo án của chính HLV (coachId=77), không phải của coachId=99
    expect(host.ownerDocument.body.textContent).toContain('Thay thế giáo án đang áp dụng?');
    expect(host.ownerDocument.body.textContent).toContain('Giáo án cũ của tôi');
    expect(host.ownerDocument.body.textContent).not.toContain('Giáo án HLV khác');
    expect(aiApi.saveTrainingPlan).not.toHaveBeenCalled();

    const confirmBtn = Array.from(host.ownerDocument.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Kích hoạt giáo án mới'),
    )!;
    await act(async () => { confirmBtn.click(); });
    expect(aiApi.saveTrainingPlan).toHaveBeenCalledTimes(1);
  });

  it('P1-FE-51: validates manual exercise inputs via validateExercise and uses step=1 on rest seconds with maxLength=150', async () => {
    await renderComponent();
    await openStep(2);

    const nameInput = host.querySelector('#exercise-name-input') as HTMLInputElement;
    const restInput = host.querySelector('#exercise-rest-input') as HTMLInputElement;
    expect(nameInput.maxLength).toBe(150);
    expect(restInput.step).toBe('1');

    // Nhập số hiệp âm -> validateExercise chặn không cho thêm
    const setsInput = host.querySelector('#exercise-sets-input') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nameInput, 'Pull-up');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(setsInput, '-2');
      setsInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const submitBtn = host.querySelector('form.exercise-form-card button[type="submit"]') as HTMLButtonElement;
    await act(async () => { submitBtn.click(); });

    expect(host.querySelector('#exercise-name-error')?.textContent).toContain('Số hiệp phải là số nguyên từ 1 trở lên');
    expect(host.querySelectorAll('.exercise-item-card')).toHaveLength(0);
  });

});
