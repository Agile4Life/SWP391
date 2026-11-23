import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemberProgressPage } from './MemberProgressPage';
const plan = { id: 1, status: 'active', startDate: '2026-01-01', endDate: '2099-12-31', goal: 'Tăng cơ', coachName: 'HLV Lan', items: [
  { id: 6, dayOfWeek: 3, exerciseName: 'Deadlift', description: 'Giữ lưng thẳng', sets: 4, reps: 6, durationMinutes: null, restSeconds: 90, orderIndex: 1 },
  { id: 5, dayOfWeek: 1, exerciseName: 'Squat', description: null, sets: 3, reps: 10, durationMinutes: null, orderIndex: 1 },
] };
let host: HTMLDivElement; let root: Root;
let request: ReturnType<typeof vi.fn>;
const reply = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  request = vi.fn().mockResolvedValue(reply([plan])); vi.stubGlobal('fetch', request);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals(); });
const render = () => act(async () => root.render(<MemoryRouter><MemberProgressPage /></MemoryRouter>));
it('loads the real authenticated plan endpoint and groups exercises by day without metrics/history', async () => {
  localStorage.setItem('fitcenter_token', 'member-token'); await render();
  expect(host.querySelector('h1')?.textContent).toBe('Giáo án');
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith('/api/v1/coaching/training-plans/my', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer member-token' }) }));
  expect([...host.querySelectorAll('.member-progress-plan__day h4')].map(n => n.textContent)).toEqual(['Thứ 2', 'Thứ 4']);
  expect(host.textContent).toContain('Nghỉ 90 giây');
  expect(host.querySelectorAll('input[type="checkbox"], .member-progress-chart, .workout-history')).toHaveLength(0);
  expect(host.textContent).not.toMatch(/Lịch sử tập luyện|Thay đổi qua các tuần|BMI/);
});
it('keeps loading until the plan request completes', async () => {
  let resolve!: (value: Response) => void; request.mockReturnValue(new Promise<Response>(r => { resolve = r; }));
  await render(); expect(host.textContent).toContain('Đang tải giáo án');
  await act(async () => resolve(reply([plan]))); expect(host.textContent).toContain('Squat');
});
it('keeps the plan error and retry flow', async () => {
  request.mockRejectedValueOnce(new Error('offline')); await render();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('#coach-training-plan button')!.click());
  expect(host.textContent).toContain('Squat'); expect(request).toHaveBeenCalledTimes(2);
});
it('shows the existing empty state for inactive plans', async () => {
  request.mockResolvedValue(reply([{ ...plan, status: 'superseded' }])); await render();
  expect(host.textContent).toContain('Chưa có giáo án đang áp dụng.');
});
it('shows a plan without exercises without inventing content', async () => {
  request.mockResolvedValue(reply([{ ...plan, items: [] }])); await render();
  expect(host.textContent).toContain('Giáo án này chưa có bài tập nào.');
});
