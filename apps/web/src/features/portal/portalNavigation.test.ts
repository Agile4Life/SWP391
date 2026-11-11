import { describe, expect, it } from 'vitest';
import { isPortalNavActive, MOBILE_PRIMARY_NAV, PORTAL_NAV, portalNavRoutes } from './portalNavigation';

const ROLES = ['MEMBER', 'STAFF', 'COACH', 'MANAGER', 'ADMIN'] as const;
const forRole = (role: (typeof ROLES)[number]) => PORTAL_NAV.filter(item => item.roles.includes(role));

describe('portal sidebar grouping', () => {
  it.each(ROLES)('%s: no screen appears in two sidebar entries and each icon is used once', role => {
    const items = forRole(role).filter(item => item.to !== '/member/profile' && item.to !== '/member/notifications');
    const routes = items.flatMap(portalNavRoutes);
    expect(new Set(routes).size).toBe(routes.length);
    const icons = items.map(item => item.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('keeps each merged entry pointing at one of its own tabs', () => {
    for (const item of PORTAL_NAV.filter(entry => entry.tabs)) {
      expect(item.tabs!.length).toBeGreaterThan(1);
      expect(item.tabs!.map(tab => tab.to)).toContain(item.to);
    }
  });

  it('lights up a merged entry on every tab and nested route', () => {
    const card = PORTAL_NAV.find(item => item.to === '/member/card')!;
    expect(isPortalNavActive(card, '/member/check-in')).toBe(true);
    const packages = PORTAL_NAV.find(item => item.to === '/member/packages')!;
    expect(isPortalNavActive(packages, '/member/hold')).toBe(true);
    expect(isPortalNavActive(packages, '/member/packages/checkout')).toBe(true);
    expect(isPortalNavActive(packages, '/member/card')).toBe(false);
  });

  it.each(ROLES)('%s: every mobile shortcut resolves to an allowed sidebar entry', role => {
    const allowed = forRole(role).flatMap(portalNavRoutes);
    for (const item of MOBILE_PRIMARY_NAV[role]) expect(allowed).toContain(item.to);
  });
});
