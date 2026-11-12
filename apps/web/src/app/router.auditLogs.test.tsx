import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { router } from './router';
import { matchRoutes } from 'react-router-dom';
import { getNavLabel, PORTAL_NAV, portalNavRoutes } from '../features/portal/portalNavigation';

describe('Admin audit and occupancy routes', () => {
  const groups = router.routes.flatMap(route => route.children ?? []);

  it('places the new URL behind the ADMIN guard', () => {
    const group = groups.find(group => group.children?.some(route => route.path === '/admin/audit-logs'));
    expect(group).toBeDefined();
    expect(isValidElement<{ allowedRoles: string[] }>(group?.element) && group.element.props.allowedRoles).toEqual(['ADMIN']);
  });

  it('does not render an audit page at the former Manager URL', () => {
    expect(groups.flatMap(group => group.children ?? []).some(route => route.path === '/manager/audit-logs')).toBe(false);
    expect(matchRoutes(router.routes, '/manager/audit-logs')?.at(-1)?.route.path).toBe('*');
  });

  it('shows the bilingual entry only to Admin and keeps Manager reports', () => {
    const entry = PORTAL_NAV.find(item => item.to === '/admin/audit-logs');
    expect(entry?.roles).toEqual(['ADMIN']);
    expect(entry?.label).toBe('Nhật ký & Lấp đầy');
    expect(getNavLabel('/admin/audit-logs', '', 'en')).toBe('Audit & occupancy');
    const managerRoutes = PORTAL_NAV.filter(item => item.roles.includes('MANAGER')).flatMap(portalNavRoutes);
    expect(managerRoutes).toContain('/manager/reports');
    expect(managerRoutes).not.toContain('/manager/audit-logs');
    expect(managerRoutes).not.toContain('/admin/audit-logs');
  });
});
