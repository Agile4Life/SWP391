import { describe, expect, it } from 'vitest';
import { cardStatus } from './cardStatus';

describe('cardStatus', () => {
  it('keeps the end date valid through the end of its calendar day', () => {
    expect(cardStatus('active', '2026-10-14', new Date(2026, 9, 14))).toBe('warning');
  });

  it('warns below seven days and expires after the end date', () => {
    expect(cardStatus('active', '2026-10-20', new Date(2026, 9, 14))).toBe('warning');
    expect(cardStatus('active', '2026-10-13', new Date(2026, 9, 14))).toBe('expired');
  });

  it('does not allow QR for inactive or invalid subscriptions', () => {
    expect(cardStatus('pending_payment', '2026-10-30', new Date(2026, 9, 14))).toBe('inactive');
    expect(cardStatus('active', 'bad-date', new Date(2026, 9, 14))).toBe('inactive');
    expect(cardStatus('expired', '2026-10-30', new Date(2026, 9, 14))).toBe('expired');
  });
});
