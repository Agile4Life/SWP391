import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StaffInternalRequestsPage } from './StaffInternalRequestsPage';
import { setLanguage } from '../../shared/i18n/language';

vi.mock('./staffRequestApi', () => ({ getMyStaffRequests: vi.fn().mockResolvedValue([]), createStaffRequest: vi.fn(), cancelStaffRequest: vi.fn() }));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-15T03:00:00Z')); setLanguage('vi');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(['start', 'end'])('keeps the real %s calendar empty without a today highlight and still disables today for leave', async field => {
  await act(async () => root.render(<StaffInternalRequestsPage />));
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Tạo đơn từ mới'))!.click());
  const trigger = host.querySelector<HTMLButtonElement>(`#internal-request-${field}`)!;
  expect(trigger.textContent).toContain('Chọn ngày...');
  await act(async () => trigger.click());
  expect(host.querySelector('.ldp-day-cell.is-today')).toBeNull();
  expect(host.querySelector('.ldp-day-cell.is-selected')).toBeNull();
  const today = host.querySelector<HTMLButtonElement>('[data-date="2026-11-15"]')!;
  expect(today.disabled).toBe(true); expect(today.getAttribute('aria-pressed')).toBe('false');
  expect(host.querySelector<HTMLInputElement>(`input[name="internal-request-${field}"]`)?.value).toBe('');
  expect(host.querySelector('.ldp-title')?.textContent).toContain('Tháng 11, 2026');
});
