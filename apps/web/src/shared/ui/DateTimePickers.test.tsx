import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';
import { Select } from './Select';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it('associates a date label with the visible trigger and preserves the submitted value', async () => {
  await act(async () => root.render(<form><label htmlFor="session-date">Ngày học</label><DatePicker id="session-date" name="custom-date" data-field="sessionDate" aria-label="Ngày buổi học" aria-invalid="true" value="2026-10-31" onChange={() => {}} /></form>));
  const trigger = host.querySelector('button')!;
  expect(host.querySelector('label')!.control).toBe(trigger);
  expect(trigger.getAttribute('data-field')).toBe('sessionDate');
  expect(trigger.getAttribute('aria-label')).toBe('Ngày buổi học');
  expect(trigger.getAttribute('aria-invalid')).toBe('true');
  expect(new FormData(host.querySelector('form')!).get('custom-date')).toBe('2026-10-31');
});
it('forwards name, data-field, aria-label and aria-invalid on TimePicker and Select', async () => {
  await act(async () => root.render(
    <form>
      <TimePicker id="session-time" name="custom-time" data-field="startTime" aria-label="Giờ bắt đầu" aria-invalid="true" value="08:00" onChange={() => {}} />
      <Select id="room-select" name="roomId" data-field="roomId" aria-label="Chọn phòng" aria-invalid="true" value="1" onChange={() => {}}>
        <option value="1">Phòng 1</option>
      </Select>
    </form>
  ));
  const timeBtn = host.querySelector<HTMLButtonElement>('#session-time')!;
  expect(timeBtn.getAttribute('data-field')).toBe('startTime');
  expect(timeBtn.getAttribute('aria-label')).toBe('Giờ bắt đầu');
  expect(timeBtn.getAttribute('aria-invalid')).toBe('true');
  expect(new FormData(host.querySelector('form')!).get('custom-time')).toBe('08:00');
  const selectBtn = host.querySelector<HTMLButtonElement>('#room-select')!;
  expect(selectBtn.getAttribute('data-field')).toBe('roomId');
  expect(selectBtn.getAttribute('aria-label')).toBe('Chọn phòng');
  expect(selectBtn.getAttribute('aria-invalid')).toBe('true');
  expect(new FormData(host.querySelector('form')!).get('roomId')).toBe('1');
});
it.each(['date', 'time'])('consumes Escape inside an open %s picker and restores trigger focus', async (kind) => {
  const Picker = kind === 'date' ? DatePicker : TimePicker;
  await act(async () => root.render(<Picker value={kind === 'date' ? '2026-10-21' : '08:00'} onChange={() => {}} />));
  const trigger = host.querySelector('button')!;
  await act(async () => trigger.click());
  expect(host.querySelector('[role=dialog]')).not.toBeNull();
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  await act(async () => document.dispatchEvent(escape));
  expect(escape.defaultPrevented).toBe(true);
  expect(host.querySelector('[role=dialog]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it('allows existing schedules at any minute instead of rounding to five-minute intervals', async () => {
  await act(async () => root.render(<TimePicker value="08:03" onChange={() => {}} />));
  await act(async () => host.querySelector('button')!.click());
  expect([...host.querySelectorAll('.ltp-col:last-child .ltp-col-scroll button')].some(b => b.textContent === '03')).toBe(true);
});
it('keeps Select option scrolling inside the listbox without calling scrollIntoView on ancestors', async () => {
  const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
  await act(async () => root.render(
    <div className="portal-card portal-card--flush"><div className="portal-table-wrapper">
      <Select value="active" onChange={() => {}}>
        <option value="active">Đang hoạt động</option>
        <option value="maintenance">Đang bảo trì</option>
        <option value="broken">Hỏng hóc</option>
        <option value="retired">Ngừng dùng</option>
      </Select>
    </div></div>
  ));
  await act(async () => host.querySelector<HTMLButtonElement>('.ui-select__trigger')!.click());
  expect(host.querySelectorAll('[role="option"]')).toHaveLength(4);
  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('disables and hides required validation inputs when DatePicker or TimePicker is disabled', async () => {
  await act(async () => root.render(
    <form>
      <DatePicker id="d-disabled" value="" onChange={() => {}} required disabled />
      <TimePicker id="t-disabled" value="" onChange={() => {}} required disabled />
    </form>
  ));
  const validationInputs = [...host.querySelectorAll<HTMLInputElement>('input[required]')];
  expect(validationInputs).toHaveLength(2);
  for (const input of validationInputs) {
    expect(input.disabled).toBe(true);
    expect(input.getAttribute('aria-hidden')).toBe('true');
    await act(async () => {
      input.dispatchEvent(new Event('invalid', { cancelable: true }));
    });
  }
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it('clamps empty DatePicker month into [min, max], disables out-of-range Today/nav buttons, supports arrow keys, and restores focus', async () => {
  const onChange = vi.fn();
  await act(async () => root.render(
    <DatePicker value="" min="2030-05-10" max="2030-05-20" onChange={onChange} />
  ));
  const trigger = host.querySelector<HTMLButtonElement>('.luxury-datepicker-trigger')!;
  await act(async () => trigger.click());

  expect(host.querySelector('.ldp-title')?.textContent).toContain('Tháng 5, 2030');
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Tháng trước"]')?.disabled).toBe(true);
  expect(host.querySelector<HTMLButtonElement>('[aria-label="Tháng sau"]')?.disabled).toBe(true);
  const todayBtn = [...host.querySelectorAll<HTMLButtonElement>('.ldp-action-btn')].find((b) => b.textContent === 'Hôm nay')!;
  expect(todayBtn.disabled).toBe(true);

  const day10 = host.querySelector<HTMLButtonElement>('button.ldp-day-cell[data-date="2030-05-10"]')!;
  const day11 = host.querySelector<HTMLButtonElement>('button.ldp-day-cell[data-date="2030-05-11"]')!;
  await act(async () => {
    day10.focus();
    day10.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  });
  expect(document.activeElement).toBe(day11);

  await act(async () => day11.click());
  expect(onChange).toHaveBeenCalledWith({ target: { value: '2030-05-11' } });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);

  await act(async () => trigger.click());
  const clearBtn = host.querySelector<HTMLButtonElement>('.ldp-action-btn.btn-clear')!;
  await act(async () => clearBtn.click());
  expect(onChange).toHaveBeenLastCalledWith({ target: { value: '' } });
  expect(document.activeElement).toBe(trigger);
});

it('does not falsely highlight 08:00 when TimePicker value is empty, exposes aria-pressed, uses fixed positioning, cleans up timer, and restores focus', async () => {
  vi.useFakeTimers();
  const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
  try {
    const onChange = vi.fn();
    await act(async () => root.render(<TimePicker value="" onChange={onChange} />));
    const trigger = host.querySelector<HTMLButtonElement>('.luxury-timepicker-trigger')!;
    await act(async () => trigger.click());

    const popover = host.querySelector<HTMLElement>('.luxury-timepicker-popover')!;
    expect(popover.style.position).toBe('fixed');
    expect(host.querySelector('.ltp-preview-badge')?.textContent).toBe('--:--');
    expect(host.querySelectorAll('.ltp-item-btn.is-active')).toHaveLength(0);
    expect(host.querySelectorAll('.ltp-item-btn[aria-pressed="true"]')).toHaveLength(0);
    expect(host.querySelectorAll('.ltp-item-btn[aria-pressed="false"]')).toHaveLength(84);

    // Đóng bằng nút Xong phải trả focus về trigger
    await act(async () => host.querySelector<HTMLButtonElement>('.ltp-done-btn')!.click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    // Mở lại rồi unmount ngay phải dọn setTimeout
    await act(async () => trigger.click());
    await act(async () => root.unmount());
    expect(clearTimeoutSpy).toHaveBeenCalled();
    root = createRoot(host);
  } finally {
    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  }
});

it('handles Select aria-controls lazily, bounds-checks shrinking options, prevents disabled option mousedown blur, and focuses trigger on invalid', async () => {
  const onChange = vi.fn();
  const renderSelect = (opts: Array<{ value: string; label: string; disabled?: boolean }>, val = '') =>
    root.render(
      <Select value={val} onChange={onChange} required aria-label="Chọn mục">
        {opts.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </Select>,
    );

  await act(async () => renderSelect([
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B', disabled: true },
    { value: 'c', label: 'C' },
  ], 'c'));

  const trigger = host.querySelector<HTMLButtonElement>('.ui-select__trigger')!;
  expect(trigger.getAttribute('aria-controls')).toBeNull();

  // Hidden native <select> invalid -> focus trigger
  const nativeSelect = host.querySelector<HTMLSelectElement>('select.ui-select__native')!;
  await act(async () => {
    nativeSelect.dispatchEvent(new Event('invalid', { cancelable: true }));
  });
  expect(document.activeElement).toBe(trigger);

  await act(async () => trigger.click());
  expect(trigger.getAttribute('aria-controls')).toBeTruthy();

  // Mousedown trên disabled option không làm blur trigger
  const disabledOpt = host.querySelector<HTMLLIElement>('.ui-select__option.is-disabled')!;
  const mdEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  disabledOpt.dispatchEvent(mdEvent);
  expect(mdEvent.defaultPrevented).toBe(true);

  // Rút ngắn mảng options khi đang mở (active = 2 > new length = 1) không gây crash TypeError khi nhấn Enter
  await act(async () => renderSelect([{ value: 'a', label: 'A' }], 'a'));
  await act(async () => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
