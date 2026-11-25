import { expect, it } from 'vitest';
import { router } from './router';

it('retains public 3-discipline pages and group classes while keeping shop, courts, streak and 3D explore retired', () => {
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
  for (const path of ['/member/streak', '/member/products', '/member/products/:slug', '/member/checkout', '/member/orders', '/member/orders/:orderId']) {
    expect(portalPaths).not.toContain(path);
  }
  expect(portalPaths.some(path => path?.includes('court'))).toBe(false);

  const exploreRoute = portalRoutes.find(route => route.path === '/member/explore');
  expect(exploreRoute).toBeDefined();
  expect(exploreRoute?.lazy).toBeUndefined();
  expect(exploreRoute?.element).toBeTruthy();

  for (const path of ['/member/packages', '/member/packages/checkout', '/member/classes', '/member/progress', '/manager/classes', '/coach/attendance', '/staff/classes', '/staff/orders', '/manager/products', '/manager/products/new', '/manager/products/:productId']) {
    expect(portalPaths).toContain(path);
  }
});
