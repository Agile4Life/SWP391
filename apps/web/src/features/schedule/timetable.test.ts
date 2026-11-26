import { describe, expect, it } from 'vitest';
import { addDays, disciplineAccentColor, groupVisibleLanes, layoutDaySlotEvents, mondayOf, toISODate, todayISO, weekDays, weekdayLabel, type TimetableEvent } from './timetable';

// Tạo một sự kiện lịch mẫu từ id và giờ bắt đầu/kết thúc.
const ev = (id: string, startTime: string, endTime: string): TimetableEvent => ({
  id, date: '2026-11-09', startTime, endTime, title: id, tone: 'open', ariaLabel: id,
});

describe('timetable helpers', () => {
  it('finds the Monday of any weekday, including Sunday', () => {
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
    expect(mondayOf('2026-11-12')).toBe('2026-11-09');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
    expect(mondayOf('2026-11-16')).toBe('2026-11-16');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(weekDays('2026-11-09')).toHaveLength(7);
    expect(weekDays('2026-11-09')[6]).toBe('2026-11-15');
    expect(weekdayLabel('2026-11-09')).toBe('Thứ 2');
    expect(weekdayLabel('2026-11-15')).toBe('Chủ nhật');
  });

  it('derives todayISO and toISODate in Asia/Ho_Chi_Minh (UTC+7) regardless of host timezone', () => {
    // 2026-11-25T18:30:00Z = 2026-11-26 01:30+07:00
    const utcEvening = new Date('2026-11-25T18:30:00Z');
    expect(todayISO(utcEvening)).toBe('2026-11-26');
    expect(toISODate(utcEvening)).toBe('2026-11-26');

    // 2026-11-25T16:59:59Z = 2026-11-25 23:59:59+07:00
    const utcBeforeMidnightVn = new Date('2026-11-25T16:59:59Z');
    expect(todayISO(utcBeforeMidnightVn)).toBe('2026-11-25');
  });

  it('keeps up to maxVisible overlapping slot lanes directly visible without overflow', () => {
    const two = layoutDaySlotEvents([ev('yoga', '18:00', '20:30'), ev('boxing', '18:00', '20:30')]);
    const grouped = groupVisibleLanes(two, 2);
    expect(grouped.visible).toHaveLength(2);
    expect(grouped.overflows).toHaveLength(0);
    expect(grouped.visible.every((item) => item.lanes === 2)).toBe(true);
  });

  it('collapses 5 concurrent slot classes into 1 visible card + "+4" overflow with 20% minimum height', () => {
    const five = layoutDaySlotEvents([
      ev('yoga', '18:00', '20:30'),
      ev('boxing', '18:00', '20:30'),
      ev('gym1', '18:00', '20:30'),
      ev('gym2', '18:00', '20:30'),
      ev('gym3', '18:00', '20:30'),
    ]);
    const grouped = groupVisibleLanes(five, 2);
    expect(grouped.visible).toHaveLength(1);
    expect(grouped.visible[0].lane).toBe(0);
    expect(grouped.visible[0].lanes).toBe(2);
    expect(grouped.overflows).toHaveLength(1);
    expect(grouped.overflows[0].lane).toBe(1);
    expect(grouped.overflows[0].lanes).toBe(2);
    expect(grouped.overflows[0].heightPct).toBe(20);
    expect(grouped.overflows[0].hiddenEvents).toHaveLength(4);
    expect(grouped.overflows[0].allEvents).toHaveLength(5);
    expect(grouped.overflows[0].rangeLabel).toBe('Slot 5 · 18:00 – 20:30');
    expect(grouped.visible.length + grouped.overflows[0].hiddenEvents.length).toBe(5);
  });

  it('handles separate morning and evening slot clusters independently', () => {
    const events = layoutDaySlotEvents([
      ev('m1', '07:00', '09:30'),
      ev('e1', '18:00', '20:30'),
      ev('e2', '18:00', '20:30'),
      ev('e3', '18:00', '20:30'),
    ]);
    const grouped = groupVisibleLanes(events, 2);
    const totalHidden = grouped.overflows.reduce((sum, item) => sum + item.hiddenEvents.length, 0);
    expect(grouped.visible.length + totalHidden).toBe(4);
    const morning = grouped.visible.find((item) => item.event.id === 'm1')!;
    expect(morning.lanes).toBe(1);
    expect(grouped.overflows).toHaveLength(1);
    expect(grouped.overflows[0].rangeLabel).toBe('Slot 5 · 18:00 – 20:30');
  });

  it('assigns stable discipline accent colors', () => {
    expect(disciplineAccentColor(1)).toBe(disciplineAccentColor(1));
    expect(disciplineAccentColor('Yoga')).toBe(disciplineAccentColor('Yoga'));
    expect(disciplineAccentColor(null)).toBeTruthy();
  });

  it('lays out events into 5 fixed slot rows and ignores out-of-range times', () => {
    const positioned = layoutDaySlotEvents([
      ev('gym', '07:00:00', '09:30:00'),
      ev('yoga', '07:00:00', '09:30:00'),
      ev('boxing', '07:00:00', '09:30:00'),
      ev('pt', '18:00:00', '20:30:00'),
      ev('late', '21:00:00', '22:00:00'),
    ]);
    expect(positioned).toHaveLength(4);
    const pt = positioned.find((p) => p.event.id === 'pt')!;
    expect(pt.topPct).toBe(80);
    expect(pt.heightPct).toBe(20);
    expect(pt.lanes).toBe(1);

    const grouped = groupVisibleLanes(positioned, 2);
    expect(grouped.overflows).toHaveLength(1);
    expect(grouped.overflows[0].hiddenEvents).toHaveLength(2);
    expect(grouped.overflows[0].rangeLabel).toBe('Slot 1 · 07:00 – 09:30');
  });
});
