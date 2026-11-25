import { describe, expect, it } from 'vitest';
import { DISCIPLINES, MAIN_DISCIPLINE, SECONDARY_DISCIPLINES, isStandardDiscipline, matchesDiscipline } from './disciplines';

describe('disciplines', () => {
  it('has Gym as the only main discipline followed by Boxing and Yoga', () => {
    expect(MAIN_DISCIPLINE.name).toBe('Gym');
    expect(DISCIPLINES.filter((discipline) => discipline.tier === 'main')).toHaveLength(1);
    expect(SECONDARY_DISCIPLINES.map((discipline) => discipline.name)).toEqual(['Boxing', 'Yoga']);
  });

  it.each([
    ['Olympic Strength', 'Gym', true],
    ['Boxing & Kickfit', 'Boxing', true],
    ['Boxing', 'boxing', true],
    ['Mindful Yoga', 'Yoga', true],
    ['Hatha Yoga', 'yoga', true],
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

  it.each([
    ['Gym', true],
    ['Olympic Strength', true],
    ['Mindful Yoga', true],
    ['Boxing & Kickfit', true],
    ['Pilates', false],
    ['Zumba', false],
    ['', false],
    [null, false],
  ])('treats "%s" as standard discipline -> %s', (name, expected) => {
    expect(isStandardDiscipline(name)).toBe(expected);
  });
});
