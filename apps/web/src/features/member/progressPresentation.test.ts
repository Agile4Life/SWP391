import { expect, it } from 'vitest';
import { dailyExercises, weeklyMeasurements } from './progressPresentation';
import type { TrainingPlan } from './memberProgressApi';

it('uses the latest persisted weight and BMI in each week without inventing gaps', () => {
  const points = weeklyMeasurements([
    { id: 1, metricName: 'weight', metricValue: 70, unit: 'kg', recordedAt: '2026-10-05T08:00:00' },
    { id: 2, metricName: 'weight', metricValue: 69, unit: 'kg', recordedAt: '2026-10-07T08:00:00' },
    { id: 3, metricName: 'bmi', metricValue: 23.5, unit: null, recordedAt: '2026-10-07T08:00:00' },
    { id: 4, metricName: 'weight', metricValue: 68, unit: 'kg', recordedAt: '2026-10-19T08:00:00' },
  ]);
  expect(points.map((point) => [point.weight, point.bmi])).toEqual([[69, 23.5], [null, null], [68, null]]);
});

it('uses active date range and ISO weekday, with no cross-day exercises', () => {
  const plan: TrainingPlan = { id: 2, status: 'active', startDate: '2026-10-01', endDate: '2026-10-31', goal: null, coachName: 'Coach', items: [
    { id: 10, dayOfWeek: 1, exerciseName: 'Squat', description: null, sets: 3, reps: 10, durationMinutes: null, orderIndex: 1 },
    { id: 11, dayOfWeek: 2, exerciseName: 'Run', description: null, sets: null, reps: null, durationMinutes: 20, orderIndex: 2 },
  ] };
  expect(dailyExercises([plan], '2026-10-26').map(({ item }) => item.id)).toEqual([10]);
  expect(dailyExercises([plan], '2026-11-02')).toEqual([]);
});
