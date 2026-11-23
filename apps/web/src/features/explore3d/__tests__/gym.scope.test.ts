import { expect, it } from 'vitest';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { allZones, allHotspots, resolveDeepLinkNode } from '../scene/selectors';
import { validateSceneDoc } from '../scene/schema';
import { TOUR_STEPS } from '../tour/tourSteps';

it('keeps standard gym and support flows without removed sport or VIP nodes', () => {
  const ids = allZones(SOL_CENTER_SCENE).map(zone => zone.id);
  expect(ids).toContain('zone-l1-gym');
  expect(ids).toContain('zone-l2-pt-studio');
  expect(ids).toContain('zone-l1-gate');
  for (const id of ['item-l1-trophy-totem', 'zone-l2-inbody', 'zone-l1-shop', 'zone-b1-pool', 'zone-b1-thermal', 'zone-l1-boxing', 'zone-l1-badminton', 'zone-l2-vip-gym', 'zone-l2-lounge', 'zone-rf-zen', 'zone-out-tennis']) {
    expect(ids).not.toContain(id);
    expect(SOL_CENTER_SCENE.nodes[id]).toBeUndefined();
  }
  expect(resolveDeepLinkNode(SOL_CENTER_SCENE, 'EQ-VIP-RUN-01')).toBeNull();
  expect(validateSceneDoc(SOL_CENTER_SCENE).errors).toEqual([]);
  for (const step of TOUR_STEPS) expect(SOL_CENTER_SCENE.nodes[step.nodeId]).toBeDefined();
  const actions = allHotspots(SOL_CENTER_SCENE).flatMap(h => h.action.type === 'navigate' ? [h.action.to, h.action.secondaryTo ?? ''] : []);
  expect(actions).not.toContain('/member/products');
  expect(actions).not.toContain('/member/orders');
  expect(actions).not.toContain('/member/streak');
  expect(actions).toContain('/member/progress');
  expect(actions).toContain('/member/classes');
  expect(actions.join(' ')).not.toMatch(/discipline=|sport=|\/member\/courts/);
  const gym = allHotspots(SOL_CENTER_SCENE).find(h => h.id === 'hs-l1-gym');
  expect(gym?.action).toMatchObject({ type: 'navigate', to: '/member/packages' });
  const pt = allHotspots(SOL_CENTER_SCENE).find(h => h.id === 'hs-l2-pt-studio');
  expect(pt?.action).toMatchObject({ type: 'navigate', to: '/member/classes', query: { tab: 'pt' } });
});
