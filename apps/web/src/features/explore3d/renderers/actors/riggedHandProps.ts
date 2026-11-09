import * as THREE from 'three';

export type RiggedHandPropKind = 'racket' | 'tablet';

export interface RiggedHandPropSpec {
  kind: RiggedHandPropKind;
  /** Bone the prop is parented to (it follows the clip, swing included). */
  bone: 'arm-left' | 'arm-right';
  /** Hand position and orientation in the bone's local space, in model units (pre-scale). */
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  /** Uniform size multiplier on top of the base dimensions below (world units). */
  size: number;
}

const FRAME = '#ce9180';
const GRIP = '#19191c';
const SCREEN = '#68b5c9';

interface SharedParts {
  handle: THREE.BufferGeometry;
  frame: THREE.BufferGeometry;
  strings: THREE.BufferGeometry;
  tabletBody: THREE.BufferGeometry;
  tabletScreen: THREE.BufferGeometry;
  frameMaterial: THREE.MeshStandardMaterial;
  gripMaterial: THREE.MeshStandardMaterial;
  stringMaterial: THREE.MeshStandardMaterial;
  screenMaterial: THREE.MeshStandardMaterial;
}

let shared: SharedParts | null = null;

function getSharedParts(): SharedParts {
  if (shared) return shared;
  shared = {
    // Racket points along -Y from the hand, so it extends the forearm.
    handle: new THREE.CylinderGeometry(0.016, 0.018, 0.24, 8),
    frame: new THREE.TorusGeometry(0.1, 0.016, 6, 20),
    strings: new THREE.CircleGeometry(0.095, 16),
    tabletBody: new THREE.BoxGeometry(0.22, 0.015, 0.16),
    tabletScreen: new THREE.PlaneGeometry(0.2, 0.14),
    frameMaterial: new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.4, metalness: 0.3 }),
    gripMaterial: new THREE.MeshStandardMaterial({ color: GRIP, roughness: 0.7 }),
    stringMaterial: new THREE.MeshStandardMaterial({
      color: '#f4f3ef',
      roughness: 0.9,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    screenMaterial: new THREE.MeshStandardMaterial({
      color: SCREEN,
      emissive: SCREEN,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    }),
  };
  return shared;
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  scale: readonly [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(position[0], position[1], position[2]);
  result.rotation.set(rotation[0], rotation[1], rotation[2]);
  result.scale.set(scale[0], scale[1], scale[2]);
  result.raycast = () => null;
  return result;
}

/**
 * Builds a hand-held prop sized in world units and shrunk by `modelScale`, so it
 * stays correct when parented under a bone of a scaled character. Geometry and
 * materials are shared between all props and live for the page's lifetime.
 */
export function buildHandProp(spec: RiggedHandPropSpec, modelScale: number): THREE.Group {
  const parts = getSharedParts();
  const group = new THREE.Group();
  group.name = `rigged-hand-prop-${spec.kind}`;

  if (spec.kind === 'racket') {
    group.add(mesh(parts.handle, parts.gripMaterial, [0, -0.12, 0]));
    // Oval head, flat in the swing plane: ring and strings share an elliptical scale.
    const headScale: [number, number, number] = [0.85, 1.15, 1];
    group.add(mesh(parts.frame, parts.frameMaterial, [0, -0.34, 0], [0, Math.PI / 2, 0], headScale));
    group.add(mesh(parts.strings, parts.stringMaterial, [0, -0.34, 0], [0, Math.PI / 2, 0], headScale));
  } else {
    group.add(mesh(parts.tabletBody, parts.gripMaterial, [0, 0, 0]));
    group.add(mesh(parts.tabletScreen, parts.screenMaterial, [0, 0.009, 0], [-Math.PI / 2, 0, 0]));
  }

  group.scale.setScalar(spec.size / Math.max(modelScale, 1e-4));
  group.position.set(spec.position[0], spec.position[1], spec.position[2]);
  group.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);
  return group;
}
