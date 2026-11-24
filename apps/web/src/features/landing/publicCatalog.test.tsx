import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { setLanguage } from '../../shared/i18n';
import { CatalogPackages, CatalogTrainers } from './components/CatalogSections';
import { calculateBmi, FitnessLanding, parseBmiMetric } from './components/FitnessLanding';
import { usePublicCatalog } from './publicCatalog';
import type { PublicCatalog } from './publicCatalog';

const catalog: PublicCatalog = {
  packages: [{ id: 1, name: 'Gói mới', price: 789000, durationDays: 90, classCreditLimit: 8, description: 'Quyền lợi mới', status: 'active' }],
  coaches: [{ id: 2, name: 'HLV An', specialization: 'Gym', bio: 'Hồ sơ mới', certification: 'Yoga 200h', avatarUrl: null }],
  sessions: [{ id: 3, classId: 1, className: 'Gym sáng', disciplineId: 1, disciplineName: 'Gym', coachId: 2, coachName: 'HLV An', roomId: 1, roomName: 'Phòng 1', sessionDate: '2026-10-24', startTime: '09:00:00', endTime: '10:00:00', status: 'scheduled', cancelReason: null, capacity: 12, bookedCount: 5 }],
};
const host = document.createElement('div');
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  document.body.append(host);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); host.replaceChildren(); host.remove(); localStorage.clear(); setLanguage('vi'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('renders API price, duration, benefits, coaches without group booking controls without sample identities', async () => {
  root = createRoot(host);
  await act(async () => root.render(<MemoryRouter>
    <CatalogPackages catalog={catalog} joinPath="/member/packages" />
    <CatalogTrainers catalog={catalog} />
  </MemoryRouter>));
  expect(host.textContent).toContain('789.000');
  expect(host.textContent).toContain('90 ngày');
  expect(host.textContent).toContain('Quyền lợi mới');
  expect(host.textContent).toContain('HLV An');
  expect(host.textContent).toContain('Ảnh minh họa');
  expect(host.querySelector('a[href="/trainers/2"]')).not.toBeNull();
  expect(host.textContent).not.toMatch(/Derek|1\.200\.000/);
  expect(host.querySelector('.fit-schedule-grid')).toBeNull();
});

it('shows empty states when no public packages, coaches or sessions exist', async () => {
  root = createRoot(host);
  const empty = { packages: [], coaches: [], sessions: [] };
  await act(async () => root.render(<MemoryRouter>
    <CatalogPackages catalog={empty} joinPath="/register" />
    <CatalogTrainers catalog={empty} />
  </MemoryRouter>));
  expect(host.textContent).toContain('Chưa có gói tập');
  expect(host.textContent).toContain('Chưa có huấn luyện viên');
});

it('ignores older responses and hides stale prices on a failed refresh, then retries', async () => {
  const responses: ((response: Response) => void)[] = [];
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => responses.push(resolve))));
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  // Component phụ chỉ phục vụ kiểm thử.
  function Probe() {
    const { catalog: data, error, retry } = usePublicCatalog();
    return <><p>{error ? 'error' : data?.packages[0]?.price ?? 'loading'}</p><button onClick={retry}>retry</button></>;
  }
  // Tạo phản hồi giả của catalog với giá cho trước.
  const reply = (price: number) => new Response(JSON.stringify({ data: { ...catalog, packages: [{ ...catalog.packages[0], price }] } }), { status: 200 });
  root = createRoot(host);
  await act(async () => root.render(<Probe />));
  await act(async () => window.dispatchEvent(new Event('focus')));
  await act(async () => responses[1](reply(990000)));
  await act(async () => responses[0](reply(100000)));
  expect(host.textContent).toContain('990000');
  expect(host.textContent).not.toContain('100000');
  await act(async () => window.dispatchEvent(new Event('focus')));
  await act(async () => responses[2](new Response('{}', { status: 503 })));
  expect(host.textContent).toContain('error');
  expect(host.textContent).not.toContain('990000');
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toContain('loading');
  expect(host.textContent).not.toContain('error');
  await act(async () => responses[3](reply(1100000)));
  expect(host.textContent).toContain('1100000');
});

it('excludes trial packages from the public catalog pricing grid', async () => {
  root = createRoot(host);
  const catalogWithTrial: PublicCatalog = {
    ...catalog,
    packages: [
      ...catalog.packages,
      { id: 99, name: 'Gói Trải Nghiệm 3 Ngày', price: 0, durationDays: 3, classCreditLimit: 3, description: 'Gói trải nghiệm', status: 'active' },
      // Hội viên không mua được gói dưới 3 tháng nên landing không được quảng cáo.
      { id: 98, name: 'SILVER', price: 299000, durationDays: 30, classCreditLimit: 2, description: 'Gói tháng', status: 'active' },
    ],
  };
  await act(async () => root.render(<MemoryRouter>
    <CatalogPackages catalog={catalogWithTrial} joinPath="/register" />
  </MemoryRouter>));
  expect(host.textContent).toContain('Gói mới');
  expect(host.textContent).not.toContain('Gói Trải Nghiệm 3 Ngày');
  expect(host.textContent).not.toContain('SILVER');
  expect(host.textContent).not.toContain('0 đ');
});

it('treats whitespace-only coach avatarUrl as missing', async () => {
  root = createRoot(host);
  const edgeCatalog: PublicCatalog = {
    packages: [],
    coaches: [
      { id: 10, name: 'HLV Huỳnh Đắc Tài', specialization: 'Gym', bio: 'Bio', certification: 'Cert', avatarUrl: '   ' },
      { id: 11, name: 'HLV B', specialization: 'Yoga', bio: 'Bio', certification: 'Cert', avatarUrl: '   ' },
    ],
    sessions: [
      ...catalog.sessions,
      { ...catalog.sessions[0], id: 99, className: 'Lớp đã hủy', status: 'cancelled' },
    ],
  };
  await act(async () => root.render(<MemoryRouter>
    <CatalogTrainers catalog={edgeCatalog} />
  </MemoryRouter>));
  expect(host.textContent).not.toContain('Lớp đã hủy');
  const badges = host.querySelectorAll('.fit-image-caption');
  expect(badges).toHaveLength(1);
});

it('validates BMI inputs including empty, zero, negative, extreme values, decimal comma/dot and rejects malformed strings', () => {
  expect(parseBmiMetric('172,5')).toBe(172.5);
  expect(parseBmiMetric('68.4')).toBe(68.4);
  expect(parseBmiMetric('')).toBeNaN();
  expect(parseBmiMetric('   ')).toBeNaN();
  expect(parseBmiMetric('0x10')).toBeNaN();
  expect(parseBmiMetric('1e2')).toBeNaN();
  expect(parseBmiMetric('Infinity')).toBeNaN();

  expect(calculateBmi('172', '68')).toBe(23);
  expect(calculateBmi('172,5', '68,2')).toBe(22.9);
  expect(calculateBmi('', '68')).toBeNull();
  expect(calculateBmi('   ', '68')).toBeNull();
  expect(calculateBmi('0', '68')).toBeNull();
  expect(calculateBmi('172', '-50')).toBeNull();
  expect(calculateBmi('99.9', '68')).toBeNull();
  expect(calculateBmi('240.1', '68')).toBeNull();
  expect(calculateBmi('172', '29.9')).toBeNull();
  expect(calculateBmi('172', '250.1')).toBeNull();
  expect(calculateBmi('0x100', '68')).toBeNull();
  expect(calculateBmi('1e2', '68')).toBeNull();
  expect(calculateBmi('Infinity', '68')).toBeNull();
});

it('supports Hero Muscle Map hover/focus activation, Escape key dismissal and keeps packages/FAQ without a Shop section', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: catalog }), { status: 200 }))));
  root = createRoot(host);
  await act(async () => root.render(<MemoryRouter><FitnessLanding /></MemoryRouter>));

  const stage = host.querySelector('.fit-hero-anatomy-stage')!;
  expect(host.querySelector('.fit-muscle-callout')).toBeNull();
  const groups = host.querySelectorAll('svg .fit-muscle-zone');
  expect(groups).toHaveLength(6);

  const chestGroup = groups[0] as HTMLElement;
  await act(async () => {
    chestGroup.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  });
  expect(host.querySelector('.fit-muscle-callout')).not.toBeNull();
  expect(chestGroup.getAttribute('aria-pressed')).toBe('true');

  await act(async () => {
    stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(host.querySelector('.fit-muscle-callout')).toBeNull();

  const sectionIds = [...host.querySelectorAll('main > section[id]')].map(s => s.id);
  const packagesIdx = sectionIds.indexOf('packages');
  expect(sectionIds).not.toContain('products');
  expect(host.querySelector('a[href="/products"]')).toBeNull();
  const requestedPaths = vi.mocked(fetch).mock.calls.map(([path]) => String(path));
  expect(requestedPaths.some(path => path.includes('/public/products') || path.includes('/shop/'))).toBe(false);
  expect(host.querySelector('.shop-cart-trigger')).toBeNull();
  const faqIdx = sectionIds.indexOf('faq');
  expect(packagesIdx).toBeGreaterThanOrEqual(0);
  expect(faqIdx).toBeGreaterThan(packagesIdx);
});

it('localizes seeded package perks and coach specialization in English while leaving custom manager copy verbatim', async () => {
  root = createRoot(host);
  const seededAndCustom: PublicCatalog = {
    packages: [
      {
        id: 1,
        name: 'SILVER',
        price: 199000,
        durationDays: 90,
        classCreditLimit: 1,
        description: 'BASIC – Cơ bản\nQuyền lợi:\n- Tập luyện không giới hạn trong giờ hoạt động.',
        status: 'active',
      },
      ...catalog.packages,
    ],
    coaches: [
      {
        id: 21,
        name: 'Trịnh Quang Hùng',
        specialization: 'Gym - Sức mạnh',
        bio: '8 năm huấn luyện sức mạnh, tăng cơ và giảm mỡ cho hội viên mọi trình độ.',
        certification: 'NSCA-CPT',
        avatarUrl: null,
      },
    ],
    sessions: [],
  };
  await act(async () => setLanguage('en'));
  await act(async () =>
    root.render(
      <MemoryRouter>
        <CatalogPackages catalog={seededAndCustom} joinPath="/register" />
        <CatalogTrainers catalog={seededAndCustom} />
      </MemoryRouter>,
    ),
  );
  expect(host.textContent).toContain('BASIC – Essential');
  expect(host.textContent).toContain('Unlimited gym access during operating hours.');
  expect(host.textContent).toContain('Gym - Strength');
  expect(host.textContent).toContain('Quyền lợi mới');
});
