import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { DatePicker } from '../../shared/ui/DatePicker';
import { isOverdueLeave } from './staffRequestDates';
import type { StaffInternalRequestDto } from './staffRequestApi';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('uses the Vietnam midnight boundary and never relabels other request types or resolved leave', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const request = { requestType: 'LEAVE', status: 'PENDING', startDate: '2026-11-05' } as StaffInternalRequestDto;
  vi.setSystemTime(new Date('2026-11-04T16:59:59Z'));
  expect(isOverdueLeave(request)).toBe(false);
  vi.setSystemTime(new Date('2026-11-04T17:00:00Z'));
  expect(isOverdueLeave(request)).toBe(true);
  for (const status of ['APPROVED', 'REJECTED', 'CANCELLED'] as const) expect(isOverdueLeave({ ...request, status })).toBe(false);
  expect(isOverdueLeave({ ...request, requestType: 'OTHER' })).toBe(false);
});

it('opening the real DatePicker with no value does not choose today or emit a change', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const onChange = vi.fn();
  try {
    await act(async () => root.render(<DatePicker value="" onChange={onChange} />));
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector('.ldp-day-cell.is-today')).not.toBeNull();
    expect(document.querySelector('.ldp-day-cell[aria-pressed="true"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
