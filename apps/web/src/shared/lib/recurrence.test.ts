import { describe, expect, it } from 'vitest';
import { addDays } from './recurrence';
import { isModuleLoadError } from './routeErrors';

describe('recurrence', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  // P3-FE-12: Safe addDays on empty or invalid input
  it('returns empty string safely instead of throwing RangeError on empty or invalid dates', () => {
    expect(addDays('', 5)).toBe('');
    expect(addDays('not-a-date', 1)).toBe('');
    expect(addDays('2026-02-31', 1)).toBe('');
    expect(addDays('2026-12-30', Number.NaN)).toBe('');
  });
});

describe('routeErrors', () => {
  // P3-FE-12: Include CSS preload errors in isModuleLoadError
  it('recognizes JS chunk and Vite CSS preload failures', () => {
    expect(isModuleLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isModuleLoadError(new Error('Unable to preload CSS for /assets/PortalShell-abc.css'))).toBe(true);
    expect(isModuleLoadError(new Error('Loading CSS chunk 12 failed'))).toBe(true);
    expect(isModuleLoadError(new Error('Validation failed'))).toBe(false);
  });
});
