import { isValidElement } from 'react';
import { expect, it } from 'vitest';
import { router } from './router';

it('allows only MEMBER to open /member/card', () => {
  const cardGroup = router.routes.flatMap((route) => route.children ?? []).find((group) =>
    group.children?.some((route) => route.path === '/member/card'),
  );
  expect(cardGroup).toBeDefined();
  expect(isValidElement<{ allowedRoles: string[] }>(cardGroup?.element) && cardGroup.element.props.allowedRoles).toEqual(['MEMBER']);
});

it('allows only MEMBER to open the gate QR camera check-in page', () => {
  const group = router.routes.flatMap((route) => route.children ?? []).find((route) =>
    route.children?.some((child) => child.path === '/member/check-in'),
  );
  expect(group).toBeDefined();
  expect(isValidElement<{ allowedRoles: string[] }>(group?.element) && group.element.props.allowedRoles).toEqual(['MEMBER']);
});
