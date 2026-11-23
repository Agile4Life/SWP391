import { expect, it } from 'vitest';
import { activePlans, planDays } from './progressPresentation';
import type { TrainingPlan } from './memberProgressApi';

const item = (id: number, dayOfWeek: number | null, orderIndex: number) => ({ id, dayOfWeek, exerciseName: `E${id}`, description: null, sets: null, reps: null, durationMinutes: 10, orderIndex });
const plan = (over: Partial<TrainingPlan> = {}): TrainingPlan => ({ id: 1, status: 'active', startDate: '2026-10-01', endDate: '2026-10-31', goal: null, coachName: 'Coach', items: [], ...over });

it('prefers active plans covering today and falls back to any active plan', () => {
  const current = plan({ id: 1 });
  const future = plan({ id: 2, startDate: '2027-01-01', endDate: '2027-01-31' });
  const old = plan({ id: 3, status: 'superseded' });
  expect(activePlans([current, future, old], '2026-10-15').map((p) => p.id)).toEqual([1]);
  expect(activePlans([future, old], '2026-10-15').map((p) => p.id)).toEqual([2]);
  expect(activePlans([old], '2026-10-15')).toEqual([]);
});

it('groups plan items Monday to Sunday with undated items last', () => {
  const days = planDays(plan({ items: [item(1, 7, 1), item(2, null, 1), item(3, 1, 2), item(4, 1, 1), item(5, 9, 1)] }));
  expect(days.map((d) => d.day)).toEqual([1, 7, null]);
  expect(days[0].items.map((i) => i.id)).toEqual([4, 3]);
  expect(days[2].items.map((i) => i.id)).toEqual([2, 5]);
});
