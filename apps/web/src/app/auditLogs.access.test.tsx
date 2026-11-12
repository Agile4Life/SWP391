import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { router } from './router';
import { useCurrentUser } from '../shared/api/useCurrentUser';

vi.mock('../shared/api/useCurrentUser', () => ({ useCurrentUser: vi.fn() }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(['ADMIN', 'MANAGER', 'MEMBER', 'COACH', 'STAFF', null] as const)(
  'direct /admin/audit-logs access as %s follows the real route guard', async role => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.mocked(useCurrentUser).mockReturnValue(role ? { role, identifier: 'access-test' } as NonNullable<ReturnType<typeof useCurrentUser>> : null);
    const group = router.routes.flatMap(route => route.children ?? [])
      .find(group => group.children?.some(route => route.path === '/admin/audit-logs'));
    expect(group).toBeDefined();
    const memory = createMemoryRouter([
      { element: group!.element, children: [{ path: '/admin/audit-logs', element: <p>Audit screen allowed</p> }] },
      { path: '*', element: <p>Redirected</p> },
    ], { initialEntries: ['/admin/audit-logs'] });
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      await act(async () => { root.render(<RouterProvider router={memory} />); });
      expect(host.textContent).toBe(role === 'ADMIN' ? 'Audit screen allowed' : 'Redirected');
      expect(memory.state.location.pathname === '/admin/audit-logs').toBe(role === 'ADMIN');
    } finally {
      await act(async () => { root.unmount(); });
      memory.dispose();
    }
  },
);
