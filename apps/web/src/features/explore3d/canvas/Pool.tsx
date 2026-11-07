import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneDoc } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getLevelByCode, getLevelWorldY } from '../scene/selectors';
import { useExploreStore } from '../state/exploreStore';

export interface PoolProps {
  scene?: SceneDoc;
}

const OASIS_POOL_DIMENSIONS = {
  centerX: -6.0,
  centerZ: -5.5,
  width: 25.0,
  depth: 12.0,
} as const;

function createPoolBasinTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([24, 68, 96, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Deep aquatic mosaic base
    ctx.fillStyle = '#173f5a';
    ctx.fillRect(0, 0, 1024, 512);

    // Subtle mosaic tile grid lines
    ctx.strokeStyle = 'rgba(130, 195, 228, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1024; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Center divider line between Lane 01 and Lane 02
    ctx.save();
    ctx.setLineDash([18, 12]);
    ctx.strokeStyle = 'rgba(244, 243, 239, 0.45)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(36, 256);
    ctx.lineTo(988, 256);
    ctx.stroke();
    ctx.restore();

    // FINA floor lane T-marks for Lane 01 (y=128) and Lane 02 (y=384)
    const laneYs = [128, 384];
    for (const ly of laneYs) {
      // Main dark floor guide stripe
      ctx.fillStyle = '#0c2233';
      ctx.fillRect(84, ly - 10, 856, 20);
      // End T-bars
      ctx.fillRect(76, ly - 44, 18, 88);
      ctx.fillRect(930, ly - 44, 18, 88);

      // Salmon turn-target accent crossbars
      ctx.fillStyle = '#ce9180';
      ctx.fillRect(80, ly - 36, 10, 72);
      ctx.fillRect(934, ly - 36, 10, 72);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createPoolWaterCausticTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([58, 124, 165, 255]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#2d7a9c';
    ctx.fillRect(0, 0, 256, 256);

    // Soft procedural caustic wave bands
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.22)';
    ctx.lineWidth = 3;
    for (let row = 0; row < 8; row++) {
      const baseY = row * 32 + 16;
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const wave = Math.sin((x / 256) * Math.PI * 4 + row * 0.9) * 6;
        if (x === 0) {
          ctx.moveTo(x, baseY + wave);
        } else {
          ctx.lineTo(x, baseY + wave);
        }
      }
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  texture.needsUpdate = true;
  return texture;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export function Pool({ scene = SOL_CENTER_SCENE }: PoolProps) {
  const levelMode = useExploreStore(s => s.levelMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const selectNode = useExploreStore(s => s.selectNode);
  const setHoveredId = useExploreStore(s => s.setHoveredId);
  const prefersReducedMotion = usePrefersReducedMotion();

  const levelB1 = useMemo(() => getLevelByCode(scene, 'B1'), [scene]);
  const waterTexRef = useRef<THREE.Texture | null>(null);

  const resources = useMemo(() => {
    const basinTex = createPoolBasinTexture();
    const waterTex = createPoolWaterCausticTexture();

    const basinMat = new THREE.MeshStandardMaterial({
      name: 'oasis-pool-basin-mat',
      map: basinTex,
      roughness: 0.45,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const waterMat = new THREE.MeshStandardMaterial({
      name: 'oasis-pool-water-mat',
      color: '#3a8bb2',
      map: waterTex,
      roughness: 0.16,
      metalness: 0.12,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });

    const copingMat = new THREE.MeshStandardMaterial({
      name: 'oasis-pool-coping-mat',
      color: '#38383d',
      roughness: 0.62,
      metalness: 0.1,
    });

    const accentTrimMat = new THREE.MeshStandardMaterial({
      name: 'oasis-pool-salmon-trim-mat',
      color: '#ce9180',
      roughness: 0.48,
      metalness: 0.2,
    });

    const unitPlaneGeom = new THREE.PlaneGeometry(1, 1);
    const unitBoxGeom = new THREE.BoxGeometry(1, 1, 1);

    return {
      basinTex,
      waterTex,
      basinMat,
      waterMat,
      copingMat,
      accentTrimMat,
      unitPlaneGeom,
      unitBoxGeom,
    };
  }, []);

  useEffect(() => {
    waterTexRef.current = resources.waterTex;
    return () => {
      waterTexRef.current = null;
      resources.basinMat.dispose();
      resources.waterMat.dispose();
      resources.copingMat.dispose();
      resources.accentTrimMat.dispose();
      resources.basinTex.dispose();
      resources.waterTex.dispose();
      resources.unitPlaneGeom.dispose();
      resources.unitBoxGeom.dispose();
    };
  }, [resources]);

  const isB1Visible = levelMode !== 'solo' || focusLevel === 'ALL' || focusLevel === 'B1';
  const canAnimate =
    isB1Visible && !prefersReducedMotion && (focusLevel === 'B1' || focusLevel === 'ALL');

  // Steps subtle UV ripple only when frames are actively rendered (does NOT force 60fps when idle)
  useFrame((_, delta) => {
    const tex = waterTexRef.current;
    if (!canAnimate || !tex) return;
    const step = Math.min(delta, 0.1);
    tex.offset.x = (tex.offset.x + step * 0.035) % 1;
    tex.offset.y = (tex.offset.y + step * 0.018) % 1;
  });

  if (!isB1Visible) {
    return null;
  }

  const b1WorldY = levelB1 ? getLevelWorldY(levelB1, levelMode) : -4.5;
  const { centerX, centerZ, width, depth } = OASIS_POOL_DIMENSIONS;
  const borderThickness = 0.42;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectNode('zone-b1-pool');
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectNode('zone-b1-pool', { fit: true });
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredId('zone-b1-pool');
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredId(null);
  };

  return (
    <group name="sol-oasis-pool" position={[centerX, b1WorldY, centerZ]}>
      {/* Tiled floor basin with FINA lane T-markings */}
      <mesh
        position={[0, 0.018, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[width, depth, 1]}
        geometry={resources.unitPlaneGeom}
        material={resources.basinMat}
        receiveShadow
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

      {/* Semi-transparent caustic water surface */}
      <mesh
        position={[0, 0.14, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[width - 0.1, depth - 0.1, 1]}
        geometry={resources.unitPlaneGeom}
        material={resources.waterMat}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

      {/* Perimeter stone coping deck curb */}
      <mesh
        position={[0, 0.08, -(depth * 0.5 + borderThickness * 0.5)]}
        scale={[width + borderThickness * 2, 0.16, borderThickness]}
        geometry={resources.unitBoxGeom}
        material={resources.copingMat}
      />
      <mesh
        position={[0, 0.08, depth * 0.5 + borderThickness * 0.5]}
        scale={[width + borderThickness * 2, 0.16, borderThickness]}
        geometry={resources.unitBoxGeom}
        material={resources.copingMat}
      />
      <mesh
        position={[-(width * 0.5 + borderThickness * 0.5), 0.08, 0]}
        scale={[borderThickness, 0.16, depth]}
        geometry={resources.unitBoxGeom}
        material={resources.copingMat}
      />
      <mesh
        position={[width * 0.5 + borderThickness * 0.5, 0.08, 0]}
        scale={[borderThickness, 0.16, depth]}
        geometry={resources.unitBoxGeom}
        material={resources.copingMat}
      />

      {/* SÖL salmon overflow gutter accent strip on east & west ends */}
      <mesh
        position={[width * 0.5 + 0.04, 0.165, 0]}
        scale={[0.08, 0.02, depth]}
        geometry={resources.unitBoxGeom}
        material={resources.accentTrimMat}
      />
      <mesh
        position={[-(width * 0.5 + 0.04), 0.165, 0]}
        scale={[0.08, 0.02, depth]}
        geometry={resources.unitBoxGeom}
        material={resources.accentTrimMat}
      />
    </group>
  );
}

export default Pool;
