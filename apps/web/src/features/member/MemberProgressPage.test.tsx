import { setLanguage } from '../../shared/i18n/language';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemberProgressPage } from './MemberProgressPage';
import * as api from './memberProgressApi';
import { memberCheckinApi } from './memberCheckinApi';
vi.mock('./memberCheckinApi', () => ({ memberCheckinApi: { history: vi.fn().mockResolvedValue([]) } }));

vi.mock('./memberProgressApi', () => ({ getMyProgressMetrics: vi.fn(), getMyTrainingPlans: vi.fn() }));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.mocked(api.getMyProgressMetrics).mockResolvedValue([
    { id: 1, metricName: 'weight', metricValue: 70, unit: 'kg', recordedAt: '2026-10-19T08:00:00' },
    { id: 2, metricName: 'bmi', metricValue: 23, unit: null, recordedAt: '2026-10-19T08:00:00' },
  ]);
  vi.mocked(api.getMyTrainingPlans).mockResolvedValue([]);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); setLanguage('vi'); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function render() { await act(async () => root.render(<MemoryRouter><MemberProgressPage /></MemoryRouter>)); }

it('renders persisted weekly measurements without derived BMI', async () => {
  await render();
  expect(host.firstElementChild?.classList.contains('portal-container')).toBe(true);
  expect(host.firstElementChild?.classList.contains('member-progress')).toBe(true);
  expect(host.querySelectorAll('svg.member-progress-chart').length).toBe(2);
  expect(host.textContent).toContain('70 kg');
  expect(host.textContent).toContain('BMI 23');
});

it('removes the today-exercises block and the old coach review block', async () => {
  await render();
  expect(host.textContent).not.toContain('Bài tập hôm nay');
  expect(host.textContent).not.toContain('Đánh giá từ huấn luyện viên');
  expect(host.querySelector('input[type="checkbox"]')).toBeNull();
});

it('shows an empty state when no coach plan is applied', async () => {
  await render();
  expect(host.querySelector('#coach-training-plan')?.textContent).toContain('Chưa có giáo án đang áp dụng.');
});

it('shows independent API errors and retry controls', async () => {
  vi.mocked(api.getMyProgressMetrics).mockRejectedValueOnce(new Error('offline'));
  vi.mocked(api.getMyTrainingPlans).mockRejectedValueOnce(new Error('offline'));
  await render();
  expect(host.querySelectorAll('[role="alert"]').length).toBe(2);
  expect(host.textContent).toContain('Thử lại');
});

function activePlan(overrides: Partial<api.TrainingPlan> = {}): api.TrainingPlan {
  return { id: 1, status: 'active', startDate: '2026-01-01', endDate: '2099-12-31', goal: 'Tăng cơ', coachName: 'HLV Lan', items: [
    { id: 6, dayOfWeek: 3, exerciseName: 'Deadlift', description: 'Giữ lưng thẳng', sets: 4, reps: 6, durationMinutes: null, restSeconds: 90, orderIndex: 1 },
    { id: 5, dayOfWeek: 1, exerciseName: 'Squat', description: null, sets: 3, reps: 10, durationMinutes: null, orderIndex: 1 },
    { id: 7, dayOfWeek: 1, exerciseName: 'Plank', description: null, sets: null, reps: null, durationMinutes: 5, orderIndex: 2 },
  ], ...overrides };
}

it('shows the coach plan in the first section, grouped by weekday', async () => {
  vi.mocked(api.getMyTrainingPlans).mockResolvedValue([activePlan()]);
  await render();
  const section = host.querySelector('#coach-training-plan') as HTMLElement;
  expect(section.textContent).toContain('Tăng cơ');
  expect(section.textContent).toContain('HLV Lan');
  const days = [...section.querySelectorAll('.member-progress-plan__day h4')].map((node) => node.textContent);
  expect(days).toEqual(['Thứ 2', 'Thứ 4']);
  expect(section.querySelectorAll('li')).toHaveLength(3);
  expect(section.textContent).toContain('4 hiệp × 6 lần');
  expect(section.textContent).toContain('Nghỉ 90 giây');
  expect(host.querySelector('.member-progress > section')).toBe(section);
});

it('ignores plans that are not active and shows the empty state', async () => {
  vi.mocked(api.getMyTrainingPlans).mockResolvedValue([activePlan({ status: 'superseded' })]);
  await render();
  expect(host.querySelector('#coach-training-plan')?.textContent).toContain('Chưa có giáo án đang áp dụng.');
  expect(host.querySelector('.member-progress-plan')).toBeNull();
});

it('retries a failed plan load without touching measurements', async () => {
  vi.mocked(api.getMyTrainingPlans).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([activePlan()]);
  await render();
  const section = host.querySelector('#coach-training-plan') as HTMLElement;
  expect(section.querySelector('[role="alert"]')?.textContent).toContain('Không thể tải giáo án');
  await act(async () => (section.querySelector('button') as HTMLButtonElement).click());
  expect(section.textContent).toContain('Squat');
  expect(api.getMyProgressMetrics).toHaveBeenCalledTimes(1);
});

it('shows every coach assessment measurement in its week', async () => {
  vi.mocked(api.getMyProgressMetrics).mockResolvedValue([
    { id: 1, metricName: 'height', metricValue: 170, unit: 'cm', recordedAt: '2026-10-19T08:00:00' },
    { id: 2, metricName: 'weight', metricValue: 70, unit: 'kg', recordedAt: '2026-10-19T08:00:00' },
    { id: 3, metricName: 'bmi', metricValue: 24.22, unit: null, recordedAt: '2026-10-19T08:00:00' },
    { id: 4, metricName: 'body_fat', metricValue: 18.5, unit: '%', recordedAt: '2026-10-26T08:00:00' },
    { id: 5, metricName: 'muscle_mass', metricValue: 32, unit: 'kg', recordedAt: '2026-10-26T08:00:00' },
  ]);
  await render();
  const weeks = [...host.querySelectorAll('.member-progress-values p')].map((node) => node.textContent ?? '');
  expect(weeks).toHaveLength(2);
  expect(weeks[0]).toContain('70 kg');
  expect(weeks[0]).toContain('Cao 170 cm');
  expect(weeks[1]).toContain('Mỡ 18.5%');
  expect(weeks[1]).toContain('Cơ 32 kg');
});

it('shows the assessment empty state when no coach measurement exists', async () => {
  vi.mocked(api.getMyProgressMetrics).mockResolvedValue([]);
  await render();
  expect(host.textContent).toContain('Chưa có đánh giá sức khỏe từ huấn luyện viên.');
  expect(host.querySelector('.member-progress-values')).toBeNull();
  expect(host.querySelector('svg.member-progress-chart')).toBeNull();
});

it('provides a separate workout history tab while preserving progress', async () => {
  await render();
  const history = [...host.querySelectorAll('button')].find(button => button.textContent === 'Lịch sử tập luyện');
  expect(history).toBeDefined();
  expect(memberCheckinApi.history).not.toHaveBeenCalled();
  await act(async () => history!.click());
  expect(memberCheckinApi.history).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('Nhịp tập luyện của bạn');
  await act(async () => ([...host.querySelectorAll('button')].find(button => button.textContent === 'Tiến độ & Giáo án') as HTMLButtonElement).click());
  expect(host.querySelectorAll('svg.member-progress-chart')).toHaveLength(2);
  expect(api.getMyProgressMetrics).toHaveBeenCalledTimes(1);
  await act(async () => history!.click());
  expect(memberCheckinApi.history).toHaveBeenCalledTimes(2);
});

it('switches mounted progress labels and independent errors without refetching', async () => {
  vi.mocked(api.getMyProgressMetrics).mockRejectedValueOnce(new Error('offline'));
  await render();
  const calls = vi.mocked(api.getMyProgressMetrics).mock.calls.length;
  await act(async () => setLanguage('en'));
  expect(host.textContent).toContain('Fitness progress');
  expect(host.textContent).toContain('Unable to load measurements.');
  expect(host.textContent).toContain('No training plan in use yet.');
  expect(vi.mocked(api.getMyProgressMetrics).mock.calls.length).toBe(calls);
  await act(async () => setLanguage('vi'));
  expect(host.textContent).toContain('Tiến độ thể lực');
});
