import { expect, it } from 'vitest';
import { subscriptionDates } from './subscriptionDates';
import type { RenewalCandidate } from './receptionApi';
import { centerNowParts } from '../../shared/lib/centerTime';

const period: RenewalCandidate = { id: 1, memberId: 10, packageId: 2, packageName: 'Silver',
  previousSubscriptionId: null, startDate: '2026-11-28', endDate: '2027-02-25', status: 'active', createdAt: '' };
const next = { ...period, id: 2, previousSubscriptionId: 1, startDate: '2027-02-26', endDate: '2027-05-26' };
it('uses the effective period, not the newest future renewal, and follows the paid contiguous chain', () => {
  expect(subscriptionDates([next, period], '2026-11-28')).toEqual({ current: period, paidThroughDate: next.endDate });
  expect(subscriptionDates([period], '2026-11-28')).toEqual({ current: period, paidThroughDate: period.endDate });
  expect(subscriptionDates([next], '2026-11-28')).toBeNull();
  const last = { ...next, id: 3, previousSubscriptionId: 2, startDate: '2027-05-27', endDate: '2027-08-24' };
  expect(subscriptionDates([last, next, period], '2026-11-28')?.paidThroughDate).toBe(last.endDate);
});
it('does not extend across gaps, other packages, unpaid periods, branches or invalid relationships', () => {
  for (const invalid of [{ ...next, startDate: '2027-02-27' }, { ...next, packageId: 3 },
    { ...next, status: 'pending_payment' }, { ...next, memberId: 11 }, { ...next, previousSubscriptionId: 99 }]) {
    expect(subscriptionDates([period, invalid], '2026-11-28')?.paidThroughDate).toBe(period.endDate);
  }
  expect(subscriptionDates([period, next, { ...next, id: 3 }], '2026-11-28')?.paidThroughDate).toBe(period.endDate);
  expect(subscriptionDates([{ ...period, endDate: 'invalid' }], '2026-11-28')).toBeNull();
  expect(subscriptionDates([period, { ...period }], '2026-11-28')).toBeNull();
});
it('uses inclusive Vietnam date boundaries', () => {
  const before = centerNowParts(new Date('2026-11-27T16:59:59Z')).date;
  const start = centerNowParts(new Date('2026-11-27T17:00:00Z')).date;
  expect(subscriptionDates([period], before)).toBeNull();
  expect(subscriptionDates([period], start)?.current.id).toBe(1);
  expect(subscriptionDates([period], period.endDate)?.current.id).toBe(1);
  expect(subscriptionDates([period], '2027-02-26')).toBeNull();
});
