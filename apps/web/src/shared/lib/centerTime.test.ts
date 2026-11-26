import { describe, expect, it } from 'vitest';
import {
  centerNowParts,
  formatCenterDate,
  formatCenterDateTime,
  formatCenterTime,
  formatCenterTimeSeconds,
  formatTimeRange,
  parseCenterTime,
} from './centerTime';

describe('centerTime', () => {
  it('reads offset-less server values as center time', () => {
    expect(formatCenterTime('2026-11-02T09:05:00')).toBe('09:05');
    expect(formatCenterTimeSeconds('2026-11-02T09:05:07.123456')).toBe('09:05:07');
    expect(formatCenterDate('2026-11-02T23:59:00')).toBe('02/11/2026');
  });

  it('converts instants to center time', () => {
    expect(formatCenterTime('2026-11-02T03:05:00Z')).toBe('10:05');
    expect(formatCenterDateTime('2026-11-02T17:30:00Z')).toBe('00:30 03/11/2026');
    expect(formatCenterTime('2026-11-02T10:05:00+07:00')).toBe('10:05');
  });

  // P2-FE-21: Postgres 2-digit offsets, space separator, and invalid calendar date rejection
  it('handles PostgreSQL 2-digit offsets, 4-digit offsets, and space separators', () => {
    expect(formatCenterDateTime('2026-11-25 14:30:00')).toBe('14:30 25/11/2026');
    expect(formatCenterDateTime('2026-11-25 14:30:00+07')).toBe('14:30 25/11/2026');
    expect(formatCenterDateTime('2026-11-25T14:30:00+07')).toBe('14:30 25/11/2026');
    expect(formatCenterDateTime('2026-11-25 14:30:00.123456+00')).toBe('21:30 25/11/2026');
    expect(formatCenterTime('2026-11-25T14:30:00+0700')).toBe('14:30');
  });

  it('rejects rolled-over invalid calendar dates', () => {
    expect(parseCenterTime('2026-02-31')).toBeNull();
    expect(parseCenterTime('2026-02-29T10:00:00')).toBeNull();
    expect(parseCenterTime('2026-04-31 12:00:00+07')).toBeNull();
    expect(parseCenterTime('2026-13-01')).toBeNull();
    expect(parseCenterTime('2024-02-29T10:00:00')).not.toBeNull();
  });

  it('treats a plain date as midnight at the center', () => {
    expect(formatCenterDate('2026-11-02')).toBe('02/11/2026');
    expect(formatCenterTime('2026-11-02')).toBe('00:00');
  });

  it('falls back for empty or invalid values', () => {
    expect(formatCenterDateTime(null)).toBe('—');
    expect(formatCenterDateTime('not-a-date', 'n/a')).toBe('n/a');
    expect(parseCenterTime('')).toBeNull();
  });

  // P3-FE-12: Safe formatTimeRange(null, null) -> '—'
  it('formats time ranges safely when endpoints are missing', () => {
    expect(formatTimeRange('07:00:00', '09:30:00')).toBe('07:00–09:30');
    expect(formatTimeRange(null, null)).toBe('—');
    expect(formatTimeRange('', undefined)).toBe('—');
    expect(formatTimeRange('07:00', null)).toBe('07:00–—');
  });
});

describe('centerNowParts', () => {
  it('returns the center date and time, which can differ from the UTC date', () => {
    expect(centerNowParts(new Date('2026-11-02T17:05:00Z'))).toEqual({ date: '2026-11-03', time: '00:05' });
    expect(centerNowParts(new Date('2026-11-02T03:30:00Z'))).toEqual({ date: '2026-11-02', time: '10:30' });
  });
});
