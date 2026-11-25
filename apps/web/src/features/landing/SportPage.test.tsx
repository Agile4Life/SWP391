import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SportPage } from './SportPage';
import { SPORT_PAGES, sportIdFromPath } from './sportPages';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import type { PublicCatalog } from './publicCatalog';

const defaultCatalog: PublicCatalog = {
  packages: [],
  coaches: [
    { id: 10, name: 'HLV Phan Thành Long', specialization: 'Boxing & Tennis', bio: 'Chuyên gia Boxing', certification: 'AIBA Level 2', avatarUrl: null },
    { id: 11, name: 'HLV Vũ Phương Thảo', specialization: 'Bơi lội & Cầu lông', bio: 'Chuyên gia Cầu lông', certification: 'ASCA Level 2', avatarUrl: null },
  ],
  sessions: [
    { id: 1, classId: 1, className: 'Boxing Cơ Bản', disciplineId: 3, disciplineName: 'Boxing', coachId: 10, coachName: 'HLV Phan Thành Long', roomId: 4, roomName: 'Ring Arena 01', sessionDate: '2999-01-01', startTime: '18:00:00', endTime: '19:00:00', status: 'scheduled', cancelReason: null, capacity: 14, bookedCount: 2 },
    { id: 2, classId: 2, className: 'Cầu Lông Bộ Chân & Đánh Đôi', disciplineId: 5, disciplineName: 'Cầu lông', coachId: 11, coachName: 'HLV Vũ Phương Thảo', roomId: 7, roomName: 'Sân Cầu lông 01', sessionDate: '2999-01-01', startTime: '19:00:00', endTime: '20:00:00', status: 'scheduled', cancelReason: null, capacity: 8, bookedCount: 2 },
  ],
};

let catalogState: { catalog: PublicCatalog | null; error: boolean; retry: ReturnType<typeof vi.fn> };

vi.mock('./publicCatalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./publicCatalog')>()),
  usePublicCatalog: () => catalogState,
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  catalogState = { catalog: defaultCatalog, error: false, retry: vi.fn() };
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: { unreadCount: 0 } }), { status: 200 }))));
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const render = (path: string) => act(async () => root.render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/sports/:sportId" element={<SportPage />} />
      <Route path="/:any" element={<SportPage />} />
    </Routes>
  </MemoryRouter>,
));

it.each([
  ['/boxing', 'Phòng Tập Boxing', 'Boxing Cơ Bản', 'Boxing'],
  ['/badminton', 'Sân Cầu Lông', 'Cầu Lông Bộ Chân & Đánh Đôi', 'Cầu lông'],
])('renders %s with its own 3 programs and only its own classes', async (path, title, className, name) => {
  await render(path);
  expect(host.querySelector('h1')?.textContent).toContain(title);
  expect(host.textContent).toContain(className);
  const other = className === 'Boxing Cơ Bản' ? 'Cầu Lông Bộ Chân & Đánh Đôi' : 'Boxing Cơ Bản';
  expect(host.textContent).not.toContain(other);
  expect(host.querySelectorAll('.fit-sport-page-program-card')).toHaveLength(3);
  const cta = [...host.querySelectorAll('a.fit-pill')].find((link) => link.textContent?.includes(name));
  expect(cta?.getAttribute('href')).toBe('/login');
  expect([...host.querySelectorAll('.fit-trainer-switch-pill')].map((link) => link.getAttribute('href')))
    .toEqual(['/swimming', '/boxing', '/tennis', '/badminton', '/yoga']);
  expect(host.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe(path);
});

it('resolves sport ids from both route shapes', () => {
  expect(sportIdFromPath('/boxing')).toBe('boxing');
  expect(sportIdFromPath('/sports/badminton')).toBe('badminton');
  expect(sportIdFromPath(' /SPORTS/TENNIS ')).toBe('tennis');
  expect(sportIdFromPath('/')).toBeUndefined();
  expect(Object.keys(SPORT_PAGES)).toEqual(['swimming', 'boxing', 'tennis', 'badminton', 'yoga']);
});

it.each([
  ['/tennis', 'Tennis'],
  ['/badminton', 'Cầu lông'],
  ['/swimming', 'Bơi lội'],
  ['/boxing', 'Boxing'],
  ['/yoga', 'Yoga'],
])('routes authenticated member from %s to group classes tab (never retired courts)', async (path, name) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '1', name: 'Member', role: 'MEMBER' }));
  await render(path);
  const cta = [...host.querySelectorAll('a.fit-pill')].find((link) => link.textContent?.includes('Đăng ký lớp'));
  expect(cta?.getAttribute('href')).toBe(`/member/classes?tab=classes&discipline=${encodeURIComponent(name)}`);
  expect(host.querySelector('a[href*="/member/courts"]')).toBeNull();
});
