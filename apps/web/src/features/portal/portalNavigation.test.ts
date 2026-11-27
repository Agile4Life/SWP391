import { describe, expect, it } from 'vitest';
import {
  getMobileNavLabel,
  getNavLabel,
  isPortalNavActive,
  MOBILE_PRIMARY_NAV,
  MOBILE_PRIMARY_NAV_EN_LABELS,
  PORTAL_NAV,
  PORTAL_NAV_EN_LABELS,
  portalNavRoutes,
} from './portalNavigation';

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
    const attendance = PORTAL_NAV.find(item => item.to === '/coach/pt-attendance')!;
    expect(isPortalNavActive(attendance, '/coach/attendance')).toBe(true);
    expect(isPortalNavActive(attendance, '/coach/attendance/42')).toBe(true);
  });

  it.each(ROLES)('%s: every mobile shortcut resolves to an allowed sidebar entry and has 3 shortcuts', role => {
    const allowed = forRole(role).flatMap(portalNavRoutes);
    expect(MOBILE_PRIMARY_NAV[role]).toHaveLength(3);
    for (const item of MOBILE_PRIMARY_NAV[role]) {
      expect(allowed).toContain(item.to);
      expect(MOBILE_PRIMARY_NAV_EN_LABELS[item.to]).toBeTruthy();
      expect(getMobileNavLabel(item.to, item.label, 'en')).toBe(MOBILE_PRIMARY_NAV_EN_LABELS[item.to]);
    }
  });

  it('provides English labels for every PORTAL_NAV item and includes ADMIN in notifications', () => {
    for (const item of PORTAL_NAV) {
      expect(PORTAL_NAV_EN_LABELS[item.to]).toBeTruthy();
      expect(getNavLabel(item.to, item.label, 'en')).toBe(PORTAL_NAV_EN_LABELS[item.to]);
    }
    const notif = PORTAL_NAV.find(item => item.to === '/member/notifications')!;
    expect(notif.roles).toContain('ADMIN');
    const profile = PORTAL_NAV.find(item => item.to === '/member/profile')!;
    expect(profile.label).toBe('Hồ sơ cá nhân');
  });
});

it('keeps group-class navigation for Member, Coach and Manager while keeping Staff concise and retired features hidden', () => {
  const member = forRole('MEMBER');
  const memberRoutes = member.flatMap(portalNavRoutes);
  expect(memberRoutes).not.toContain('/member/explore');
  expect(memberRoutes).not.toContain('/member/products');
  expect(memberRoutes).not.toContain('/member/orders');
  expect(memberRoutes).toEqual([
    '/member/dashboard',
    '/member/packages',
    '/member/hold',
    '/member/classes',
    '/member/card',
    '/member/check-in',
    '/member/invoices',
    '/member/progress',
    '/member/notifications',
    '/member/profile',
  ]);
  expect(member.find(item => item.to === '/member/classes')?.label).toBe('Lịch học & đặt PT');
  expect(member.find(item => item.to === '/member/progress')?.icon).toBe('dumbbell');

  const coach = forRole('COACH').filter(item => item.to !== '/member/profile' && item.to !== '/member/notifications');
  expect(coach[0].to).toBe('/coach/pt-attendance');
  expect(coach[0].label).toBe('Điểm danh');
  expect(coach.flatMap(portalNavRoutes)).toContain('/coach/attendance');
  expect(coach.find(item => item.to === '/coach/classes')?.label).toBe('Lịch dạy & học viên');

  const manager = forRole('MANAGER').filter(item => item.to !== '/member/profile' && item.to !== '/member/notifications');
  expect(manager.flatMap(portalNavRoutes)).toContain('/manager/classes');
  expect(manager.find(item => item.to === '/manager/classes')?.label).toBe('Lớp học & xếp lịch');
  expect(manager.flatMap(portalNavRoutes)).not.toContain('/manager/products');

  const staff = forRole('STAFF').filter(item => item.to !== '/member/profile' && item.to !== '/member/notifications');
  expect(staff).toHaveLength(5);
  expect(staff.flatMap(portalNavRoutes)).toEqual([
    '/staff/reception',
    '/staff/check-in',
    '/staff/kyc',
    '/staff/holds',
    '/staff/reception-history',
    '/staff/requests',
    '/messages',
  ]);
  const history = staff.find(item => item.to === '/staff/reception-history')!;
  expect(history.icon).toBe('history');
  expect(isPortalNavActive(history, '/staff/reception-history')).toBe(true);
  expect(isPortalNavActive(staff[0], '/staff/reception-history')).toBe(false);
  expect(getNavLabel(history.to, history.label, 'en')).toBe('History');
});
