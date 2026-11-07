import { describe, expect, it } from 'vitest';
import { PORTAL_NAV } from '../../portal/portalNavigation';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { allHotspots } from '../scene/selectors';

describe('Explore 3D Member Feature Coverage', () => {
  it('ensures every MEMBER route in PORTAL_NAV (except /member/explore) is reachable from at least one 3D hotspot', () => {
    const memberRoutes = PORTAL_NAV.filter(
      item => item.roles.includes('MEMBER') && item.to !== '/member/explore',
    ).map(item => item.to);

    expect(memberRoutes.length).toBeGreaterThanOrEqual(12);

    const hotspots = allHotspots(SOL_CENTER_SCENE);
    const reachableRoutes = new Set<string>();

    for (const hs of hotspots) {
      if (hs.action.type === 'navigate') {
        reachableRoutes.add(hs.action.to.split('?')[0]);
        if (hs.action.secondaryTo) {
          reachableRoutes.add(hs.action.secondaryTo.split('?')[0]);
        }
      } else if (hs.action.type === 'open-chat') {
        reachableRoutes.add(hs.action.fallbackTo);
      }
    }

    for (const route of memberRoutes) {
      expect(
        reachableRoutes.has(route),
        `Expected MEMBER route "${route}" to be reachable from at least one HotspotNode in SOL_CENTER_SCENE`,
      ).toBe(true);
    }

    // Also verify extended member routes mentioned in Section 10 of the plan
    expect(reachableRoutes.has('/member/streak')).toBe(true);
    expect(reachableRoutes.has('/member/packages/checkout')).toBe(true);
    expect(reachableRoutes.has('/member/products')).toBe(true);
    expect(reachableRoutes.has('/messages')).toBe(true);
    expect(reachableRoutes.has('/trainers')).toBe(true);
  });
});
