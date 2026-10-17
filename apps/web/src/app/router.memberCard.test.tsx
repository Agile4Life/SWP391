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
