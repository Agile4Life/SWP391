import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SportPage } from './SportPage';
import { TrainerStoryPage } from './TrainerStoryPage';
import { SPORT_PAGES, sportIdFromPath } from './sportPages';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import type { PublicCatalog } from './publicCatalog';

const defaultCatalog: PublicCatalog = {
  packages: [],
  coaches: [
    { id: 10, name: 'HLV Huỳnh Đắc Tài', specialization: 'Boxing & Kickfit', bio: 'Chuyên gia Boxing', certification: 'WBA Level 2', avatarUrl: '   ' },
    { id: 11, name: 'HLV Phạm Hải', specialization: 'Cầu lông', bio: 'Chuyên gia Cầu lông', certification: 'BWF Coach', avatarUrl: null },
  ],
  sessions: [
    { id: 1, classId: 1, className: 'Boxing căn bản', disciplineId: 1, disciplineName: 'Boxing & Kickfit', coachId: 10, coachName: 'HLV Huỳnh Đắc Tài', roomId: 1, roomName: 'Phòng 1', sessionDate: '2999-01-01', startTime: '18:00:00', endTime: '19:00:00', status: 'scheduled', cancelReason: null, capacity: 10, bookedCount: 2 },
    { id: 2, classId: 2, className: 'Cầu lông đôi', disciplineId: 2, disciplineName: 'Cầu lông', coachId: 11, coachName: 'HLV Phạm Hải', roomId: 2, roomName: 'Sân 1', sessionDate: '2999-01-01', startTime: '19:00:00', endTime: '20:00:00', status: 'scheduled', cancelReason: null, capacity: 10, bookedCount: 2 },
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
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

const render = (path: string) => act(async () => root.render(
  <MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/trainers/:trainerId" element={<TrainerStoryPage />} />
    <Route path="/sports/:sportId" element={<SportPage />} />
    <Route path="/:any" element={<SportPage />} />
  </Routes></MemoryRouter>));

it.each([
  ['/boxing', 'Phòng Tập Boxing', 'Boxing căn bản', 'Boxing'],
  ['/badminton', 'Sân Cầu Lông', 'Cầu lông đôi', 'Cầu lông'],
])('renders the %s page with its own programs and only its own classes', async (path, title, className, name) => {
  await render(path);
  expect(host.querySelector('h1')?.textContent).toContain(title);
  expect(host.textContent).toContain(className);
  const other = className === 'Boxing căn bản' ? 'Cầu lông đôi' : 'Boxing căn bản';
  expect(host.textContent).not.toContain(other);
  expect(host.querySelectorAll('.fit-sport-page-program-card')).toHaveLength(3);
  expect(host.querySelector('.fit-trainer-stats-row')).toBeNull();
  // Chưa đăng nhập: nút đặt lịch dẫn tới đăng nhập
  expect([...host.querySelectorAll('a.fit-pill')].map((link) => link.textContent)).toContain(`Đặt lịch ${name}`);
  expect([...host.querySelectorAll('a.fit-pill')].find((link) => link.textContent?.startsWith('Đặt lịch'))?.getAttribute('href')).toBe('/login');
  expect([...host.querySelectorAll('.fit-trainer-switch-pill')].map((link) => link.getAttribute('href')))
    .toEqual(['/swimming', '/boxing', '/tennis', '/badminton', '/yoga']);
  expect(host.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe(path);
});

it('resolves sport ids from both route shapes including uppercase and trailing whitespace', () => {
  expect(sportIdFromPath('/boxing')).toBe('boxing');
  expect(sportIdFromPath('/sports/badminton')).toBe('badminton');
  expect(sportIdFromPath(' /SPORTS/TENNIS ')).toBe('tennis');
  expect(sportIdFromPath('/')).toBeUndefined();
  expect(Object.keys(SPORT_PAGES)).toEqual(['swimming', 'boxing', 'tennis', 'badminton', 'yoga']);
});

it.each([
  ['/tennis', 'Tennis', 'courts'], ['/badminton', 'Cầu lông', 'courts'],
  ['/swimming', 'Bơi lội', 'courts'], ['/boxing', 'Boxing', 'classes'], ['/yoga', 'Yoga', 'classes'],
])('routes member primary booking from %s to the correct feature', async (path, name, feature) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '1', name: 'Member', role: 'MEMBER' }));
  await render(path);
  expect([...host.querySelectorAll('a.fit-pill')].find(link => link.textContent?.startsWith('Đặt lịch'))?.getAttribute('href'))
    .toBe(`/member/${feature}?discipline=${encodeURIComponent(name)}`);
  if (feature === 'courts') expect([...host.querySelectorAll('a')].find(link => link.textContent?.startsWith('Xem lịch lớp'))?.getAttribute('href'))
    .toBe(`/member/classes?discipline=${encodeURIComponent(name)}`);
});

it('shows retry error state on SportPage when public catalog fails', async () => {
  catalogState = { catalog: null, error: true, retry: vi.fn() };
  await render('/boxing');
  const retryButton = [...host.querySelectorAll('button')].find(b => b.textContent === 'Thử lại')!;
  expect(retryButton).toBeDefined();
  await act(async () => retryButton.click());
  expect(catalogState.retry).toHaveBeenCalledTimes(1);
});

it('renders TrainerStoryPage with portrait/illustration badge rules, coach switcher and session booking links', async () => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '1', name: 'Member', role: 'MEMBER' }));
  await render('/trainers/10');
  expect(host.querySelector('h1')?.textContent).toContain('HLV Huỳnh Đắc Tài');
  expect(host.querySelector('.fit-image-caption')).toBeNull();
  expect(host.querySelectorAll('.fit-trainer-switch-pill span')).toHaveLength(2);
  expect(host.textContent).toContain('Boxing căn bản');
  const bookLink = [...host.querySelectorAll('a.fit-text-link')].find(a => a.textContent?.includes('Đặt lớp'));
  expect(bookLink?.getAttribute('href')).toBe('/member/classes?discipline=Boxing');

  const switchToHai = host.querySelector<HTMLAnchorElement>('a.fit-trainer-switch-pill[href="/trainers/11"]')!;
  await act(async () => switchToHai.click());
  expect(host.querySelector('h1')?.textContent).toContain('HLV Phạm Hải');
  expect(host.querySelector('.fit-image-caption')?.textContent).toBe('Ảnh minh họa');
});
