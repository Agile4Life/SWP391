import { describe, expect, it } from 'vitest';
import { matchPtSearch } from './ptSearch';
import type { CoachBookingDto } from '../member/coachBookingApi';

const row = { id: 1, memberId: 12, memberName: 'Phạm Quốc Bảo', membershipCode: 'MB-001', memberPhone: '0912 345 678', memberEmail: 'bao@sol.vn' } as CoachBookingDto;

describe('matchPtSearch', () => {
  it('matches name without accents, code, exact id, phone and email', () => {
    for (const q of ['', 'quoc bao', 'mb-001', '12', '#12', '0912345678', 'bao@sol']) expect(matchPtSearch(row, q)).toBe(true);
  });
  it('does not match every row for a single character or partial id', () => {
    for (const q of ['#', 'mem', 'z']) expect(matchPtSearch(row, q)).toBe(false);
  });
});
