import { expect, it } from 'vitest';
import { renewalOptionError } from './renewalOptions';
import type { RenewalCandidate } from './receptionApi';

const today = '2026-11-23';
const gold: RenewalCandidate = { id: 2, memberId: 10, packageId: 20, packageName: 'GOLD 9 THÁNG', previousSubscriptionId: null,
  startDate: '2026-11-21', endDate: '2027-08-16', status: 'active', createdAt: '2026-11-21' };
const silver: RenewalCandidate = { ...gold, id: 1, packageId: 10, packageName: 'SILVER 9 THÁNG',
  startDate: '2026-02-24', endDate: '2026-11-20', status: 'expired' };
const packages = [{ id: 10, durationDays: 270 }, { id: 20, durationDays: 270 }];

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
