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
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Charcoal outer surround
    ctx.fillStyle = '#232629';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle salmon perimeter accent frame
    ctx.strokeStyle = '#ce9180';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, 464, 464);

    // Tournament green playing mat
    ctx.fillStyle = '#275947';
    ctx.fillRect(34, 34, 444, 444);

    // White BWF court lines
    ctx.strokeStyle = '#f4f3ef';
    ctx.lineWidth = 6;

    // Doubles boundary
    ctx.strokeRect(54, 48, 404, 416);

    // Singles sidelines
    ctx.beginPath();
    ctx.moveTo(88, 48);
    ctx.lineTo(88, 464);
    ctx.moveTo(424, 48);
    ctx.lineTo(424, 464);

    // Doubles long service lines
    ctx.moveTo(54, 78);
    ctx.lineTo(458, 78);
    ctx.moveTo(54, 434);
    ctx.lineTo(458, 434);

    // Short service lines
    ctx.moveTo(54, 188);
    ctx.lineTo(458, 188);
    ctx.moveTo(54, 324);
    ctx.lineTo(458, 324);

    // Center service lines
    ctx.moveTo(256, 48);
    ctx.lineTo(256, 188);
    ctx.moveTo(256, 324);
    ctx.lineTo(256, 464);
    ctx.stroke();

    // Dashed center net line
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = '#ce9180';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(44, 256);
    ctx.lineTo(468, 256);
    ctx.stroke();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
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
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Terracotta / salmon outer apron
    ctx.fillStyle = '#8b4c3e';
    ctx.fillRect(0, 0, 512, 1024);

    // Championship green inner acrylic court
    ctx.fillStyle = '#2f6b55';
    ctx.fillRect(52, 74, 408, 876);

    // Crisp white ITF markings
    ctx.strokeStyle = '#f4f3ef';
    ctx.lineWidth = 7;

    // Doubles boundary
    ctx.strokeRect(68, 92, 376, 840);

    // Singles sidelines
    ctx.beginPath();
    ctx.moveTo(114, 92);
    ctx.lineTo(114, 932);
    ctx.moveTo(398, 92);
    ctx.lineTo(398, 932);

    // Service lines
    ctx.moveTo(114, 296);
    ctx.lineTo(398, 296);
    ctx.moveTo(114, 728);
    ctx.lineTo(398, 728);

    // Center service line
    ctx.moveTo(256, 296);
    ctx.lineTo(256, 728);

    // Baseline center marks
    ctx.moveTo(256, 92);
    ctx.lineTo(256, 114);
    ctx.moveTo(256, 910);
    ctx.lineTo(256, 932);
    ctx.stroke();

    // Center net line
    ctx.strokeStyle = '#ce9180';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(52, 512);
    ctx.lineTo(460, 512);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
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
      roughness: 0.62,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const tennisMat = new THREE.MeshStandardMaterial({
      name: 'court-surface-tennis-mat',
      map: tennisTex,
      roughness: 0.68,
      metalness: 0.04,
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
