import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachTrainingPlanPage } from './CoachTrainingPlanPage';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import { setLanguage } from '../../shared/i18n/language';
import { aiApi, type MemberOption } from './aiApi';
import * as profileApi from '../member/profileApi';

vi.mock('../member/profileApi', () => ({ listHealthMetrics: vi.fn().mockResolvedValue([]), addHealthMetrics: vi.fn() }));

const MEMBERS: MemberOption[] = [
  { id: 1, memberCode: 'MB-2026-001', fullName: 'Lê Hoàng Long', fitnessGoal: 'Tăng cơ nạc', healthNotes: 'Tránh Deadlift tạ nặng', fitnessLevel: 'intermediate' },
  { id: 2, memberCode: 'MB-2026-014', fullName: 'Trần Thị Thu Thảo', fitnessGoal: 'Săn chắc cơ mông', healthNotes: 'Bình thường', fitnessLevel: 'beginner' },
];

describe('CoachTrainingPlanPage (SCRUM-122: UI Coach Soạn Giáo án Bài tập Tích hợp AI Gợi ý)', () => {
  let host: HTMLDivElement;
  let root: Root;

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

  async function renderComponent() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CoachTrainingPlanPage />
        </MemoryRouter>
      );
    });
  }

  async function openStep(step: 1 | 2 | 3) {
    await act(async () => { host.querySelectorAll<HTMLButtonElement>('.plan-step__button')[step - 1].click(); });
  }
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
    expect(host.textContent).toContain('Truy cập bị từ chối (403 Forbidden)');
  });

  it('waits for member data before showing the editor and renders immediately when it arrives', async () => {
    let finishMembers!: (members: MemberOption[]) => void;
    vi.mocked(aiApi.getCoachMembers).mockReturnValue(new Promise(resolve => { finishMembers = resolve; }));

    await renderComponent();
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(host.textContent).not.toContain(MEMBERS[0].fullName);
    expect(host.querySelector('#plan-member')).toBeNull();

    await act(async () => finishMembers([{ ...MEMBERS[0], id: 42, fullName: 'Học viên đã tải' }]));
    expect(host.querySelector('[aria-busy="true"]')).toBeNull();
    expect(host.textContent).toContain('Học viên đã tải');
    expect(host.querySelectorAll('.plan-step__button')).toHaveLength(3);
    await openStep(3);
    expect(host.textContent).toContain('Lưu & Kích hoạt giáo án');
  });

  it('renders plan editor workspace with day tabs (Thứ 2 -> Chủ Nhật)', async () => {
    await renderComponent();

    expect(host.textContent).toContain('Soạn giáo án');
    expect(host.textContent).toContain('Gợi ý giáo án bằng AI');
    // One group of information per step: step 1 holds only the plan info
    expect(host.textContent).toContain('Thông tin kế hoạch huấn luyện');
    expect(saveButton()).toBeUndefined();
    expect(host.querySelector('#exercise-name-input')).toBeNull();

    await openStep(2);
    // Verify all 7 day tabs render
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

  it('moves through the three steps with Tiếp tục and Quay lại', async () => {
    await renderComponent();
    const click = async (label: string) => act(async () => {
      (Array.from(host.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement).click();
    });
    const active = () => host.querySelector('.plan-step__button.is-active')?.textContent;
    expect(active()).toContain('Học viên & kế hoạch');
    expect(host.textContent).not.toContain('Chỉ số sức khỏe ·');
    await click('Tiếp tục');
    expect(active()).toContain('Bài tập theo ngày');
    await click('Tiếp tục');
    expect(active()).toContain('Xem lại & kích hoạt');
    expect(host.textContent).toContain('Kéo xà trợ lực');
    expect(Array.from(host.querySelectorAll('button')).some((b) => b.textContent === 'Tiếp tục')).toBe(false);
    await click('Quay lại');
    expect(active()).toContain('Bài tập theo ngày');
  });

  it('keeps health precautions highlighted when switching language without changing member data', async () => {
    await renderComponent();
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

    // Fill exercise form
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
    const button = (label: string) => Array.from(host.ownerDocument.querySelectorAll('button')).find((b) => b.textContent?.includes(label));
    await act(async () => { button('Gợi ý giáo án bằng AI')?.click(); });
    await act(async () => { button('Phân tích & Sinh giáo án bằng AI')?.click(); });

    await act(async () => { button('Áp dụng vào giáo án')?.click(); });
    expect(host.ownerDocument.body.textContent).toContain('Ghi đè giáo án đã soạn trước đó?');
    expect(host.ownerDocument.body.textContent).toContain('Giảm mỡ bụng');
    expect(aiApi.listTrainingPlans).toHaveBeenCalledWith(1);

    // Keeping the current plan leaves the AI result open and the editor untouched.
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

    // 1. Click AI Sparkle Button
    const aiBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Gợi ý giáo án bằng AI')
    );
    expect(aiBtn).toBeDefined();

    await act(async () => {
      aiBtn?.click();
    });

    // Check modal opened
    expect(host.textContent).toContain('Trợ lý AI: gợi ý giáo án huấn luyện cá nhân hóa');
    expect(host.textContent).toContain('Phân tích & Sinh giáo án bằng AI');

    // 2. Click Generate AI Plan
    const generateBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Phân tích & Sinh giáo án bằng AI')
    );

    await act(async () => {
      generateBtn?.click();
    });

    // Verify AI analysis result appears
    expect(host.textContent).toContain('Assisted Pull-up & Face Pull');
    expect(host.textContent).toContain('Goblet Box Squat');
    expect(host.textContent).not.toContain('Gemini 3 Flash');

    // 3. Click "Áp dụng vào giáo án"
    const applyBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Áp dụng vào giáo án')
    );
    expect(applyBtn).toBeDefined();

    await act(async () => {
      applyBtn?.click();
    });

    // 4. Verify AI exercises are populated directly into the Coach's workspace
    await openStep(2);
    expect(host.textContent).toContain('Assisted Pull-up & Face Pull');
  });

  it('saves and activates plan when clicking "Lưu & Kích hoạt giáo án"', async () => {
    await renderComponent();
    await openStep(3);

    const saveBtn = saveButton();
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn?.click();
    });

    expect(aiApi.saveTrainingPlan).toHaveBeenCalled();
    expect(host.querySelector('.center-toast-card')).toBeNull();
    expect(document.querySelector('.sol-toast--success')?.textContent).toContain('Đã lưu và kích hoạt giáo án');
    expect(host.querySelector('.plan-saved-badge')).not.toBeNull();
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

    const saveBtn = () => saveButton() as HTMLButtonElement;
    expect(host.querySelector('#plan-coach-select')).not.toBeNull();

    // Without a coach the manager cannot leave step 1
    await openStep(3);
    expect(saveButton()).toBeUndefined();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('chọn huấn luyện viên');

    await act(async () => { (host.querySelector('#plan-coach-select') as HTMLElement).click(); });
    const option = Array.from(host.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes('HLV Elena Cruz')) as HTMLElement;
    await act(async () => { option.click(); });
    await openStep(3);
    expect(saveBtn().disabled).toBe(false);

    await act(async () => { saveBtn().click(); });
    expect(aiApi.saveTrainingPlan).toHaveBeenCalledWith(expect.objectContaining({ memberId: 1, coachId: 32 }), true);
  });

  it('does not ask a coach to choose a coach and never sends coach id for them', async () => {
    await renderComponent();
    expect(host.querySelector('#plan-coach-select')).toBeNull();
    await openStep(3);
    const saveBtn = saveButton() as HTMLButtonElement;
    await act(async () => { saveBtn.click(); });
    expect(vi.mocked(aiApi.saveTrainingPlan).mock.calls[0][0].coachId).toBeUndefined();
  });

  it('enforces that endDate min constraint is set to startDate', async () => {
    await renderComponent();

    const startInput = host.querySelector('input[name="plan-start-date"]') as HTMLInputElement;
    const endInput = host.querySelector('input[name="plan-end-date"]') as HTMLInputElement;

    expect(startInput).not.toBeNull();
    expect(endInput).not.toBeNull();
    expect(endInput.getAttribute('min')).toBe(startInput.value);
  });
  it('edits draft exercise reps and sets before saving the plan', async () => {
    await renderComponent();
    await openStep(2);
    await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="Sửa bài tập Kéo xà trợ lực (Assisted Pull-up)"]')!.click());
    for (const [id,value] of [['draft-exercise-sets','5'],['draft-exercise-reps','8'],['draft-exercise-rest','90']]) {
      const input=document.getElementById(id) as HTMLInputElement;
      await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
    }
    const form=document.querySelector('#draft-exercise-sets')!.closest('form')!;
    await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    const card=[...host.querySelectorAll('.exercise-item-card')].find(item=>item.textContent?.includes('Assisted Pull-up'))!;
    expect(card.textContent).toContain('Hiệp: 5');expect(card.textContent).toContain('8 reps');expect(card.textContent).toContain('90s');
  });

  it('loads the stored height, weight and BMI into the AI assistant modal', async () => {
    vi.mocked(profileApi.listHealthMetrics).mockResolvedValue([
      { id: 1, metricName: 'height', metricValue: 172, unit: 'cm', recordedAt: '2026-11-08T08:00:00' },
      { id: 2, metricName: 'weight', metricValue: 68, unit: 'kg', recordedAt: '2026-11-08T08:00:00' },
    ]);

    await renderComponent();
    expect(host.querySelector('#coach-metric-weight')).toBeNull();

    const aiBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Gợi ý giáo án bằng AI')
    );
    await act(async () => {
      aiBtn?.click();
    });

    expect(host.textContent).toContain('172 cm / 68 kg');
    expect(host.textContent).toContain('23');
  });

});
