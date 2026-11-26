import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_SLOTS,
  findExactScheduleSlot,
  findScheduleSlot,
  findSlotByNumber,
  formatSlotLabel,
  formatSlotShort,
  isSlotPast,
  isWithinScheduleSlots,
  resolveSlotIndex,
} from './slots';

describe('canonical 5-slot schedule helpers', () => {
  it('defines exactly 5 fixed slots from 07:00 to 20:30', () => {
    expect(SCHEDULE_SLOTS).toHaveLength(5);
    expect(SCHEDULE_SLOTS.map((slot) => [slot.number, slot.code, slot.startTime, slot.endTime])).toEqual([
      [1, 'SLOT_1', '07:00', '09:30'],
      [2, 'SLOT_2', '09:45', '12:15'],
      [3, 'SLOT_3', '12:30', '15:00'],
      [4, 'SLOT_4', '15:15', '17:45'],
      [5, 'SLOT_5', '18:00', '20:30'],
    ]);
  });

  it('finds exact and start-only slots cleanly', () => {
    expect(findExactScheduleSlot('07:00:00', '09:30:00')?.code).toBe('SLOT_1');
    expect(findExactScheduleSlot('09:45', '12:15')?.code).toBe('SLOT_2');
    expect(findExactScheduleSlot('12:30:00', '15:00:00')?.code).toBe('SLOT_3');
    expect(findExactScheduleSlot('15:15', '17:45')?.code).toBe('SLOT_4');
    expect(findExactScheduleSlot('18:00:00', '20:30:00')?.code).toBe('SLOT_5');
    expect(findExactScheduleSlot('07:00', '09:00')).toBeUndefined();
    expect(findExactScheduleSlot('07:00')).toBeUndefined();

    expect(findScheduleSlot('18:00:00')?.code).toBe('SLOT_5');
    expect(findScheduleSlot('18:00:00', '20:30:00')?.code).toBe('SLOT_5');
    expect(findScheduleSlot('18:00:00', '18:00:00')).toBeUndefined();
    expect(findSlotByNumber(3)?.code).toBe('SLOT_3');
    expect(findSlotByNumber(6)).toBeUndefined();
  });

  it('resolves exact slots, overlapping legacy ranges, and rejects out-of-range times', () => {
    expect(resolveSlotIndex('07:00:00', '09:30:00')).toBe(0);
    expect(resolveSlotIndex('09:45:00', '12:15:00')).toBe(1);
    expect(resolveSlotIndex('12:30:00', '15:00:00')).toBe(2);
    expect(resolveSlotIndex('15:15:00', '17:45:00')).toBe(3);
    expect(resolveSlotIndex('18:00:00', '20:30:00')).toBe(4);

    // Overlapping fallback within 07:00–20:30
    expect(resolveSlotIndex('08:00:00', '09:00:00')).toBe(0);
    expect(resolveSlotIndex('10:00:00', '11:00:00')).toBe(1);
    expect(resolveSlotIndex('18:00:00', '19:00:00')).toBe(4);

    // Outside 07:00–20:30
    expect(resolveSlotIndex('05:00:00', '06:30:00')).toBe(-1);
    expect(resolveSlotIndex('21:00:00', '22:00:00')).toBe(-1);
    expect(isWithinScheduleSlots('18:00:00', '20:30:00')).toBe(true);
    expect(isWithinScheduleSlots('21:00:00', '22:00:00')).toBe(false);
  });

  it('formats canonical slot labels and falls back for custom ranges', () => {
    expect(formatSlotLabel('07:00:00', '09:30:00')).toBe('Slot 1 · 07:00 – 09:30');
    expect(formatSlotLabel('18:00', '20:30')).toBe('Slot 5 · 18:00 – 20:30');
    expect(formatSlotLabel('08:00:00', '09:00:00')).toBe('08:00 – 09:00');
    expect(formatSlotLabel(undefined, undefined, 2)).toBe('Slot 2 · 09:45 – 12:15');

    expect(formatSlotShort('09:45:00', '12:15:00')).toBe('Slot 2 (09:45–12:15)');
    expect(formatSlotShort('08:00:00', '09:00:00')).toBe('08:00–09:00');
  });

  it('determines whether a slot is in the past', () => {
    const slot1 = SCHEDULE_SLOTS[0]; // 07:00 – 09:30 (end 570)
    expect(isSlotPast('2026-11-24', slot1, '2026-11-25', 400)).toBe(true);
    expect(isSlotPast('2026-11-26', slot1, '2026-11-25', 900)).toBe(false);
    expect(isSlotPast('2026-11-25', slot1, '2026-11-25', 569)).toBe(false);
    expect(isSlotPast('2026-11-25', slot1, '2026-11-25', 570)).toBe(true);
  });

});
