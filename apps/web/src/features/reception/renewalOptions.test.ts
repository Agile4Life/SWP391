import { expect, it } from 'vitest';
import { renewalOptionError, eligibleRenewalOptions } from './renewalOptions';
import type { RenewalCandidate } from './receptionApi';

const today = '2026-11-23';
const gold: RenewalCandidate = { id: 2, memberId: 10, packageId: 20, packageName: 'GOLD 9 THÁNG', previousSubscriptionId: null,
  startDate: '2026-11-21', endDate: '2027-08-16', status: 'active', createdAt: '2026-11-21' };
const silver: RenewalCandidate = { ...gold, id: 1, packageId: 10, packageName: 'SILVER 9 THÁNG',
  startDate: '2026-02-24', endDate: '2026-11-20', status: 'expired' };
const packages = [{ id: 10, durationDays: 270 }, { id: 20, durationDays: 270 }];

it('offers only the linked tail regardless of response order or earlier end dates', () => {
  const second = { ...gold, id: 3, previousSubscriptionId: gold.id, startDate: '2027-08-17', endDate: '2028-05-12' };
  const last = { ...gold, id: 4, previousSubscriptionId: second.id, startDate: '2028-05-13', endDate: '2029-02-06' };
  expect(eligibleRenewalOptions([second, last, gold], packages, today).options.map(item => item.id)).toEqual([4]);
});

it('keeps a single eligible period and an empty list without inventing an option', () => {
  expect(eligibleRenewalOptions([gold], packages, today).options).toEqual([gold]);
  expect(eligibleRenewalOptions([], packages, today)).toEqual({ options: [], chainWarning: null });
  expect(eligibleRenewalOptions([{ ...gold, status: 'cancelled' }], packages, today).options).toEqual([]);
  expect(eligibleRenewalOptions([gold], [], today).options).toEqual([]);
});

it('keeps independent chains even when their package names and IDs match', () => {
  const old = { ...gold, id: 8, status: 'expired', startDate: '2025-01-01', endDate: '2025-09-27' };
  const another = { ...old, id: 9, startDate: '2024-01-01', endDate: '2024-09-26' };
  expect(eligibleRenewalOptions([old, another], packages, today).options.map(item => item.id)).toEqual([8, 9]);
});

it('hides branches, cycles, duplicate IDs and missing relationships with feedback', () => {
  const next = { ...gold, id: 3, previousSubscriptionId: gold.id, startDate: '2027-08-17', endDate: '2028-05-12' };
  for (const history of [
    [gold, next, { ...next, id: 4 }],
    [{ ...gold, previousSubscriptionId: next.id }, next],
    [gold, { ...gold }],
    [{ ...gold, previousSubscriptionId: undefined }],
    [{ ...gold, previousSubscriptionId: 999 }],
    [gold, { ...next, startDate: '2027-01-01' }],
  ]) {
    const result = eligibleRenewalOptions(history, packages, today);
    expect(result.options).toEqual([]);
    expect(result.chainWarning).not.toBeNull();
  }
});

it('does not let a broken unrelated chain erase a verified independent choice', () => {
  const broken = { ...silver, previousSubscriptionId: 999 };
  const result = eligibleRenewalOptions([gold, broken], packages, today);
  expect(result.options).toEqual([gold]);
  expect(result.chainWarning).not.toBeNull();
  expect(result.chainWarning).toMatchObject({
    vi: expect.stringContaining('chuỗi gia hạn'),
    en: expect.stringContaining('renewal chains'),
  });
});

it('filters a tail rejected by existing overlap validation', () => {
  const result = eligibleRenewalOptions([gold, silver], packages, today);
  expect(result.options).toEqual([gold]);
  expect(result.chainWarning).toBeNull();
});

it('keeps the current Gold renewal and explains the old Silver overlap using real names', () => {
  expect(renewalOptionError(gold, [gold, silver], packages, today)).toBeNull();
  expect(renewalOptionError(silver, [gold, silver], packages, today)).toMatchObject({
    vi: 'Không thể gia hạn gói SILVER 9 THÁNG vì trùng thời hạn với gói GOLD 9 THÁNG hiện tại. Vui lòng chọn gói hợp lệ.',
  });
});

it('keeps expired renewals and unrelated history that does not overlap the proposed period', () => {
  const older = { ...silver, startDate: '2025-01-01', endDate: '2025-09-27' };
  const expiredGold = { ...gold, startDate: '2025-10-01', endDate: '2026-06-27', status: 'expired' };
  expect(renewalOptionError(older, [older, expiredGold], packages, today)).toBeNull();
  expect(renewalOptionError(expiredGold, [older, expiredGold], packages, today)).toBeNull();
});

it('follows a same-package paid renewal to its tail instead of falsely blocking it', () => {
  const next = { ...gold, id: 3, previousSubscriptionId: gold.id, startDate: '2027-08-17', endDate: '2028-05-12' };
  expect(renewalOptionError(gold, [gold, next], packages, today)).toBeNull();
});

it('explains a replaced package without calling it a date overlap', () => {
  const replacement = { ...gold, previousSubscriptionId: silver.id };
  expect(renewalOptionError(silver, [silver, replacement], packages, today)).toMatchObject({
    vi: 'Kỳ SILVER 9 THÁNG đã được thay bằng GOLD 9 THÁNG. Vui lòng chọn kỳ hiện tại.',
  });
});

it('blocks proven future overlap even when the package name is the same', () => {
  const future = { ...gold, id: 4, startDate: '2027-09-01', endDate: '2028-05-27' };
  expect(renewalOptionError(gold, [gold, future], packages, today)).toMatchObject({
    vi: 'Không thể gia hạn gói GOLD 9 THÁNG vì trùng thời hạn với kỳ GOLD 9 THÁNG đã thanh toán. Vui lòng chọn gói hợp lệ.',
  });
});

it('does not block an expired Silver period just because its tier name differs from Gold', () => {
  const oldGold = { ...gold, startDate: '2025-01-01', endDate: '2025-09-27', status: 'expired' };
  expect(renewalOptionError(silver, [silver, oldGold], packages, today)).toBeNull();
});

it('rejects a proven branching or cyclic chain rather than choosing a tail arbitrarily', () => {
  const first = { ...gold, id: 3, previousSubscriptionId: gold.id, startDate: '2027-08-17' };
  const second = { ...first, id: 4 };
  expect(renewalOptionError(gold, [gold, first, second], packages, today)).not.toBeNull();
  expect(renewalOptionError(gold, [{ ...gold, previousSubscriptionId: gold.id }], packages, today)).not.toBeNull();
});

it('does not guess a renewal period when chain or duration data is missing', () => {
  expect(renewalOptionError(silver, [silver, { ...gold, previousSubscriptionId: undefined }], packages, today)).toBeNull();
  expect(renewalOptionError(silver, [silver, gold], [], today)).toBeNull();
});
