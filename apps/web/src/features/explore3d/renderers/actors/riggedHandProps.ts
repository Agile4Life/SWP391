import * as THREE from 'three';

/** Loại vật cầm tay: vợt, máy tính bảng, tạ tay hoặc găng boxing. */
export type RiggedHandPropKind = 'racket' | 'tablet' | 'dumbbell' | 'boxing-glove';

/** Mô tả vật cầm tay: loại, xương gắn vào, vị trí và xoay trong hệ xương, kích thước và màu nhấn. */
export interface RiggedHandPropSpec {
  kind: RiggedHandPropKind;
  /** Bone the prop is parented to (it follows the clip, swing included). */
  bone: string;
  /** Hand position and orientation in the bone's local space, in model units (pre-scale). */
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  /** Uniform size multiplier on top of the base dimensions below (world units). */
  size: number;
  /** Optional accent colour (used for padded boxing gloves). */
  color?: string;
}

const FRAME = '#ce9180';
const GRIP = '#19191c';
const CHROME = '#cfd4dc';
const SCREEN = '#68b5c9';

/** Các phần hình học dùng chung của vật cầm tay (vợt, máy tính bảng, tạ tay, găng). */
interface SharedParts {
  handle: THREE.BufferGeometry;
  buttCap: THREE.BufferGeometry;
  throatStrut: THREE.BufferGeometry;
  throatBridge: THREE.BufferGeometry;
  frame: THREE.BufferGeometry;
  strings: THREE.BufferGeometry;
  tabletBody: THREE.BufferGeometry;
  tabletScreen: THREE.BufferGeometry;
  dumbbellBar: THREE.BufferGeometry;
  dumbbellHead: THREE.BufferGeometry;
  gloveFist: THREE.BufferGeometry;
  gloveThumb: THREE.BufferGeometry;
  gloveCuff: THREE.BufferGeometry;
  frameMaterial: THREE.MeshStandardMaterial;
  throatMaterial: THREE.MeshStandardMaterial;
  gripMaterial: THREE.MeshStandardMaterial;
  chromeMaterial: THREE.MeshStandardMaterial;
  stringMaterial: THREE.MeshStandardMaterial;
  screenMaterial: THREE.MeshStandardMaterial;
  gloveMaterials: Map<string, THREE.MeshStandardMaterial>;
}

let shared: SharedParts | null = null;

/** Tạo (một lần, có cache) các phần hình học và vật liệu dùng chung của vật cầm tay. */
function getSharedParts(): SharedParts {
  if (shared) return shared;
  shared = {
    // Racket points along -Y in its own frame, then rotated into the hand's +Z grip axis.
    handle: new THREE.CylinderGeometry(0.014, 0.0155, 0.18, 8),
    buttCap: new THREE.CylinderGeometry(0.019, 0.016, 0.022, 8),
    throatStrut: new THREE.CylinderGeometry(0.0075, 0.009, 0.105, 6),
    throatBridge: new THREE.CylinderGeometry(0.0065, 0.0065, 0.082, 6).rotateX(Math.PI / 2),
    frame: new THREE.TorusGeometry(0.102, 0.0125, 6, 22),
    strings: new THREE.CircleGeometry(0.098, 18),
    tabletBody: new THREE.BoxGeometry(0.22, 0.014, 0.16),
    tabletScreen: new THREE.PlaneGeometry(0.2, 0.14),
    // Anatomical grip axis in `hand_l` and `hand_r` runs along local Z (pinky -Z to index/thumb +Z).
    dumbbellBar: new THREE.CylinderGeometry(0.014, 0.014, 0.15, 8).rotateX(Math.PI / 2),
    dumbbellHead: new THREE.CylinderGeometry(0.048, 0.048, 0.052, 6).rotateX(Math.PI / 2),
    // Padded 14oz boxing glove: rounded leather fist along +Y (wrist -> knuckles), tucked +Z thumb, wrist wrap.
    gloveFist: new THREE.SphereGeometry(0.068, 12, 10).scale(0.84, 1.22, 0.96),
    gloveThumb: new THREE.CapsuleGeometry(0.022, 0.042, 3, 6),
    gloveCuff: new THREE.CylinderGeometry(0.044, 0.041, 0.065, 10),
    frameMaterial: new THREE.MeshStandardMaterial({ color: FRAME, roughness: 0.34, metalness: 0.32 }),
    throatMaterial: new THREE.MeshStandardMaterial({ color: '#272a32', roughness: 0.38, metalness: 0.45 }),
    gripMaterial: new THREE.MeshStandardMaterial({ color: GRIP, roughness: 0.76 }),
    chromeMaterial: new THREE.MeshStandardMaterial({ color: CHROME, roughness: 0.25, metalness: 0.9 }),
    stringMaterial: new THREE.MeshStandardMaterial({
      color: '#f4f3ef',
      roughness: 0.85,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    screenMaterial: new THREE.MeshStandardMaterial({
      color: SCREEN,
      emissive: SCREEN,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    }),
    gloveMaterials: new Map(),
  };
  return shared;
}

/** Lấy vật liệu găng theo màu (điều chỉnh độ bão hòa/sáng), có cache theo màu. */
function getGloveMaterial(parts: SharedParts, hex: string): THREE.MeshStandardMaterial {
  let mat = parts.gloveMaterials.get(hex);
  if (!mat) {
    const color = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    color.setHSL(hsl.h, Math.min(0.75, hsl.s * 0.85), Math.min(0.54, Math.max(0.22, hsl.l)));
    mat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.06 });
    parts.gloveMaterials.set(hex, mat);
  }
  return mat;
}

/** Tạo một mesh với vị trí, xoay và tỉ lệ cho trước. */
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
  result.castShadow = true;
  result.raycast = () => null;
  return result;
}

/**
 * Dựng vật cầm tay theo đơn vị thế giới và co theo modelScale để đúng cỡ khi gắn vào xương của nhân vật bị co;
 * hình học và vật liệu dùng chung cho mọi vật.
 *
 * Builds a hand-held prop sized in world units and shrunk by `modelScale`, so it
 * stays correct when parented under a bone of a scaled character. Geometry and
 * materials are shared between all props and live for the page's lifetime.
 */
export function buildHandProp(spec: RiggedHandPropSpec, modelScale: number): THREE.Group {
  const parts = getSharedParts();
  const group = new THREE.Group();
  group.name = `rigged-hand-prop-${spec.kind}`;

  if (spec.kind === 'racket') {
    group.add(mesh(parts.handle, parts.gripMaterial, [0, -0.09, 0]));
    // Oval head (children[1]) flat in the YZ swing plane (normal along prop X -> palm normal after rotation).
    const headScale: [number, number, number] = [0.88, 1.18, 1];
    group.add(mesh(parts.frame, parts.frameMaterial, [0, -0.375, 0], [0, Math.PI / 2, 0], headScale));
    group.add(mesh(parts.strings, parts.stringMaterial, [0, -0.375, 0], [0, Math.PI / 2, 0], headScale));
    // Flared butt-cap + twin graphite V-throat bridge struts + throat crossbar.
    group.add(mesh(parts.buttCap, parts.frameMaterial, [0, 0.004, 0]));
    group.add(mesh(parts.throatStrut, parts.throatMaterial, [0, -0.222, -0.025], [-0.38, 0, 0]));
    group.add(mesh(parts.throatStrut, parts.throatMaterial, [0, -0.222, 0.025], [0.38, 0, 0]));
    group.add(mesh(parts.throatBridge, parts.throatMaterial, [0, -0.256, 0]));
  } else if (spec.kind === 'dumbbell') {
    group.add(mesh(parts.dumbbellBar, parts.chromeMaterial, [0, 0, 0]));
    group.add(mesh(parts.dumbbellHead, parts.gripMaterial, [0, 0, -0.088]));
    group.add(mesh(parts.dumbbellHead, parts.gripMaterial, [0, 0, 0.088]));
  } else if (spec.kind === 'boxing-glove') {
    const leather = getGloveMaterial(parts, spec.color ?? FRAME);
    group.add(mesh(parts.gloveFist, leather, [0, 0.032, 0]));
    group.add(mesh(parts.gloveThumb, leather, [0, 0.008, 0.052], [0.42, 0, 0]));
    group.add(mesh(parts.gloveCuff, parts.gripMaterial, [0, -0.055, 0]));
  } else {
    group.add(mesh(parts.tabletBody, parts.gripMaterial, [0, 0, 0]));
    group.add(mesh(parts.tabletScreen, parts.screenMaterial, [0, 0.008, 0], [-Math.PI / 2, 0, 0]));
  }

  group.scale.setScalar(spec.size / Math.max(modelScale, 1e-4));
  group.position.set(spec.position[0], spec.position[1], spec.position[2]);
  group.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);
  return group;
}
