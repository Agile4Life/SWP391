import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { ItemNode, SceneDoc } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getLevelByCode, getLevelWorldY, itemsOfZone } from '../scene/selectors';
import { useExploreStore } from '../state/exploreStore';

export interface CourtsProps {
  scene?: SceneDoc;
}

function createBadmintonCourtTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([39, 89, 71, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Charcoal outer surround
    ctx.fillStyle = '#1f2226';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle salmon perimeter accent frame
    ctx.strokeStyle = '#ce9180';
    ctx.lineWidth = 8;
    ctx.strokeRect(48, 48, 928, 928);

    // Tournament green playing mat
    ctx.fillStyle = '#255845';
    ctx.fillRect(68, 68, 888, 888);

    // Subtle matte PVC court micro-seam grid for close-up surface sharpness
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 2;
    for (let y = 132; y < 928; y += 64) {
      ctx.beginPath();
      ctx.moveTo(68, y);
      ctx.lineTo(956, y);
      ctx.stroke();
    }

    // Crisp outer contrast border around BWF court lines
    ctx.strokeStyle = 'rgba(15, 34, 27, 0.55)';
    ctx.lineWidth = 18;
    ctx.strokeRect(108, 96, 808, 832);

    // High-contrast white BWF court lines (scaled 2x)
    ctx.strokeStyle = '#faf9f6';
    ctx.lineWidth = 12;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    // Doubles boundary
    ctx.strokeRect(108, 96, 808, 832);

    // Singles sidelines
    ctx.beginPath();
    ctx.moveTo(176, 96);
    ctx.lineTo(176, 928);
    ctx.moveTo(848, 96);
    ctx.lineTo(848, 928);

    // Doubles long service lines
    ctx.moveTo(108, 156);
    ctx.lineTo(916, 156);
    ctx.moveTo(108, 868);
    ctx.lineTo(916, 868);

    // Short service lines
    ctx.moveTo(108, 376);
    ctx.lineTo(916, 376);
    ctx.moveTo(108, 648);
    ctx.lineTo(916, 648);

    // Center service lines
    ctx.moveTo(512, 96);
    ctx.lineTo(512, 376);
    ctx.moveTo(512, 648);
    ctx.lineTo(512, 928);
    ctx.stroke();

    // Service box corner tick marks for architectural precision
    ctx.strokeStyle = 'rgba(206, 145, 128, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(512 - 16, 376);
    ctx.lineTo(512 + 16, 376);
    ctx.moveTo(512 - 16, 648);
    ctx.lineTo(512 + 16, 648);
    ctx.stroke();

    // Crisp double-line net tape & salmon center net line
    ctx.strokeStyle = 'rgba(250, 249, 246, 0.92)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(88, 504);
    ctx.lineTo(936, 504);
    ctx.moveTo(88, 520);
    ctx.lineTo(936, 520);
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([20, 14]);
    ctx.strokeStyle = '#ce9180';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(88, 512);
    ctx.lineTo(936, 512);
    ctx.stroke();
    ctx.restore();

    // Vertical center net strap mark & post anchor pads
    ctx.fillStyle = '#faf9f6';
    ctx.fillRect(507, 496, 10, 32);
    ctx.fillStyle = '#ce9180';
    ctx.fillRect(78, 498, 20, 28);
    ctx.fillRect(926, 498, 20, 28);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createTennisCourtTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([47, 107, 85, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Terracotta / salmon outer apron
    ctx.fillStyle = '#86483a';
    ctx.fillRect(0, 0, 1024, 2048);

    // Crisp outer architectural apron frame
    ctx.strokeStyle = '#ce9180';
    ctx.lineWidth = 8;
    ctx.strokeRect(44, 60, 936, 1928);

    // Championship green inner acrylic court (scaled 2x)
    ctx.fillStyle = '#2c6852';
    ctx.fillRect(104, 148, 816, 1752);

    // Subtle acrylic squeegee pass bands for high-definition court realism
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let y = 148; y < 1900; y += 175) {
      ctx.fillRect(104, y, 816, 88);
    }

    // Subtle dark edge shadow around outer doubles boundary for maximum line crispness
    ctx.strokeStyle = 'rgba(14, 34, 26, 0.55)';
    ctx.lineWidth = 20;
    ctx.strokeRect(136, 184, 752, 1680);

    // Crisp white ITF markings (scaled 2x)
    ctx.strokeStyle = '#faf9f6';
    ctx.lineWidth = 14;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    // Doubles boundary
    ctx.strokeRect(136, 184, 752, 1680);

    // Singles sidelines
    ctx.beginPath();
    ctx.moveTo(228, 184);
    ctx.lineTo(228, 1864);
    ctx.moveTo(796, 184);
    ctx.lineTo(796, 1864);

    // Service lines
    ctx.moveTo(228, 592);
    ctx.lineTo(796, 592);
    ctx.moveTo(228, 1456);
    ctx.lineTo(796, 1456);

    // Center service line
    ctx.moveTo(512, 592);
    ctx.lineTo(512, 1456);

    // Baseline center marks
    ctx.moveTo(512, 184);
    ctx.lineTo(512, 228);
    ctx.moveTo(512, 1820);
    ctx.lineTo(512, 1864);
    ctx.stroke();

    // Double-line white net tape + salmon center net chord + vertical center strap mark
    ctx.strokeStyle = '#faf9f6';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(104, 1014);
    ctx.lineTo(920, 1014);
    ctx.moveTo(104, 1034);
    ctx.lineTo(920, 1034);
    ctx.stroke();

    ctx.strokeStyle = '#ce9180';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(104, 1024);
    ctx.lineTo(920, 1024);
    ctx.stroke();

    // Center net strap & net post bases
    ctx.fillStyle = '#faf9f6';
    ctx.fillRect(505, 1004, 14, 40);
    ctx.fillStyle = '#ce9180';
    ctx.fillRect(92, 1006, 24, 36);
    ctx.fillRect(908, 1006, 24, 36);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const SHARED_COURT_PLANE = new THREE.PlaneGeometry(1, 1);
const SHARED_COURT_RING = new THREE.RingGeometry(0.45, 0.48, 32);

interface CourtSurfaceMeshProps {
  item: ItemNode;
  levelY: number;
  material: THREE.MeshStandardMaterial;
  selected: boolean;
  hovered: boolean;
  receiveShadow: boolean;
  onSelect: (id: string, fit?: boolean) => void;
  onHover: (id: string | null) => void;
}

function CourtSurfaceMesh({
  item,
  levelY,
  material,
  selected,
  hovered,
  receiveShadow,
  onSelect,
  onHover,
}: CourtSurfaceMeshProps) {
  const [w, , d] = item.dimensions;
  const [x, y, z] = item.position;
  const worldY = levelY + Math.max(y, 0.02) + 0.008;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(item.id, false);
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(item.id, true);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(item.id);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(null);
  };

  return (
    <group
      name={`court-surface-${item.id}`}
      position={[x, worldY, z]}
      rotation={[0, item.rotationY, 0]}
    >
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[w, d, 1]}
        geometry={SHARED_COURT_PLANE}
        material={material}
        receiveShadow={receiveShadow}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
      {(selected || hovered) && (
        <mesh
          position={[0, 0.006, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[Math.min(w, d), Math.min(w, d), 1]}
          geometry={SHARED_COURT_RING}
        >
          <meshBasicMaterial color="#ce9180" transparent opacity={selected ? 0.85 : 0.5} />
        </mesh>
      )}
    </group>
  );
}

export function Courts({ scene = SOL_CENTER_SCENE }: CourtsProps) {
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const selectedId = useExploreStore(s => s.selectedId);
  const hoveredId = useExploreStore(s => s.hoveredId);
  const tier = useExploreStore(s => s.tier);
  const selectNode = useExploreStore(s => s.selectNode);
  const setHoveredId = useExploreStore(s => s.setHoveredId);

  const levelL1 = useMemo(() => getLevelByCode(scene, 'L1'), [scene]);
  const levelOut = useMemo(() => getLevelByCode(scene, 'OUT'), [scene]);

  const badmintonCourts = useMemo(
    () =>
      itemsOfZone(scene, 'zone-l1-badminton').filter(item => item.kind === 'badminton-court'),
    [scene],
  );
  const tennisCourts = useMemo(
    () => itemsOfZone(scene, 'zone-out-tennis').filter(item => item.kind === 'tennis-court'),
    [scene],
  );

  const resources = useMemo(() => {
    const badmintonTex = createBadmintonCourtTexture();
    const tennisTex = createTennisCourtTexture();

    const badmintonMat = new THREE.MeshStandardMaterial({
      name: 'court-surface-badminton-mat',
      map: badmintonTex,
      roughness: 0.48,
      metalness: 0.08,
      envMapIntensity: 1.15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const tennisMat = new THREE.MeshStandardMaterial({
      name: 'court-surface-tennis-mat',
      map: tennisTex,
      roughness: 0.52,
      metalness: 0.06,
      envMapIntensity: 1.15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    return { badmintonTex, tennisTex, badmintonMat, tennisMat };
  }, []);

  useEffect(() => {
    return () => {
      resources.badmintonMat.dispose();
      resources.tennisMat.dispose();
      resources.badmintonTex.dispose();
      resources.tennisTex.dispose();
    };
  }, [resources]);

  const showL1 = levelMode !== 'solo' || focusLevel === 'ALL' || focusLevel === 'L1';
  const showOut = levelMode !== 'solo' || focusLevel === 'ALL' || focusLevel === 'OUT';

  const l1WorldY = levelL1 ? getLevelWorldY(levelL1, levelMode) : 0;
  const outWorldY = levelOut ? getLevelWorldY(levelOut, levelMode) : 0;
  const receiveShadow = tier !== 'low';

  const handleSelect = (id: string, fit = false) => {
    selectNode(id, fit ? { fit: true } : undefined);
  };

  return (
    <group name="sol-courts">
      {showL1 &&
        badmintonCourts.map(court => (
          <CourtSurfaceMesh
            key={court.id}
            item={court}
            levelY={l1WorldY}
            material={resources.badmintonMat}
            selected={selectedId === court.id}
            hovered={hoveredId === court.id}
            receiveShadow={receiveShadow}
            onSelect={handleSelect}
            onHover={setHoveredId}
          />
        ))}
      {showOut &&
        tennisCourts.map(court => (
          <CourtSurfaceMesh
            key={court.id}
            item={court}
            levelY={outWorldY}
            material={resources.tennisMat}
            selected={selectedId === court.id}
            hovered={hoveredId === court.id}
            receiveShadow={receiveShadow}
            onSelect={handleSelect}
            onHover={setHoveredId}
          />
        ))}
    </group>
  );
}

export default Courts;
