import { describe, expect, it } from 'vitest';
import { addDays, disciplineAccentColor, fitHourRange, groupVisibleLanes, layoutDayEvents, layoutDaySlotEvents, mondayOf, overlapsHour, weekDays, type TimetableEvent } from './timetable';

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
  });

  it('detects which hour slots an event touches', () => {
    const e = ev('a', '08:30:00', '10:00:00');
    expect(overlapsHour(e, 7)).toBe(false);
    expect(overlapsHour(e, 8)).toBe(true);
    expect(overlapsHour(e, 9)).toBe(true);
    expect(overlapsHour(e, 10)).toBe(false);
  });

  it('positions events as a share of the 06:00–22:00 range', () => {
    const [placed] = layoutDayEvents([ev('a', '06:00', '07:00')]);
    expect(placed.topPct).toBe(0);
    expect(placed.heightPct).toBeCloseTo(100 / 16);
    expect(placed.lanes).toBe(1);
  });

  it('puts overlapping events side by side and keeps later ones full width', () => {
    const placed = layoutDayEvents([ev('a', '08:00', '09:30'), ev('b', '09:00', '10:00'), ev('c', '11:00', '12:00')]);
    const byId = Object.fromEntries(placed.map((item) => [item.event.id, item]));
    expect(byId.a.lanes).toBe(2);
    expect(byId.b.lanes).toBe(2);
    expect(byId.a.lane).not.toBe(byId.b.lane);
    expect(byId.c.lanes).toBe(1);
  });

  it('drops events outside the range and clamps ones that straddle its edge', () => {
    const placed = layoutDayEvents([ev('early', '04:00', '05:30'), ev('late', '21:00', '23:00')]);
    expect(placed.map((item) => item.event.id)).toEqual(['late']);
    expect(placed[0].topPct + placed[0].heightPct).toBeCloseTo(100);
  });

  it('fits the hour range to the week, at least 8 hours, inside 06:00–22:00', () => {
    expect(fitHourRange([])).toHaveLength(16);
    expect(fitHourRange([ev('a', '09:15', '10:00'), ev('b', '17:00', '19:30')])).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(fitHourRange([ev('a', '20:00', '21:00')])).toEqual([14, 15, 16, 17, 18, 19, 20, 21]);
    expect(fitHourRange([ev('a', '05:00', '06:30'), ev('late', '23:00', '23:30')])).toEqual([6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('positions events against a custom hour range', () => {
    const [placed] = layoutDayEvents([ev('a', '10:00', '11:00')], 8, 12);
    expect(placed.topPct).toBe(50);
    expect(placed.heightPct).toBe(25);
  });

  it('keeps up to maxVisible overlapping lanes directly visible without overflow', () => {
    const two = layoutDayEvents([ev('yoga', '18:00', '19:00'), ev('boxing', '18:00', '19:00')]);
    const grouped = groupVisibleLanes(two, 2);
    expect(grouped.visible).toHaveLength(2);
    expect(grouped.overflows).toHaveLength(0);
    expect(grouped.visible.every((item) => item.lanes === 2)).toBe(true);
  });

  it('collapses 5 concurrent multi-discipline classes into 1 visible card + "+4" overflow without losing any event', () => {
    const five = layoutDayEvents([
      ev('yoga', '18:00', '19:00'),
      ev('boxing', '18:00', '19:00'),
      ev('pilates', '18:00', '19:00'),
      ev('zumba', '18:00', '19:00'),
      ev('hiit', '18:00', '19:00'),
    ]);
    const grouped = groupVisibleLanes(five, 2);
    expect(grouped.visible).toHaveLength(1);
    expect(grouped.visible[0].lane).toBe(0);
    expect(grouped.visible[0].lanes).toBe(2);
    expect(grouped.overflows).toHaveLength(1);
    expect(grouped.overflows[0].lane).toBe(1);
    expect(grouped.overflows[0].lanes).toBe(2);
    expect(grouped.overflows[0].hiddenEvents).toHaveLength(4);
    expect(grouped.overflows[0].allEvents).toHaveLength(5);
    expect(grouped.overflows[0].rangeLabel).toBe('18:00 – 19:00');
    expect(grouped.visible.length + grouped.overflows[0].hiddenEvents.length).toBe(5);
  });

  it('handles staggered partial overlaps and separate morning/evening clusters independently', () => {
    const events = layoutDayEvents([
      ev('m1', '07:00', '08:00'),
      ev('e1', '18:00', '19:00'),
      ev('e2', '18:30', '19:30'),
      ev('e3', '18:30', '19:30'),
      ev('e4', '19:00', '20:00'),
    ]);
    const grouped = groupVisibleLanes(events, 2);
    const totalHidden = grouped.overflows.reduce((sum, item) => sum + item.hiddenEvents.length, 0);
    expect(grouped.visible.length + totalHidden).toBe(5);
    // Buổi sáng đứng 1 mình vẫn rộng 100% (lanes = 1).
    const morning = grouped.visible.find((item) => item.event.id === 'm1')!;
    expect(morning.lanes).toBe(1);
    expect(grouped.overflows).toHaveLength(1);
    expect(grouped.overflows[0].rangeLabel).toBe('18:00 – 20:00');
  });

  it('assigns stable discipline accent colors', () => {
    expect(disciplineAccentColor(1)).toBe(disciplineAccentColor(1));
    expect(disciplineAccentColor('Yoga')).toBe(disciplineAccentColor('Yoga'));
    expect(disciplineAccentColor(null)).toBeTruthy();
  });

  it('lays out events into 5 fixed slot rows and groups 3+ concurrent slot classes with Slot label', () => {
    const positioned = layoutDaySlotEvents([
      ev('gym', '07:00:00', '09:30:00'),
      ev('yoga', '07:00:00', '09:30:00'),
      ev('boxing', '07:00:00', '09:30:00'),
      ev('pt', '17:00:00', '19:30:00'),
      ev('late', '20:00:00', '21:00:00'),
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
