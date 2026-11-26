import { describe, expect, it } from 'vitest';
import { computeCourseEndDate, daysForStartDate, validateCourseSessionCount, weekdayCodeOf } from './classWizardValidation';

const t = (vi: string) => vi;

describe('computeCourseEndDate', () => {
  it('12 sessions, 3 per week from a Thursday start -> ends on the 12th session (4th week)', () => {
    // 10/12/2026 là Thứ 5; học T2, T5, T7.
    expect(weekdayCodeOf('2026-12-10')).toBe('THURSDAY');
    expect(computeCourseEndDate('2026-12-10', ['MONDAY', 'THURSDAY', 'SATURDAY'], 12)).toBe('2027-01-04');
  });

  it('counts the start date itself as session 1', () => {
    expect(computeCourseEndDate('2026-12-10', ['THURSDAY'], 1)).toBe('2026-12-10');
    expect(computeCourseEndDate('2026-12-10', ['THURSDAY'], 4)).toBe('2026-12-31');
  });

  it('returns empty for invalid input', () => {
    expect(computeCourseEndDate('', ['MONDAY'], 3)).toBe('');
    expect(computeCourseEndDate('2026-12-10', [], 3)).toBe('');
    expect(computeCourseEndDate('2026-12-10', ['MONDAY'], 0)).toBe('');
  });
});

describe('validateCourseSessionCount', () => {
  it('accepts whole numbers 1..52 only', () => {
    expect(validateCourseSessionCount('12', t)).toBeNull();
    expect(validateCourseSessionCount('52', t)).toBeNull();
    for (const bad of ['', '0', '53', '2.5', 'abc']) {
      expect(validateCourseSessionCount(bad, t)).not.toBeNull();
    }
  });
});

describe('daysForStartDate', () => {
  it('replaces the auto-added start weekday when the start date moves', () => {
    expect(daysForStartDate(['THURSDAY'], 'THURSDAY', 'MONDAY')).toEqual({ days: ['MONDAY'], autoAddedDay: 'MONDAY' });
  });

  it('keeps weekdays the user picked, even after they stop being the start weekday', () => {
    const r1 = daysForStartDate(['THURSDAY', 'MONDAY', 'SATURDAY'], 'THURSDAY', 'MONDAY');
    expect(r1).toEqual({ days: ['MONDAY', 'SATURDAY'], autoAddedDay: null });
    expect(daysForStartDate(r1.days, r1.autoAddedDay, 'FRIDAY')).toEqual({
      days: ['MONDAY', 'SATURDAY', 'FRIDAY'], autoAddedDay: 'FRIDAY',
    });
  });

  it('same weekday on another date keeps state; clearing the date drops only the auto day', () => {
    expect(daysForStartDate(['THURSDAY', 'MONDAY'], 'THURSDAY', 'THURSDAY')).toEqual({ days: ['THURSDAY', 'MONDAY'], autoAddedDay: 'THURSDAY' });
    expect(daysForStartDate(['THURSDAY', 'MONDAY'], 'THURSDAY', '')).toEqual({ days: ['MONDAY'], autoAddedDay: null });
  });
});
