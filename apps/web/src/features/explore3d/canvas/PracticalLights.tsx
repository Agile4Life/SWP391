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
/** Raycast rỗng để đèn không bắt sự kiện chuột. */
const NOOP_RAYCAST = () => null;

/** Props của đèn thực tế: mức chất lượng, độ nhấc theo chiều dọc, hiển thị hay không và chế độ đi bộ. */
export interface PracticalLightsProps {
  tier: QualityTier;
  /** Vertical offset of the ground campus (exploded / basement views). */
  offsetY: number;
  visible: boolean;
  /** Skips outdoor per-pixel pointLights while indoor WalkView is active. */
  walkMode?: boolean;
}

/**
 * Đèn thực tế lúc chạng vạng: đầu đèn phát sáng HDR (một lần vẽ instanced) kèm một số đèn điểm thật chiếu ấm
 * dưới đèn đường và trắng lạnh trên sân tennis.
 *
 * Dusk practicals: HDR-emissive lamp heads (they bloom) plus a budgeted set of
 * real point lights that pool warm light under street lamps and cool white
 * light over the tennis courts. Emissive bulbs are one instanced draw call.
 */
export function PracticalLights({ tier, offsetY, visible, walkMode = false }: PracticalLightsProps) {
  const bulbsRef = useRef<THREE.InstancedMesh>(null);
  // Vật liệu phát sáng cho bóng đèn.
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

  // Real lights are evaluated per fragment across the scene: budget 2 lights on Dark HIGH (1 entrance + 1 flood)
  // while all 15 HDR-emissive bulb quads continue to bloom at 1 instanced draw call.
  const litLamps = tier === 'low' ? [] : [LAMP_BULBS[3]!];
  const litFloods: ReadonlyArray<readonly [number, number]> =
    tier === 'low' ? [] : [[34.5, 0]];
  const showRealLights = visible && !walkMode;

  return (
    <group name="sol-practical-lights" position={[0, offsetY, 0]} visible={visible}>
      <instancedMesh
        ref={bulbsRef}
        args={[BULB_GEOMETRY, material, count]}
        frustumCulled={false}
        raycast={NOOP_RAYCAST}
      />
      {showRealLights &&
        litLamps.map(b => (
          <pointLight
            key={`lamp-${b.x}-${b.z}`}
            position={[b.x, b.y - 0.35, b.z]}
            color="#ffb46e"
            intensity={135}
            distance={32}
            decay={2}
          />
        ))}
      {showRealLights &&
        litFloods.map(([x, z]) => (
          <pointLight
            key={`flood-${x}-${z}`}
            position={[x, FLOOD_HEIGHT - 0.4, z]}
            color="#dfeaff"
            intensity={320}
            distance={44}
            decay={2}
          />
        ))}
    </group>
  );
}

export default PracticalLights;
