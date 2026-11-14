import * as THREE from 'three';
import type { ActorOutfitPalette } from './liveActorsConfig';

/**
 * Turns the Quaternius base characters (which come in underwear) into gym-goers: sportswear
 * built as a skinned shell over the body, a hairstyle parented to the head, and a skin tone.
 *
 * The clothes are drawn in as much detail as a vertex-coloured shell allows: a loose tee
 * that flares toward the hem, ribbed collar and sleeve cuffs, a chest stripe, shorts or
 * leggings with a waistband, hem trim and a side stripe, ankle socks with a coloured cuff,
 * sneakers with a separate sole, wristbands and a headband. Geometry buffers are shared
 * between actors; only small per-outfit colour arrays and cached materials differ.
 */

export type Gender = 'male' | 'female';
export type HairStyleName =
  | 'hair-simpleparted'
  | 'hair-buzzed'
  | 'hair-long'
  | 'hair-buns'
  | 'hair-buzzedfemale';

export const HAIR_STYLES: Record<Gender, readonly HairStyleName[]> = {
  male: ['hair-simpleparted', 'hair-buzzed', 'hair-simpleparted'],
  female: ['hair-long', 'hair-buns', 'hair-buzzedfemale', 'hair-long'],
};

export interface HumanAssets {
  /** Character scenes by gender (body, eyes, eyebrows on the shared rig). */
  characters: Record<Gender, THREE.Object3D>;
  /** Hairstyle scenes, static meshes in the character's rest-pose space. */
  hair: Record<string, THREE.Object3D>;
  /** Light skin textures (the packed characters carry the dark one). */
  skinLight: Record<Gender, THREE.Texture>;
}

/** What an actor wears; every flag changes the cut or the details of the sportswear. */
export interface OutfitVariant {
  /** Short sleeves, otherwise a tank top. */
  sleeves: boolean;
  /** Cropped top that leaves the midriff bare. */
  crop: boolean;
  /** Tight leggings to below the knee instead of loose shorts. */
  leggings: boolean;
  /** Contrast stripes on the chest and down the side of the legs. */
  stripe: boolean;
  /** Sweatbands on both wrists. */
  wristbands: boolean;
  /** A headband across the forehead. */
  headband: boolean;
}

export interface HumanLook {
  gender: Gender;
  palette: ActorOutfitPalette;
  hairStyle: HairStyleName;
  outfit: OutfitVariant;
  /** Swimmers wear a plain cap in the hair colour instead of a hairstyle. */
  swimCap: boolean;
}

// Kinds of cloth, indexing the colour table of an outfit.
const TOP = 0;
const BOTTOM = 1;
const SHOE = 2;
const SOLE = 3;
const SOCK = 4;
const TRIM = 5;
const WAISTBAND = 6;
const STRIPE = 7;

// Landmarks of the Universal rig in its bind pose (metres, standing 1.82 m tall, T-pose).
const WAIST = 1.02; // where the top meets the shorts
const SHORTS_HEM = 0.7; // above the knee
const LEGGINGS_HEM = 0.3; // below the knee
const ARMPIT = 1.34; // below this only the torso is at this height (the arms hang out in the T-pose)
const TORSO_HALF_WIDTH = 0.215; // above the armpit this is the inner shoulder; beyond it is the arm
const SLEEVE_END_X = 0.34; // short sleeves end partway down the upper arm
const ARM_LOW = 1.36; // the arm at shoulder height in the T-pose
const ARM_HIGH = 1.55;
const WRIST_X = 0.6; // sweatbands sit just before the hand (hand at x = 0.706)
const WRIST_END_X = 0.655;
const CROP_HEM = 1.19;
const SOLE_TOP = 0.032;
const SHOE_TOP = 0.12;
const SOCK_TOP = 0.2;

interface Shell {
  geometry: THREE.BufferGeometry;
  /** Kind of cloth of every vertex, to colour the shell per outfit. */
  kind: Uint8Array;
  /** Index of the source triangle of every vertex, for a little fabric variation. */
  triangle: Uint32Array;
}
const shells = new Map<string, Shell>();

const smooth = (t: number) => Math.min(1, Math.max(0, t));

/** The kind of cloth at a triangle's centre, or -1 where the body stays bare. */
function clothAt(x: number, y: number, normalX: number, normalZ: number, v: OutfitVariant): number {
  if (y < SHOE_TOP) return y < SOLE_TOP ? SOLE : SHOE;
  if (y < SOCK_TOP) return y > SOCK_TOP - 0.018 ? TRIM : SOCK;

  const hem = v.leggings ? LEGGINGS_HEM : SHORTS_HEM;
  if (y >= hem && y < WAIST) {
    if (y >= WAIST - 0.045) return WAISTBAND;
    if (!v.leggings && y < hem + 0.025) return TRIM;
    if (v.stripe && x > 0.06 && Math.abs(normalX) > 0.96) return STRIPE;
    return BOTTOM;
  }

  const topHem = v.crop ? CROP_HEM : WAIST;
  const inner = y < ARMPIT || x < TORSO_HALF_WIDTH;
  if (y >= topHem && inner) {
    const neckTop = x < 0.09 ? 1.45 : 1.515;
    if (y >= neckTop) return -1;
    if (x < 0.12 && y > 1.42) return TRIM;
    if (v.crop && y < topHem + 0.025) return WAISTBAND;
    if (v.stripe && y > 1.235 && y < 1.268 && normalZ > 0.25) return STRIPE;
    return TOP;
  }

  if (y >= ARM_LOW && y < ARM_HIGH && x >= TORSO_HALF_WIDTH) {
    if (v.sleeves && x < SLEEVE_END_X) return x > SLEEVE_END_X - 0.028 ? TRIM : TOP;
    if (v.wristbands && x >= WRIST_X && x < WRIST_END_X) return TRIM;
  }
  return -1;
}

/** How far a kind of cloth stands off the body at height `y`: loose tees and shorts flare toward the hem. */
function standOff(kind: number, y: number, x: number, v: OutfitVariant): number {
  switch (kind) {
    case SOLE:
      return 0.019;
    case SHOE:
      return 0.012;
    case SOCK:
      return 0.006;
    case WAISTBAND:
      return 0.011;
    case BOTTOM:
    case STRIPE:
    case TRIM:
      if (y < SOCK_TOP) return 0.008;
      if (y >= ARM_LOW && x >= TORSO_HALF_WIDTH) return 0.012;
      if (y >= WAIST) return 0.009 + 0.012 * smooth((1.3 - y) / 0.3);
      return v.leggings ? 0.004 : 0.008 + 0.022 * smooth((WAIST - y) / (WAIST - SHORTS_HEM));
    default:
      // Top: close at the shoulders, hanging loose below the chest, fuller sleeves.
      return x >= TORSO_HALF_WIDTH && y >= ARM_LOW ? 0.012 : 0.007 + 0.016 * smooth((1.3 - y) / 0.3);
  }
}

interface Corner {
  p: THREE.Vector3;
  n: THREE.Vector3;
  /** Up to four bone influences: indices and weights. */
  bones: number[];
  weights: number[];
}

/** The influences of two corners averaged, keeping the four strongest bones. */
function blend(a: Corner, b: Corner): Corner {
  const influence = new Map<number, number>();
  for (const corner of [a, b]) {
    corner.bones.forEach((bone, i) => influence.set(bone, (influence.get(bone) ?? 0) + corner.weights[i]! * 0.5));
  }
  const top = [...influence.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
  const total = top.reduce((sum, [, w]) => sum + w, 0) || 1;
  return {
    p: a.p.clone().add(b.p).multiplyScalar(0.5),
    n: a.n.clone().add(b.n).normalize(),
    bones: top.map(([bone]) => bone),
    weights: top.map(([, w]) => w / total),
  };
}

const MAX_SPLITS = 2;

/** The sportswear shell for one body and one cut: body triangles, pushed out along their normals. */
function buildShell(body: THREE.SkinnedMesh, v: OutfitVariant, key: string): Shell {
  const cached = shells.get(key);
  if (cached) return cached;

  const source = body.geometry;
  const position = source.getAttribute('position');
  const normal = source.getAttribute('normal');
  const skinIndex = source.getAttribute('skinIndex');
  const skinWeight = source.getAttribute('skinWeight');
  const index = source.getIndex();
  const triangles = index ? index.count / 3 : position.count / 3;
  const corner = (id: number): Corner => ({
    p: new THREE.Vector3(position.getX(id), position.getY(id), position.getZ(id)),
    n: new THREE.Vector3(normal.getX(id), normal.getY(id), normal.getZ(id)),
    bones: [0, 1, 2, 3].map(w => skinIndex.getComponent(id, w)),
    weights: [0, 1, 2, 3].map(w => skinWeight.getComponent(id, w)),
  });
  const kindAt = (c: Corner) => clothAt(Math.abs(c.p.x), c.p.y, c.n.x, c.n.z, v);

  const outPosition: number[] = [];
  const outNormal: number[] = [];
  const outBones: number[] = [];
  const outWeights: number[] = [];
  const outKind: number[] = [];
  const outTriangle: number[] = [];

  const emit = (c0: Corner, c1: Corner, c2: Corner, t: number, depth: number) => {
    const centre = blend(blend(c0, c1), c2);
    const kinds = [kindAt(c0), kindAt(c1), kindAt(c2), kindAt(centre)];
    // A triangle on a boundary between kinds of cloth is split until the edge is crisp.
    if (depth < MAX_SPLITS && new Set(kinds).size > 1) {
      const m01 = blend(c0, c1);
      const m12 = blend(c1, c2);
      const m20 = blend(c2, c0);
      emit(c0, m01, m20, t, depth + 1);
      emit(m01, c1, m12, t, depth + 1);
      emit(m20, m12, c2, t, depth + 1);
      emit(m01, m12, m20, t, depth + 1);
      return;
    }
    const kind = kinds[3]!;
    if (kind < 0) return;
    for (const c of [c0, c1, c2]) {
      const push = standOff(kind, c.p.y, Math.abs(c.p.x), v);
      outPosition.push(c.p.x + c.n.x * push, c.p.y + c.n.y * push, c.p.z + c.n.z * push);
      outNormal.push(c.n.x, c.n.y, c.n.z);
      for (let w = 0; w < 4; w++) {
        outBones.push(c.bones[w] ?? 0);
        outWeights.push(c.weights[w] ?? 0);
      }
      outKind.push(kind);
      outTriangle.push(t);
    }
  };

  for (let t = 0; t < triangles; t++) {
    const id = (k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    emit(corner(id(0)), corner(id(1)), corner(id(2)), t, 0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(outPosition, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(outNormal, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(outBones, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(outWeights, 4));
  const shell = { geometry, kind: Uint8Array.from(outKind), triangle: Uint32Array.from(outTriangle) };
  shells.set(key, shell);
  return shell;
}

const outfitGeometries = new Map<string, THREE.BufferGeometry>();
const jitter = new THREE.Color();

/** Cheap stable noise in [0, 1) from an integer. */
function noise(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** The shell with this outfit's colours; shared by every actor that wears the same one. */
function outfitGeometry(shell: Shell, key: string, colours: readonly THREE.Color[]): THREE.BufferGeometry {
  const cached = outfitGeometries.get(key);
  if (cached) return cached;
  const geometry = new THREE.BufferGeometry();
  for (const name of Object.keys(shell.geometry.attributes)) {
    geometry.setAttribute(name, shell.geometry.getAttribute(name));
  }
  const normal = shell.geometry.getAttribute('normal');
  const data = new Float32Array(shell.kind.length * 3);
  for (let i = 0; i < shell.kind.length; i++) {
    jitter.copy(colours[shell.kind[i]!]!);
    // Weave: a little brightness variation from triangle to triangle breaks up flat colour;
    // undersides sit in shade, as the folds of cloth do.
    const weave = 0.94 + 0.1 * noise(shell.triangle[i]!);
    const shade = normal.getY(i) < -0.4 ? 0.86 : 1;
    jitter.multiplyScalar(weave * shade);
    data[i * 3] = jitter.r;
    data[i * 3 + 1] = jitter.g;
    data[i * 3 + 2] = jitter.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(data, 3));
  outfitGeometries.set(key, geometry);
  return geometry;
}

const hsl = { h: 0, s: 0, l: 0 };

/** Sportswear is muted but not dull: pull the toy-bright palette colours toward grey. */
function mute(hex: string): THREE.Color {
  const color = new THREE.Color(hex);
  color.getHSL(hsl);
  return color.setHSL(hsl.h, hsl.s * 0.65, Math.min(0.55, hsl.l * 0.95));
}

/** The colour table of an outfit, indexed by kind of cloth. */
function outfitColours(palette: ActorOutfitPalette): THREE.Color[] {
  const top = mute(palette.top);
  const bottom = mute(palette.bottom);
  const trim = new THREE.Color(palette.accent);
  trim.getHSL(hsl);
  trim.setHSL(hsl.h, Math.min(0.75, hsl.s), Math.min(0.62, Math.max(0.42, hsl.l)));
  const colours: THREE.Color[] = [];
  colours[TOP] = top;
  colours[BOTTOM] = bottom;
  colours[SHOE] = new THREE.Color(palette.shoe);
  colours[SOLE] = new THREE.Color('#ecebe6');
  colours[SOCK] = new THREE.Color('#f1f0ec');
  colours[TRIM] = trim;
  colours[WAISTBAND] = bottom.clone().multiplyScalar(0.75);
  colours[STRIPE] = trim;
  return colours;
}

let fabric: THREE.MeshStandardMaterial | undefined;

/**
 * Sportswear fabric: a fine knit weave and soft folds, drawn in the shader from the
 * garment's own bind-pose position, so the pattern deforms with the body and needs no UVs.
 */
function fabricMaterial(): THREE.MeshStandardMaterial {
  if (fabric) return fabric;
  const material = new THREE.MeshStandardMaterial({ name: 'sol-sportswear', vertexColors: true, roughness: 0.88, metalness: 0 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFabricPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFabricPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFabricPos;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          // Knit: ~2.5 mm cells, rows offset like stitches.
          vec3 k = vFabricPos * 1250.0;
          float rows = sin(k.y) * 0.5 + 0.5;
          float cols = sin(k.x * 1.6 + k.z * 1.6 + floor(k.y / 6.2831) * 3.14159) * 0.5 + 0.5;
          float knit = rows * 0.6 + cols * 0.4;
          // Folds: long soft creases running mostly across the garment.
          vec3 f = vFabricPos * vec3(9.0, 26.0, 9.0);
          float fold = sin(f.y + sin(f.x * 1.7) * 1.4 + sin(f.z * 1.3) * 1.2);
          vec3 bump = vec3(cos(k.x * 1.6) * 0.5, cos(k.y) * 0.8, cos(k.z * 1.6) * 0.5) * 0.05
                    + vec3(0.0, cos(f.y + sin(f.x * 1.7) * 1.4) * 0.07, 0.0);
          normal = normalize(normal + bump);
          diffuseColor.rgb *= 0.93 + 0.07 * knit + 0.04 * fold;
        }`,
      );
  };
  fabric = material;
  return material;
}

const skinMaterials = new Map<string, THREE.Material>();
function skinMaterial(source: THREE.Material, key: string, light: THREE.Texture | undefined, tint: THREE.Color): THREE.Material {
  const cached = skinMaterials.get(key);
  if (cached) return cached;
  const material = (source as THREE.MeshStandardMaterial).clone();
  if (light) material.map = light;
  material.color.copy(tint);
  skinMaterials.set(key, material);
  return material;
}

const hairMaterials = new Map<string, THREE.Material>();
function hairMaterial(source: THREE.Material, key: string, tint: THREE.Color, plain: boolean): THREE.Material {
  const cached = hairMaterials.get(key);
  if (cached) return cached;
  const material = (source as THREE.MeshStandardMaterial).clone();
  if (plain) {
    material.map = null;
    material.normalMap = null;
    material.roughness = 0.35;
  }
  material.color.copy(tint);
  hairMaterials.set(key, material);
  return material;
}

const headbands = new Map<string, THREE.Material>();
let headbandGeometry: THREE.BufferGeometry | undefined;
/** A band around the forehead, in the character's rest-pose space (head about (0, 1.695, 0), metres). */
function headband(colour: string): THREE.Mesh {
  if (!headbandGeometry) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      // Ellipse that clears the skull and the hair; slightly lower at the front.
      points.push(new THREE.Vector3(Math.sin(a) * 0.097, 1.738 - Math.cos(a) * 0.012, Math.cos(a) * 0.131 - 0.004));
    }
    headbandGeometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 48, 0.0075, 6, true);
  }
  let material = headbands.get(colour);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 });
    headbands.set(colour, material);
  }
  return new THREE.Mesh(headbandGeometry, material);
}

const FINGER_CURL: Record<string, readonly number[]> = {
  thumb: [0.2, 0.25, 0.2],
  index: [0.4, 0.55, 0.35],
  middle: [0.45, 0.6, 0.4],
  ring: [0.5, 0.65, 0.45],
  pinky: [0.55, 0.7, 0.5],
};
const curl = new THREE.Quaternion();
const curlAxis = new THREE.Vector3(1, 0, 0);

/**
 * Bends the fingers: the rig stands in a T-pose with straight fingers, which reads as a
 * plastic doll. `grip` 1 is a relaxed hand, about 2 a fist (racket, gloves). Call on a
 * clone still in its rest pose.
 */
export function relaxHands(model: THREE.Object3D, grip: number): void {
  for (const side of ['l', 'r']) {
    for (const [finger, angles] of Object.entries(FINGER_CURL)) {
      angles.forEach((angle, i) => {
        const bone = model.getObjectByName(`${finger}_0${i + 1}_${side}`);
        // Rotating about the finger bone's own X axis folds it toward the palm.
        bone?.quaternion.multiply(curl.setFromAxisAngle(curlAxis, Math.min(angle * grip, 1.55)));
      });
    }
  }
}

/**
 * Dresses a cloned character in its rest pose, before it is scaled: skin tone, sportswear
 * shell, hair, headband. Everything created here is cached and shared, so there is nothing
 * to dispose per actor.
 */
export function dressHuman(model: THREE.Object3D, assets: HumanAssets, look: HumanLook): void {
  const { palette, gender, outfit } = look;
  const skin = new THREE.Color(palette.skin);
  skin.getHSL(hsl);
  const light = hsl.l > 0.6;
  // Mostly the texture's own colour, nudged toward the palette skin tone.
  const tint = new THREE.Color('#ffffff').lerp(skin, light ? 0.22 : 0.12);

  let body: THREE.SkinnedMesh | undefined;
  model.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !/^superhero/i.test(mesh.name)) return;
    body = mesh;
    mesh.material = skinMaterial(
      mesh.material as THREE.Material,
      `${gender}|${light}|${tint.getHex()}`,
      light ? assets.skinLight[gender] : undefined,
      tint,
    );
  });
  const bodyMesh = body as THREE.SkinnedMesh | undefined;
  if (!bodyMesh?.parent) return;

  // Sportswear.
  const cut = `${gender}|${outfit.sleeves}|${outfit.crop}|${outfit.leggings}|${outfit.stripe}|${outfit.wristbands}`;
  const shell = buildShell(bodyMesh, outfit, cut);
  const colours = outfitColours(palette);
  const clothes = new THREE.SkinnedMesh(
    outfitGeometry(shell, `${cut}|${palette.top}|${palette.bottom}|${palette.shoe}|${palette.accent}`, colours),
    fabricMaterial(),
  );
  clothes.name = 'sportswear';
  clothes.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
  bodyMesh.parent.add(clothes);

  // Hair and headband: static meshes in rest-pose space, parented to the head bone.
  const head = model.getObjectByName('Head');
  const style = assets.hair[look.hairStyle];
  if (!head || !style) return;
  model.updateMatrixWorld(true);
  const hairTint = look.swimCap
    ? new THREE.Color(palette.hair)
    : new THREE.Color('#ffffff').lerp(new THREE.Color(palette.hair), 0.92);
  const hair = style.clone();
  hair.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = hairMaterial(
      mesh.material as THREE.Material,
      `${look.hairStyle}|${hairTint.getHex()}|${look.swimCap}`,
      hairTint,
      look.swimCap,
    );
  });
  const holder = new THREE.Group();
  holder.name = 'hair';
  holder.matrixAutoUpdate = false;
  holder.matrix.copy(head.matrixWorld.clone().invert());
  holder.add(hair);
  if (outfit.headband && !look.swimCap) holder.add(headband(`#${colours[TRIM]!.getHexString()}`));
  head.add(holder);
}
