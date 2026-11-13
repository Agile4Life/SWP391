import { act, isValidElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { router } from './router';
import { useCurrentUser } from '../shared/api/useCurrentUser';
import { getNavLabel, PORTAL_NAV, portalNavRoutes } from '../features/portal/portalNavigation';

vi.mock('../shared/api/useCurrentUser', () => ({ useCurrentUser: vi.fn() }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const PATH = '/admin/payments';
const groups = router.routes.flatMap(route => route.children ?? []);
const adminGroup = () => groups.find(group => group.children?.some(route => route.path === PATH));

describe('Admin payment reconciliation route', () => {
  it('sits behind the ADMIN-only guard', () => {
    const group = adminGroup();
    expect(group).toBeDefined();
    expect(isValidElement<{ allowedRoles: string[] }>(group?.element) && group.element.props.allowedRoles).toEqual(['ADMIN']);
  });

  it('adds a receipt icon entry for Admin only, with an English label', () => {
    const entry = PORTAL_NAV.find(item => item.to === PATH);
    expect(entry?.roles).toEqual(['ADMIN']);
    expect(entry?.icon).toBe('receipt');
    expect(entry?.label).toBe('Đối soát thanh toán');
    expect(getNavLabel(PATH, '', 'en')).toBe('Payment reconciliation');
    for (const role of ['MANAGER', 'STAFF', 'COACH', 'MEMBER'] as const) {
      expect(PORTAL_NAV.filter(item => item.roles.includes(role)).flatMap(portalNavRoutes)).not.toContain(PATH);
    }
  });

  it.each(['ADMIN', 'MANAGER', 'MEMBER', 'COACH', 'STAFF', null] as const)('direct access as %s follows the guard', async role => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.mocked(useCurrentUser).mockReturnValue(role ? { role, identifier: 'access-test' } as NonNullable<ReturnType<typeof useCurrentUser>> : null);
    const memory = createMemoryRouter([
      { element: adminGroup()!.element, children: [{ path: PATH, element: <p>Reconciliation allowed</p> }] },
      { path: '*', element: <p>Redirected</p> },
    ], { initialEntries: [PATH] });
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      await act(async () => { root.render(<RouterProvider router={memory} />); });
      expect(host.textContent).toBe(role === 'ADMIN' ? 'Reconciliation allowed' : 'Redirected');
    } finally {
      await act(async () => { root.unmount(); });
      memory.dispose();
    }
  });
});
