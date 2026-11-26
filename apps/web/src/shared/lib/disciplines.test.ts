import { describe, expect, it } from 'vitest';
import { DISCIPLINES, MAIN_DISCIPLINE, SECONDARY_DISCIPLINES, isStandardDiscipline, matchesDiscipline } from './disciplines';

describe('disciplines', () => {
  it('has Gym as the only main discipline followed by Boxing and Yoga', () => {
    expect(MAIN_DISCIPLINE.name).toBe('Gym');
    expect(DISCIPLINES.filter((discipline) => discipline.tier === 'main')).toHaveLength(1);
    expect(SECONDARY_DISCIPLINES.map((discipline) => discipline.name)).toEqual(['Boxing', 'Yoga']);
  });

  // P2-FE-22: Legacy kickfit alias removed; custom disciplines match by name
  it.each([
    ['Olympic Strength', 'Gym', true],
    ['Boxing', 'boxing', true],
    ['Đấm bốc cơ bản', 'Boxing', true],
    ['Kickfit', 'Boxing', false],
    ['Mindful Yoga', 'Yoga', true],
    ['Hatha Yoga', 'yoga', true],
    ['Calisthenics', 'Calisthenics', true],
    ['Yoga cơ bản', 'Gym', false],
    ['Boxing', 'Gym', false],
    ['Yoga', 'Boxing', false],
    ['', 'Gym', false],
    ['Gym', '', false],
    [null, 'Gym', false],
    ['Gym', undefined, false],
    ['   ', '   ', false],
  ])('matches catalog name "%s" against filter "%s" -> %s', (name, filter, expected) => {
    expect(matchesDiscipline(name, filter)).toBe(expected);
  });

  // P2-FE-22: Accept any non-blank active discipline name/object instead of hardcoding a fixed allowlist
  it.each([
    ['Gym', true],
    ['Olympic Strength', true],
    ['Mindful Yoga', true],
    ['Calisthenics', true],
    ['Mobility Flow', true],
    [{ name: 'Cross Training' }, true],
    [{ name: '   ' }, false],
    ['', false],
    ['   ', false],
    [null, false],
    [undefined, false],
  ])('accepts any non-blank discipline (%j) -> %s', (value, expected) => {
    expect(isStandardDiscipline(value)).toBe(expected);
  });
});
