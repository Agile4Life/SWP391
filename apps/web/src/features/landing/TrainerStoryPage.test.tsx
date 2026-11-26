import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TrainerStoryPage } from './TrainerStoryPage';
import { AUTH_STORAGE_KEY } from '../../shared/api/client';
import type { PublicCatalog } from './publicCatalog';

const defaultCatalog: PublicCatalog = {
  packages: [],
  coaches: [
    { id: 10, name: 'HLV Huỳnh Đắc Tài', specialization: 'Gym - Strength', bio: 'Chuyên gia Gym', certification: 'WBA Level 2', avatarUrl: '   ' },
    { id: 11, name: 'HLV Phạm Hải', specialization: 'Boxing', bio: 'Chuyên gia Boxing', certification: 'AIBA Level 2', avatarUrl: null },
  ],
  sessions: [
    { id: 1, classId: 1, className: 'Gym căn bản', disciplineId: 1, disciplineName: 'Gym - Strength', coachId: 10, coachName: 'HLV Huỳnh Đắc Tài', roomId: 1, roomName: 'Phòng 1', sessionDate: '2999-01-01', startTime: '18:00:00', endTime: '19:00:00', status: 'scheduled', cancelReason: null, capacity: 10, bookedCount: 2 },
    { id: 2, classId: 2, className: 'Boxing Cơ Bản', disciplineId: 2, disciplineName: 'Boxing', coachId: 11, coachName: 'HLV Phạm Hải', roomId: 2, roomName: 'Ring Arena 01', sessionDate: '2999-01-01', startTime: '19:00:00', endTime: '20:00:00', status: 'scheduled', cancelReason: null, capacity: 10, bookedCount: 2 },
  ],
};

let catalogState: { catalog: PublicCatalog | null; error: boolean; retry: ReturnType<typeof vi.fn> };

vi.mock('./publicCatalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./publicCatalog')>()),
  // Giả lập hook tải catalog bằng trạng thái do test điều khiển.
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

// Dựng component vào DOM giả để kiểm thử.
const render = (path: string) => act(async () => root.render(
  <MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/trainers/:trainerId" element={<TrainerStoryPage />} />
  </Routes></MemoryRouter>));

it('renders TrainerStoryPage with portrait/illustration badge rules, coach switcher and session booking links', async () => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: '1', name: 'Member', role: 'MEMBER' }));
  await render('/trainers/10');
  expect(host.querySelector('h1')?.textContent).toContain('HLV Huỳnh Đắc Tài');
  expect(host.querySelector('.fit-image-caption')).toBeNull();
  expect(host.querySelectorAll('.fit-trainer-switch-pill span')).toHaveLength(2);
  expect(host.textContent).toContain('Gym căn bản');
  const bookLink = [...host.querySelectorAll('a.fit-pill')].find(a => a.textContent?.includes('Đặt lịch HLV 1:1'));
  expect(bookLink?.getAttribute('href')).toBe('/member/classes?tab=pt');

  const switchToHai = host.querySelector<HTMLAnchorElement>('a.fit-trainer-switch-pill[href="/trainers/11"]')!;
  await act(async () => switchToHai.click());
  expect(host.querySelector('h1')?.textContent).toContain('HLV Phạm Hải');
  expect(host.querySelector('.fit-image-caption')?.textContent).toBe('Ảnh minh họa');
});
