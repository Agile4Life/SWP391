import { describe, expect, it } from 'vitest';
import { upgradeQuote } from './upgradeQuote';

const silver = { startDate: '2026-11-01', endDate: '2026-11-30' };

describe('upgradeQuote', () => {
  it('deducts the unused value the backend computed from what was actually paid', () => {
    // Còn 15 trên 30 ngày của khoản thanh toán 199.000 -> backend khấu trừ 99.000.
    expect(upgradeQuote({ ...silver, remainingValue: 99_000 }, 299_000, '2026-11-16'))
      .toEqual({ amount: 200_000, credit: 99_000, remainingDays: 15, totalDays: 30, allowed: true });
  });

  it('follows a repriced target package but never the repriced current package', () => {
    // Khoản khấu trừ cố định theo số tiền đã trả; chỉ giá gói mới thay đổi.
    expect(upgradeQuote({ ...silver, remainingValue: 99_000 }, 349_000, '2026-11-16')?.amount).toBe(250_000);
  });

  it('is not allowed when the unused value already covers the new package', () => {
    expect(upgradeQuote({ ...silver, remainingValue: 320_000 }, 299_000, '2026-11-02'))
      .toMatchObject({ amount: 0, allowed: false });
  });

  it('shows no preview when the backend did not send a value', () => {
    expect(upgradeQuote(silver, 299_000, '2026-11-16')).toBeNull();
  });
});
