import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { MemberClassesPage } from './MemberClassesPage';
vi.mock('./components/MemberCalendar', () => ({ MemberCalendar: () => <p>PT calendar</p> }));
vi.mock('./components/MemberCoachBookingView', () => ({ MemberCoachBookingView: () => <p>PT booking and payment</p> }));
it.each(['/member/classes', '/member/classes?tab=list', '/member/classes?discipline=Gym'])('replaces old group tabs with the PT calendar at %s', async path => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[path]}><MemberClassesPage /></MemoryRouter>));
    expect(host.textContent).toContain('PT calendar');
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(2);
    expect(host.textContent).not.toMatch(/Lớp nhóm|Đặt sân/);
    await act(async () => host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click());
    expect(host.textContent).toContain('PT booking and payment');
    await act(async () => host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[0].click());
    expect(host.textContent).toContain('PT calendar');
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
it('opens the existing PT payment return URL directly', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/member/classes?tab=pt']}><MemberClassesPage /></MemoryRouter>));
    expect(host.textContent).toContain('PT booking and payment');
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
