import { isValidElement } from 'react';
import { expect, it } from 'vitest';
import { router } from './router';

it('redirects the retired checkout route to check-in under the existing staff guard', () => {
  const group = router.routes.flatMap(route => route.children ?? []).find(group =>
    group.children?.some(route => route.path === '/staff/check-out'))!;
  expect(isValidElement<{ allowedRoles: string[] }>(group.element) && group.element.props.allowedRoles)
    .toEqual(['STAFF', 'RECEPTIONIST']);
  const route = group.children!.find(route => route.path === '/staff/check-out')!;
  expect(route.lazy).toBeUndefined();
  expect(isValidElement<{ to: string; replace: boolean }>(route.element) && route.element.props)
    .toMatchObject({ to: '/staff/check-in', replace: true });
});
