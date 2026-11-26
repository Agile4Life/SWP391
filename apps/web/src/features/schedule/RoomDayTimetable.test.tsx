import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomDayTimetable, type RoomColumn } from './RoomDayTimetable';
import type { TimetableEvent } from './timetable';

const rooms: RoomColumn[] = [
  { id: 1, name: 'Studio A', capacity: 20 },
  { id: 2, name: 'Boxing Arena', capacity: 16 },
  { id: 3, name: 'Zen Room', capacity: 15 },
];

const events: TimetableEvent[] = [
  {
    id: '101',
    date: '2099-01-05',
    startTime: '18:00:00',
    endTime: '19:00:00',
    title: 'Yoga Flow',
    disciplineName: 'Yoga',
    meta: 'Studio A',
    detail: 'HLV Lan',
    badge: '10/20',
    roomId: 1,
    accentColor: '#60a5fa',
    tone: 'open',
    ariaLabel: 'Yoga Flow 18:00',
  },
  {
    id: '102',
    date: '2099-01-05',
    startTime: '18:00:00',
    endTime: '19:00:00',
    title: 'Boxing HIIT',
    disciplineName: 'Boxing',
    meta: 'Boxing Arena',
    detail: 'HLV Hùng',
    badge: '16/16',
    roomId: 2,
    accentColor: '#34d399',
    tone: 'full',
    ariaLabel: 'Boxing HIIT 18:00',
  },
  {
    id: '103',
    date: '2099-01-06',
    startTime: '09:00:00',
    endTime: '10:00:00',
    title: 'Pilates Core',
    disciplineName: 'Pilates',
    meta: 'Zen Room',
    detail: 'HLV Mai',
    badge: '5/15',
    roomId: 3,
    accentColor: '#a78bfa',
    tone: 'open',
    ariaLabel: 'Pilates Core 09:00',
  },
];

describe('RoomDayTimetable', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it('places concurrent multi-discipline classes in separate room columns at 100% width with zero overlap', async () => {
    const onEventClick = vi.fn();
    await act(async () => root.render(
      <RoomDayTimetable
        label="Tổng quan theo phòng"
        date="2099-01-05"
        rooms={rooms}
        events={events}
        legend={[{ tone: 'open', label: 'Còn chỗ' }]}
        onDateChange={() => {}}
        onEventClick={onEventClick}
      />,
    ));

    expect(host.querySelectorAll('.rcal__col')).toHaveLength(3);
    const col1Events = host.querySelectorAll<HTMLButtonElement>('[data-testid="room-col-1"] .rcal__event');
    const col2Events = host.querySelectorAll<HTMLButtonElement>('[data-testid="room-col-2"] .rcal__event');
    const col3Events = host.querySelectorAll<HTMLButtonElement>('[data-testid="room-col-3"] .rcal__event');
    expect(col1Events).toHaveLength(1);
    expect(col2Events).toHaveLength(1);
    expect(col3Events).toHaveLength(0);
    // Mỗi khối chiếm toàn bộ bề rộng cột phòng (100% - 12px margin), không bao giờ bị bóp lane.
    expect(col1Events[0].style.width).toBe('calc(100% - 12px)');
    expect(col2Events[0].style.width).toBe('calc(100% - 12px)');

    await act(async () => col2Events[0].click());
    expect(onEventClick).toHaveBeenCalledWith('102');
  });

  it('pre-fills roomId, date and hour range when clicking a free room slot and ignores past slots', async () => {
    const onSlotClick = vi.fn();
    await act(async () => root.render(
      <RoomDayTimetable
        label="Tổng quan theo phòng"
        date="2099-01-05"
        rooms={rooms}
        events={events}
        legend={[{ tone: 'open', label: 'Còn chỗ' }]}
        onDateChange={() => {}}
        onEventClick={() => {}}
        onSlotClick={onSlotClick}
      />,
    ));

    const slot = host.querySelector<HTMLButtonElement>('[data-room-slot="3|18"]')!;
    await act(async () => slot.click());
    expect(onSlotClick).toHaveBeenCalledWith({
      date: '2099-01-05',
      startTime: '18:00',
      endTime: '19:00',
      roomId: 3,
    });

    onSlotClick.mockClear();
    await act(async () => root.render(
      <RoomDayTimetable
        label="Tổng quan theo phòng"
        date="2020-01-05"
        rooms={rooms}
        events={[]}
        legend={[{ tone: 'open', label: 'Còn chỗ' }]}
        onDateChange={() => {}}
        onEventClick={() => {}}
        onSlotClick={onSlotClick}
      />,
    ));
    const pastSlot = host.querySelector<HTMLButtonElement>('[data-room-slot="1|10"]')!;
    await act(async () => pastSlot.click());
    expect(onSlotClick).not.toHaveBeenCalled();
  });

  it('switches days via the 7-day strip showing per-day counts', async () => {
    const onDateChange = vi.fn();
    await act(async () => root.render(
      <RoomDayTimetable
        label="Tổng quan theo phòng"
        date="2099-01-05"
        rooms={rooms}
        events={events}
        legend={[{ tone: 'open', label: 'Còn chỗ' }]}
        onDateChange={onDateChange}
        onEventClick={() => {}}
      />,
    ));
    const chips = host.querySelectorAll<HTMLButtonElement>('.rcal__daystrip button');
    expect(chips).toHaveLength(7);
    expect(chips[0].textContent).toContain('2');
    expect(chips[1].textContent).toContain('1');
    await act(async () => chips[1].click());
    expect(onDateChange).toHaveBeenCalledWith('2099-01-06');
  });
});
