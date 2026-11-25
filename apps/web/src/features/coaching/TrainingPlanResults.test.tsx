import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TrainingPlanResults } from './TrainingPlanResults';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it('renders empty message when plan has no exercises', async () => {
  await act(async () => root.render(<TrainingPlanResults plan={null} planId={1} />));
  expect(host.textContent).toContain('Giáo án chưa có bài tập nào.');
});

it('renders all plan exercises grouped by day without daily progress scoring', async () => {
  // Dữ liệu mẫu dùng trong các ca kiểm thử.
  const dummyPlan = {
    id: 10,
    memberId: 5,
    memberName: 'Trần Nhật',
    goal: 'Tăng cơ giảm mỡ',
    startDate: '2026-11-14',
    endDate: '2026-12-14',
    status: 'active',
    items: [
      { id: 101, exerciseName: 'Barbell Squat', dayOfWeek: 1, sets: 4, reps: 10, restSeconds: 60, durationMinutes: null, description: 'Lưng thẳng' },
      { id: 102, exerciseName: 'Bench Press', dayOfWeek: 3, sets: 3, reps: 12, restSeconds: 45, durationMinutes: null, description: null },
    ],
  };
  await act(async () => root.render(<TrainingPlanResults plan={dummyPlan} planId={10} />));
  expect(host.textContent).toContain('Tăng cơ giảm mỡ');
  expect(host.textContent).toContain('2 bài tập');
  expect(host.textContent).toContain('Thứ 2');
  expect(host.textContent).toContain('Barbell Squat');
  expect(host.textContent).toContain('4 hiệp × 10 lần');
  expect(host.textContent).toContain('Thứ 4');
  expect(host.textContent).toContain('Bench Press');
  expect(host.querySelector('#tab-daily-progress')).toBeNull();
});

it('P2-FE-65: renders sets-only and reps-only pills independently and formats missing dates safely', async () => {
  const partialPlan = {
    id: 11,
    memberId: 5,
    goal: 'Phục hồi',
    startDate: null as unknown as string,
    endDate: null as unknown as string,
    status: 'completed',
    items: [
      { id: 201, exerciseName: 'Dead Hang', dayOfWeek: 2, sets: 3, reps: null, restSeconds: 30, durationMinutes: null, description: null },
      { id: 202, exerciseName: 'Burpees', dayOfWeek: 2, sets: null, reps: 25, restSeconds: 0, durationMinutes: null, description: null },
    ],
  };
  await act(async () => root.render(<TrainingPlanResults plan={partialPlan} planId={11} />));
  expect(host.textContent).toContain('— – —');
  expect(host.textContent).toContain('3 hiệp');
  expect(host.textContent).toContain('25 lần');
});
