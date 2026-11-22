import { expect, it } from 'vitest';
import { router } from './router';

it('removes public sport pages while retaining the other planned commit routes', () => {
  const publicPaths = router.routes.map(route => route.path);
  expect(publicPaths).toContain('/');
  expect(publicPaths).toContain('/trainers/:trainerId');
  expect(publicPaths).toContain('/products');
  for (const path of ['/swimming', '/tennis', '/boxing', '/badminton', '/yoga', '/sports/:sportId']) {
    expect(publicPaths).not.toContain(path);
  }
  const portalPaths = router.routes.flatMap(route => route.children ?? []).flatMap(group => group.children ?? []).map(route => route.path);
  for (const path of ['/member/packages', '/member/packages/checkout', '/member/classes', '/member/courts', '/member/streak', '/member/progress', '/member/products', '/staff/classes', '/staff/courts', '/manager/products']) {
    expect(portalPaths).toContain(path);
  }
});
