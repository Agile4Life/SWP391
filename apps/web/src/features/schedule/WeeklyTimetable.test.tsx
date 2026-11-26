import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../../shared/i18n/language';
import { WeeklyTimetable } from './WeeklyTimetable';
import type { TimetableEvent } from './timetable';

const calendarCss = readFileSync(resolve(__dirname, 'calendar.css'), 'utf8');

const event: TimetableEvent = {
  id: '7', date: '2099-01-05', startTime: '07:00:00', endTime: '09:30:00',
  title: 'Yoga Flow', meta: 'Zen Garden Studio', detail: 'HLV An', badge: '3/12 chỗ', tone: 'open', ariaLabel: 'Yoga Flow Slot 1',
};
const legend = [{ tone: 'open' as const, label: 'Còn chỗ' }];

describe('WeeklyTimetable', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); setLanguage('vi'); vi.useRealTimers(); vi.unstubAllGlobals(); });
  // Dựng component vào DOM giả để kiểm thử.
  const render = (props: Partial<React.ComponentProps<typeof WeeklyTimetable>> = {}) => act(async () => root.render(
    <WeeklyTimetable label="Tuần" weekStart="2099-01-05" events={[event]} legend={legend}
      onWeekChange={() => {}} onEventClick={() => {}} {...props} />,
  ));
  // Hàm trợ giúp tìm phần tử (nút/tab) trong DOM giả hoặc bấm vào nó.
  const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === text)!;

  it('always renders 5 fixed slots (07:00 – 19:30) on the left axis without a day-range switch', async () => {
    await render();
    expect(host.querySelectorAll('.mcal__col')).toHaveLength(7);
    const slotHeads = [...host.querySelectorAll('.mcal__slot-head')];
    expect(slotHeads).toHaveLength(5);
    expect(slotHeads.map((node) => [
      node.querySelector('.mcal__slot-name')?.textContent,
      node.querySelector('.mcal__slot-time')?.textContent,
    ])).toEqual([
      ['Slot 1', '07:00 – 09:30'],
      ['Slot 2', '09:45 – 11:15'],
      ['Slot 3', '11:30 – 14:00'],
      ['Slot 4', '14:15 – 16:45'],
      ['Slot 5', '17:00 – 19:30'],
    ]);
    expect(host.querySelector('[aria-label="Khung giờ"]')).toBeNull();
    expect(host.textContent).toContain('05/01 – 11/01/2099');
  });

  it('positions events into their exact slot row (0%, 20%, 40%, 60%, 80%)', async () => {
    await render({ events: [{ ...event, startTime: '17:00:00', endTime: '19:30:00' }] });
    // Slot 5 là hàng thứ 5 (index 4 / 5 = 80%).
    expect(host.querySelector<HTMLElement>('.mcal__event')!.style.top).toBe('calc(80% + 3px)');
    expect(host.querySelector<HTMLElement>('.mcal__event')!.style.height).toBe('calc(20% - 6px)');
  });

  it('draws one block per session with title, room, and coach name underneath without a thick left border stripe', async () => {
    const onEventClick = vi.fn();
    await render({ onEventClick });
    const blocks = host.querySelectorAll<HTMLButtonElement>('.mcal__event');
    expect(blocks).toHaveLength(1);
    expect([...blocks[0].children].map((node) => node.textContent)).toEqual(['Yoga Flow', 'Zen Garden Studio', 'HLV An']);
    expect(blocks[0].querySelector('.mcal__event-coach')?.textContent).toBe('HLV An');
    const tooltip = blocks[0].getAttribute('title')!;
    expect(tooltip).toContain('Slot 1 · 07:00 – 09:30');
    expect(tooltip).toContain('HLV An');
    expect(tooltip).toContain('3/12 chỗ');
    expect(blocks[0].classList).toContain('mcal__event--open');
    expect(calendarCss).not.toContain('border-left: 4px');
    await act(async () => blocks[0].click());
    expect(onEventClick).toHaveBeenCalledWith('7');
  });

  it('has no clickable empty slots without onSlotClick', async () => {
    await render();
    expect(host.querySelectorAll('.mcal__slot')).toHaveLength(0);
  });

  it('lets a manager click an empty future slot (7 days × 5 slots) and marks occupied slots', async () => {
    const onSlotClick = vi.fn();
    await render({ onSlotClick });
    expect(host.querySelectorAll('button.mcal__slot')).toHaveLength(7 * 5);
    expect(host.querySelectorAll('.mcal__slot.is-busy')).toHaveLength(1);
    const free = host.querySelector<HTMLButtonElement>('[data-slot="2099-01-06|2"]')!;
    await act(async () => free.click());
    expect(onSlotClick).toHaveBeenCalledWith({ date: '2099-01-06', startTime: '09:45', endTime: '11:15' });
  });

  it('ignores clicks on past slots', async () => {
    const onSlotClick = vi.fn();
    await render({ onSlotClick, weekStart: '2020-01-06', events: [] });
    const past = host.querySelector<HTMLButtonElement>('[data-slot="2020-01-06|2"]')!;
    expect(past.getAttribute('aria-disabled')).toBe('true');
    await act(async () => past.click());
    expect(onSlotClick).not.toHaveBeenCalled();
  });

  it('moves between slots with arrow keys (roving tabindex)', async () => {
    await render({ onSlotClick: () => {} });
    const first = host.querySelector<HTMLButtonElement>('[data-slot="2099-01-05|1"]')!;
    expect(first.tabIndex).toBe(0);
    await act(async () => { first.focus(); });
    await act(async () => { first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.activeElement).toBe(host.querySelector('[data-slot="2099-01-05|2"]'));
    expect(host.querySelectorAll('button.mcal__slot[tabindex="0"]')).toHaveLength(1);
  });

  it('navigates weeks', async () => {
    const onWeekChange = vi.fn();
    await render({ onWeekChange });
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Tuần sau"]')!.click());
    expect(onWeekChange).toHaveBeenCalledWith('2099-01-12');
  });

  it('shows an empty hint, an error with retry, and a loading status', async () => {
    await render({ events: [] });
    expect(host.textContent).toContain('chưa có buổi học nào');
    const onRetry = vi.fn();
    await render({ error: 'Lỗi mạng', onRetry });
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('Lỗi mạng');
    await act(async () => button('Thử lại').click());
    expect(onRetry).toHaveBeenCalled();
    await render({ loading: true });
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('shows one day at a time with 5 slots and a day picker on narrow screens', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    const onSlotClick = vi.fn();
    await render({ onSlotClick, events: [event, { ...event, id: '8', date: '2099-01-07', title: 'Boxing' }] });
    expect(host.querySelectorAll('.mcal__col')).toHaveLength(1);
    expect(host.querySelector('.mcal__col')!.getAttribute('aria-label')).toContain('05/01');
    const chips = [...host.querySelectorAll<HTMLButtonElement>('.mcal__daychip')];
    expect(chips).toHaveLength(7);
    expect(chips[0].textContent).toBe('T2051');
    expect(chips[0].getAttribute('aria-label')).toContain('1 buổi học');
    expect(chips[1].textContent).toBe('T306–');
    await act(async () => chips[2].click());
    expect(host.querySelector('.mcal__col')!.getAttribute('aria-label')).toContain('07/01');
    expect(host.querySelector('.mcal__event')!.textContent).toContain('Boxing');
    expect(host.querySelectorAll('button.mcal__slot')).toHaveLength(5);
  });

  it('opens on the day of the selected block on narrow screens', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
    await render({ events: [event, { ...event, id: '8', date: '2099-01-09', title: 'Boxing' }], selectedId: '8' });
    expect(host.querySelector('.mcal__col')!.getAttribute('aria-label')).toContain('09/01');
  });

  it('shows a bottom scroll cue while later slots remain below the fold and hides it at the bottom', async () => {
    await render({ events: [event, { ...event, id: '9', startTime: '17:00:00', endTime: '19:30:00' }] });
    const scrollBox = host.querySelector<HTMLDivElement>('.mcal__scroll')!;
    Object.defineProperty(scrollBox, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scrollBox, 'scrollHeight', { value: 600, configurable: true });
    scrollBox.scrollTop = 0;

    await act(async () => {
      scrollBox.dispatchEvent(new Event('scroll'));
    });
    expect(host.querySelector('[data-testid="timetable-scroll-cue"]')).not.toBeNull();

    scrollBox.scrollTop = 200;
    await act(async () => {
      scrollBox.dispatchEvent(new Event('scroll'));
    });
    expect(host.querySelector('[data-testid="timetable-scroll-cue"]')).toBeNull();
  });

  it('groups >= 3 concurrent classes in the same slot into "+N lớp" with Slot label and opens full clickable list', async () => {
    const onEventClick = vi.fn();
    const concurrent: TimetableEvent[] = [
      { ...event, id: '1', title: 'Yoga', disciplineName: 'Yoga', meta: 'Zen Garden Studio', startTime: '17:00:00', endTime: '19:30:00' },
      { ...event, id: '2', title: 'Boxing', disciplineName: 'Boxing', meta: 'Ring Arena 01', startTime: '17:00:00', endTime: '19:30:00' },
      { ...event, id: '3', title: 'Gym Strength', disciplineName: 'Gym', meta: 'Phòng Gym Tiêu chuẩn', startTime: '17:00:00', endTime: '19:30:00' },
    ];
    await render({ events: concurrent, maxVisibleLanes: 2, onEventClick });

    expect(host.querySelectorAll('.mcal__event')).toHaveLength(1);
    const overflowBtn = host.querySelector<HTMLButtonElement>('[data-testid="timetable-overflow-btn"]')!;
    expect(overflowBtn).not.toBeNull();
    expect(overflowBtn.textContent).toContain('+2 lớp');
    expect(overflowBtn.textContent).toContain('Slot 5 · 17:00 – 19:30');

    await act(async () => overflowBtn.click());
    const rows = document.querySelectorAll<HTMLButtonElement>('[data-testid="timetable-overflow-list"] button');
    expect(rows).toHaveLength(3);
    expect(document.body.textContent).toContain('Boxing');
    expect(document.body.textContent).toContain('Gym Strength');

    const gymRow = [...rows].find((r) => r.textContent?.includes('Gym Strength'))!;
    await act(async () => gymRow.click());
    expect(onEventClick).toHaveBeenCalledWith('3');
    expect(document.querySelector('[data-testid="timetable-overflow-list"]')).toBeNull();
  });

  it('renders a distinct full-capacity seat badge on full events and guards accent override in CSS', async () => {
    const fullEvent: TimetableEvent = {
      ...event,
      id: '11',
      tone: 'full',
      accentColor: '#60a5fa',
      badge: '12/12 · Đã đầy',
    };
    await render({ events: [fullEvent] });
    const block = host.querySelector<HTMLButtonElement>('.mcal__event')!;
    expect(block.classList).toContain('mcal__event--full');
    expect(block.getAttribute('data-accent')).toBe('true');
    expect(block.querySelector('.mcal__event-badge--full')?.textContent).toBe('12/12 · Đã đầy');
    expect(calendarCss).toContain(":not(.mcal__event--full)");
    expect(calendarCss).not.toContain('.rcal__');
    expect(calendarCss).not.toContain('12.5px');
  });

  it('uses singular English grammar for 1 outside-range session and role-neutral overflow subtitle', async () => {
    setLanguage('en');
    const events: TimetableEvent[] = [
      { ...event, id: '1', title: 'Yoga', startTime: '17:00:00', endTime: '19:30:00' },
      { ...event, id: '2', title: 'Boxing', startTime: '17:00:00', endTime: '19:30:00' },
      { ...event, id: '3', title: 'Gym', startTime: '17:00:00', endTime: '19:30:00' },
      { ...event, id: '4', title: 'Late Session', startTime: '20:30:00', endTime: '21:30:00' },
    ];
    await render({ events, maxVisibleLanes: 2 });
    expect(host.textContent).toContain('1 session outside the 5-slot schedule (07:00–19:30) is not shown.');
    expect(host.textContent).not.toContain('1 sessions');

    const overflowBtn = host.querySelector<HTMLButtonElement>('[data-testid="timetable-overflow-btn"]')!;
    await act(async () => overflowBtn.click());
    expect(document.body.textContent).toContain('Select a session below to view full details.');
    expect(document.body.textContent).not.toContain('reschedule, or cancel');
  });

  it('evaluates today and past slots in Asia/Ho_Chi_Minh (UTC+7)', async () => {
    vi.useFakeTimers();
    // 2026-11-25T18:30:00Z = 2026-11-26 01:30+07:00 (Thursday in VN)
    vi.setSystemTime(new Date('2026-11-25T18:30:00Z'));
    await render({ weekStart: '2026-11-23', events: [], onSlotClick: () => {} });
    const todayHead = host.querySelector('.mcal__dayhead.is-today');
    expect(todayHead?.textContent).toContain('26');
    // 2026-11-25 is yesterday in VN, so Slot 5 on 2026-11-25 is past.
    const yesterdaySlot5 = host.querySelector<HTMLButtonElement>('[data-slot="2026-11-25|5"]')!;
    expect(yesterdaySlot5.getAttribute('aria-disabled')).toBe('true');
    // 2026-11-26 Slot 1 (07:00-09:30) is still upcoming at 01:30 VN.
    const todaySlot1 = host.querySelector<HTMLButtonElement>('[data-slot="2026-11-26|1"]')!;
    expect(todaySlot1.getAttribute('aria-disabled')).toBeNull();
  });
});
