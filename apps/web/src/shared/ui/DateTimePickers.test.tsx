import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { DatePicker } from './DatePicker';
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
it('forwards name, data-field, aria-label and aria-invalid on Select', async () => {
  await act(async () => root.render(
    <form>
      <Select id="room-select" name="roomId" data-field="roomId" aria-label="Chọn phòng" aria-invalid="true" value="1" onChange={() => {}}>
        <option value="1">Phòng 1</option>
      </Select>
    </form>
  ));
  const selectBtn = host.querySelector<HTMLButtonElement>('#room-select')!;
  expect(selectBtn.getAttribute('data-field')).toBe('roomId');
  expect(selectBtn.getAttribute('aria-label')).toBe('Chọn phòng');
  expect(selectBtn.getAttribute('aria-invalid')).toBe('true');
  expect(new FormData(host.querySelector('form')!).get('roomId')).toBe('1');
});
it('consumes Escape inside an open date picker and restores trigger focus', async () => {
  await act(async () => root.render(<DatePicker value="2026-10-21" onChange={() => {}} />));
  const trigger = host.querySelector('button')!;
  await act(async () => trigger.click());
  expect(host.querySelector('[role=dialog]')).not.toBeNull();
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  await act(async () => document.dispatchEvent(escape));
  expect(escape.defaultPrevented).toBe(true);
  expect(host.querySelector('[role=dialog]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
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
