import { expect, it } from 'vitest';
import { router } from './router';

it('retains public 6-sport pages and restored group classes while keeping shop, courts and streak retired', () => {
  const publicPaths = router.routes.map(route => route.path);
  expect(publicPaths).toContain('/');
  expect(publicPaths).toContain('/trainers/:trainerId');
  for (const path of ['/products', '/products/:slug', '/checkout']) expect(publicPaths).not.toContain(path);
  for (const path of ['/swimming', '/tennis', '/boxing', '/badminton', '/yoga', '/sports/:sportId']) {
    expect(publicPaths).toContain(path);
  }
  const portalPaths = router.routes.flatMap(route => route.children ?? []).flatMap(group => group.children ?? []).map(route => route.path);
  for (const path of ['/member/streak', '/member/courts', '/member/products', '/member/products/:slug', '/member/checkout', '/member/orders', '/member/orders/:orderId']) expect(portalPaths).not.toContain(path);
  for (const path of ['/member/packages', '/member/packages/checkout', '/member/classes', '/member/progress', '/manager/classes', '/coach/attendance', '/staff/classes', '/staff/courts', '/staff/orders', '/manager/products', '/manager/products/new', '/manager/products/:productId']) {
    expect(portalPaths).toContain(path);
  }
});
