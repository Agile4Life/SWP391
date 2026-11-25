import { act, isValidElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { router } from './router';
import { LegacyStaffRouteRedirect } from './LegacyRedirects';
import { AUTH_STORAGE_KEY, clearAuthSession } from '../shared/api/client';

afterEach(() => {
  clearAuthSession();
  vi.unstubAllGlobals();
});

it('retains public 3-discipline pages and group classes while redirecting retired member routes inside the portal', () => {
  const publicPaths = router.routes.map(route => route.path).filter((path): path is string => typeof path === 'string');
  expect(publicPaths).toEqual([
    '/',
    '/boxing',
    '/yoga',
    '/sports/:sportId',
    '/trainers',
    '/trainers/:trainerId',
    '/login',
    '/register',
    '*',
  ]);

  const portalRoutes = router.routes.flatMap(route => route.children ?? []).flatMap(group => group.children ?? []);
  const portalPaths = portalRoutes.map(route => route.path);
  for (const path of ['/member/products', '/member/products/:slug', '/member/checkout']) {
    expect(portalPaths).not.toContain(path);
  }
  expect(portalPaths.some(path => path?.includes('court'))).toBe(false);

  // Các route hội viên đã ngừng (/member/explore, /member/orders, /member/orders/*, /member/streak) chuyển thẳng về /member/dashboard (không có lazy page).
  for (const retiredMemberPath of ['/member/explore', '/member/orders', '/member/orders/*', '/member/streak']) {
    const route = portalRoutes.find(entry => entry.path === retiredMemberPath);
    expect(route).toBeDefined();
    expect(route?.lazy).toBeUndefined();
    expect(isValidElement<{ to: string; replace?: boolean }>(route?.element)).toBe(true);
    if (isValidElement<{ to: string; replace?: boolean }>(route?.element)) {
      expect(route.element.props.to).toBe('/member/dashboard');
      expect(route.element.props.replace).toBe(true);
    }
  }

  for (const path of ['/member/packages', '/member/packages/checkout', '/member/classes', '/member/progress', '/manager/classes', '/coach/attendance', '/staff/classes', '/staff/orders', '/staff/pt-attendance', '/manager/products', '/manager/products/new', '/manager/products/:productId']) {
    expect(portalPaths).toContain(path);
  }
});

it.each([
  ['MANAGER', '/manager/reports'],
  ['STAFF', '/staff/reception'],
] as const)('redirects retired staff routes directly to %s destination (%s) in a single hop', async (role, expectedPath) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 'u1', identifier: 'u1', name: 'User', role }));
  function LocationReadout() {
    const { pathname } = useLocation();
    return <output data-testid="dest">{pathname}</output>;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(
      <MemoryRouter initialEntries={['/staff/orders']}>
        <Routes>
          <Route path="/staff/orders" element={<LegacyStaffRouteRedirect />} />
          <Route path="*" element={<LocationReadout />} />
        </Routes>
      </MemoryRouter>,
    ));
    expect(host.querySelector('[data-testid="dest"]')?.textContent).toBe(expectedPath);
  } finally {
    await act(async () => root.unmount());
  }
});
