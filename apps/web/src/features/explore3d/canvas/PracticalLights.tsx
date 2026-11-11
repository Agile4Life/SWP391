import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  STREET_LAMPS,
  STREET_LAMP_ARM,
  STREET_LAMP_HEIGHT,
} from '../renderers/architecture/buildCampusGeometry';
import type { QualityTier } from '../state/exploreStore';

/** Tennis floodlight towers [x, z] (see buildInteriorDetails). */
const FLOOD_TOWERS: ReadonlyArray<readonly [number, number]> = [
  [24.2, -14.8],
  [44.8, -14.8],
  [24.2, 14.8],
  [24.2, 0],
];
const FLOOD_HEIGHT = 9.05;

const LAMP_BULBS = STREET_LAMPS.map(([x, z, dx, dz]) => ({
  x: x + dx * STREET_LAMP_ARM,
  y: STREET_LAMP_HEIGHT - 0.12,
  z: z + dz * STREET_LAMP_ARM,
}));

const BULB_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const NOOP_RAYCAST = () => null;

export interface PracticalLightsProps {
  tier: QualityTier;
  /** Vertical offset of the ground campus (exploded / basement views). */
  offsetY: number;
  visible: boolean;
}

/**
 * Dusk practicals: HDR-emissive lamp heads (they bloom) plus a budgeted set of
 * real point lights that pool warm light under street lamps and cool white
 * light over the tennis courts. Emissive bulbs are one instanced draw call.
 */
export function PracticalLights({ tier, offsetY, visible }: PracticalLightsProps) {
  const bulbsRef = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ name: 'sol-practical-bulbs', toneMapped: false }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const count = LAMP_BULBS.length + FLOOD_TOWERS.length;
  useEffect(() => {
    const mesh = bulbsRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const warm = new THREE.Color(9, 5.2, 2.2);
    const cool = new THREE.Color(7, 8, 10);
    LAMP_BULBS.forEach((b, i) => {
      // Slightly larger than the modelled lamp head so it glows from every angle.
      m.makeScale(0.42, 0.13, 0.42).setPosition(b.x, b.y, b.z);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, warm);
    });
    FLOOD_TOWERS.forEach(([x, z], i) => {
      m.makeScale(0.3, 0.5, 1.9).setPosition(x + 0.06, FLOOD_HEIGHT, z);
      mesh.setMatrixAt(LAMP_BULBS.length + i, m);
      mesh.setColorAt(LAMP_BULBS.length + i, cool);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  // Real lights are the expensive part: every other lamp on high, fewer on medium, none on low.
  const lampStep = tier === 'high' ? 2 : 3;
  const litLamps = tier === 'low' ? [] : LAMP_BULBS.filter((_, i) => i % lampStep === 0);
  const litFloods = tier === 'low' ? [] : tier === 'high' ? [FLOOD_TOWERS[0], FLOOD_TOWERS[2]] : [FLOOD_TOWERS[3]];

  return (
    <group name="sol-practical-lights" position={[0, offsetY, 0]} visible={visible}>
      <instancedMesh
        ref={bulbsRef}
        args={[BULB_GEOMETRY, material, count]}
        frustumCulled={false}
        raycast={NOOP_RAYCAST}
      />
      {visible &&
        litLamps.map(b => (
          <pointLight
            key={`lamp-${b.x}-${b.z}`}
            position={[b.x, b.y - 0.35, b.z]}
            color="#ffb46e"
            intensity={95}
            distance={22}
            decay={2}
          />
        ))}
      {visible &&
        litFloods.map(([x, z]) => (
          <pointLight
            key={`flood-${x}-${z}`}
            position={[x + 2.2, FLOOD_HEIGHT - 0.4, z]}
            color="#dfeaff"
            intensity={260}
            distance={46}
            decay={2}
          />
        ))}
    </group>
  );
}

export default PracticalLights;
