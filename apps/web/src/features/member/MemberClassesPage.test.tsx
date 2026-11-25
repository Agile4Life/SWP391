import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { MemberClassesPage } from './MemberClassesPage';

vi.mock('./components/MemberCalendar', () => ({ MemberCalendar: () => <p>Merged calendar</p> }));
vi.mock('./components/MemberGroupClassesView', () => ({
  MemberGroupClassesView: ({ initialDiscipline }: { initialDiscipline?: string }) => (
    <p>{`Group classes view${initialDiscipline ? ` (${initialDiscipline})` : ''}`}</p>
  ),
}));
vi.mock('./components/MemberCoachBookingView', () => ({ MemberCoachBookingView: () => <p>PT booking and payment</p> }));

it('renders 3 tabs (My schedule, Group classes, 1:1 PT) and switches cleanly', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={['/member/classes']}><MemberClassesPage /></MemoryRouter>));
    expect(host.textContent).toContain('Merged calendar');
    const tabs = host.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs).toHaveLength(3);

    await act(async () => tabs[1].click());
    expect(host.textContent).toContain('Group classes view');

    await act(async () => tabs[2].click());
    expect(host.textContent).toContain('PT booking and payment');

    await act(async () => tabs[0].click());
    expect(host.textContent).toContain('Merged calendar');
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it.each(['/member/classes?tab=pt', '/member/classes?tab=coach_booking'])('opens 1:1 PT booking directly at %s', async (path) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[path]}><MemberClassesPage /></MemoryRouter>));
    expect(host.textContent).toContain('PT booking and payment');
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it.each([
  ['/member/classes?tab=classes', 'Group classes view'],
  ['/member/classes?discipline=Yoga', 'Group classes view (Yoga)'],
])('opens group classes tab directly at %s', async (path, expected) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[path]}><MemberClassesPage /></MemoryRouter>));
    expect(host.textContent).toContain(expected);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
