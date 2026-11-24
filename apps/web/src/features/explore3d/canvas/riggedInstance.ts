import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  isActorLevelVisible,
  type HumanPoseAngles,
  type LiveActorDefinition,
} from '../renderers/actors/liveActorsConfig';
import {
  HAIR_STYLES,
  dressHuman,
  relaxHands,
  type Gender,
  type HairStyleName,
  type HumanAssets,
  type OutfitVariant,
  type WearMode,
} from '../renderers/actors/humanAppearance';
import {
  applyRetargetPose,
  createRetargetRig,
  type RetargetRig,
} from '../renderers/actors/humanRetarget';
import {
  HUMAN_HAND_BONES,
  HUMAN_HEIGHT,
  computeRiggedPlacement,
  getActorPhase,
  getRiggedMotion,
  hashString,
  type RiggedMotion,
} from '../renderers/actors/riggedActors';
import { buildHandProp } from '../renderers/actors/riggedHandProps';
import type { LevelCode, SceneDoc } from '../scene/schema';
import type { LevelMode } from '../state/exploreStore';

/** Raycast rỗng để nhân vật không bắt sự kiện chuột. */
const NOOP_RAYCAST = () => null;
const CLIP_PELVIS_REST_Z = 0.9167;

const WALK_FLOOR_INDEX: Record<LevelCode, number> = {
  B1: 0,
  L1: 1,
  OUT: 1,
  L2: 2,
  RF: 3,
};

/**
 * Tầng có kề tầng đang đi bộ không (loại bỏ tầng xa khi đi bộ, giữ lại cầu thang và khuôn viên).
 *
 * Culls far non-adjacent floor props/actors during WalkView while keeping stairs & campus visible.
 */
export function isWalkFloorAdjacent(
  targetCode: LevelCode,
  focusLevel: LevelCode | 'ALL',
): boolean {
  if (focusLevel === 'ALL') return true;
  if (focusLevel === 'B1') return targetCode === 'B1' || targetCode === 'L1';
  if (targetCode === 'OUT') return true;
  return Math.abs(WALK_FLOOR_INDEX[targetCode] - WALK_FLOOR_INDEX[focusLevel]) <= 1;
}

/** Thanh tạ đang cầm: thanh, đầu trái và đầu phải. */
interface HeldBarbell {
  bar: THREE.Object3D;
  left: THREE.Object3D;
  right: THREE.Object3D;
}

/** Trạng thái kết hợp nhiều hoạt ảnh: các hành động, hành động đang chạy, thời gian và chu kỳ. */
interface ComboState {
  actions: THREE.AnimationAction[];
  activeIndex: number;
  elapsed: number;
  interval: number;
}

/** Một nhân vật có xương đã dựng: định nghĩa, chuyển động, nhóm gốc, các mesh bóng, tạ đang cầm và hoạt ảnh. */
export interface RiggedInstance {
  def: LiveActorDefinition;
  motion: RiggedMotion;
  holder: THREE.Group;
  /** Meshes cached once at creation so per-frame sun shadow toggling avoids tree traversal. */
  shadowMeshes: THREE.Mesh[];
  /** Clip playback (motion capture or generated clips). */
  mixer?: THREE.AnimationMixer;
  action?: THREE.AnimationAction;
  combo?: ComboState;
  /** Pose-driven skeleton. */
  rig?: RetargetRig;
  barbell?: HeldBarbell;
}

/** Tài nguyên dựng nhân vật: mô hình người và các clip hoạt ảnh. */
export interface RiggedAssets {
  humans: HumanAssets;
  clips: readonly THREE.AnimationClip[];
}

/**
 * Đưa texture da JPEG về quy ước glTF để dùng trong vật liệu thân.
 *
 * Makes a loaded JPEG follow the glTF texture convention, so it drops into the body material.
 */
export function configureSkinTexture(texture: THREE.Texture): THREE.Texture {
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const retargetedClips = new Map<string, THREE.AnimationClip>();

/**
 * Bỏ các track dịch/tỉ lệ chân tay của clip mannequin để nam và nữ giữ đúng tỉ lệ xương, đồng thời co tịnh tiến
 * gốc/xương chậu theo chiều dài chân thật.
 *
 * Strips neutral-mannequin limb translation/scale tracks from UAL clips so female and male
 * skeletons preserve 100% of their anatomical bone proportions, while scaling root/pelvis
 * translation to match the character's true leg length.
 */
export function prepareCharacterClip(
  clip: THREE.AnimationClip,
  model: THREE.Object3D,
  gender: Gender,
): THREE.AnimationClip {
  const key = `${gender}|${clip.uuid}|${clip.name}`;
  const cached = retargetedClips.get(key);
  if (cached) return cached;

  const pelvis = model.getObjectByName('pelvis');
  const pelvisScale = pelvis && pelvis.position.z > 0.1 ? pelvis.position.z / CLIP_PELVIS_REST_Z : 1;

  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    if (track.name.endsWith('.scale')) continue;
    if (track.name.endsWith('.position')) {
      const boneName = track.name.slice(0, -'.position'.length);
      if (boneName !== 'pelvis' && boneName !== 'root') continue;
      const scaledValues = Float32Array.from(track.values, v => v * pelvisScale);
      tracks.push(new THREE.VectorKeyframeTrack(track.name, Float32Array.from(track.times), scaledValues));
      continue;
    }
    tracks.push(track);
  }

  const adapted = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  retargetedClips.set(key, adapted);
  return adapted;
}

/** Chọn kiểu trang phục theo hoạt động (bơi, đi chân đất, nhân viên hoặc thể thao). */
function wearForActor(def: LiveActorDefinition): WearMode {
  if (def.activity === 'swim-freestyle') return 'swim';
  if (def.activity === 'yoga-flow' || def.activity === 'inbody-scan') return 'barefoot';
  if (
    def.activity === 'pt-coach-tablet' ||
    def.activity === 'receptionist-greet' ||
    def.id === 'actor-b1-pool-coach'
  ) {
    return 'staff';
  }
  return 'athletic';
}

/**
 * Kiểu cắt và chi tiết trang phục thể thao của một nhân vật, ổn định theo từng nhân vật và phù hợp môn tập.
 *
 * The cut and details of an actor's sportswear, stable per actor and tailored to the sport.
 */
function outfitFor(def: LiveActorDefinition, gender: Gender, wear: WearMode): OutfitVariant {
  const bits = hashString(`${def.id}:outfit`);
  // Lấy một bit ổn định từ mã băm của nhân vật.
  const bit = (n: number) => ((bits >>> n) & 1) === 1;
  if (wear === 'staff') {
    return {
      sleeves: true,
      crop: false,
      leggings: false,
      stripe: true,
      wristbands: false,
      headband: false,
    };
  }
  if (def.activity === 'tennis-player') {
    return {
      sleeves: true,
      crop: false,
      leggings: false,
      stripe: true,
      wristbands: true,
      headband: bit(2),
    };
  }
  return {
    sleeves: !bit(0),
    crop: gender === 'female' && bit(1) && bit(2),
    leggings: gender === 'female' && bit(3),
    stripe: bit(4),
    wristbands: bit(5) && bit(6),
    headband: bit(7) && bit(8),
  };
}

const heights = new WeakMap<THREE.Object3D, number>();
/**
 * Tỉ lệ để nhân vật cao đúng HUMAN_HEIGHT (có cache theo mô hình).
 *
 * Scale that makes the character stand `HUMAN_HEIGHT` tall.
 */
function baseScale(character: THREE.Object3D): number {
  let height = heights.get(character);
  if (height === undefined) {
    height = new THREE.Box3().setFromObject(character).getSize(new THREE.Vector3()).y;
    heights.set(character, height);
  }
  return height > 1e-4 ? HUMAN_HEIGHT / height : 1;
}

const barStart = new THREE.Vector3();
const barEnd = new THREE.Vector3();
const barDir = new THREE.Vector3();
const X_AXIS = new THREE.Vector3(1, 0, 0);

/**
 * Dựng thanh tạ Olympic có đĩa cao su dọc theo trục +X, đặt tâm ở gốc.
 *
 * Olympic bar with bumper plates, built along +X and centred on the origin.
 */
function buildHeldBarbell(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'held-barbell';
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.2, metalness: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#111113', roughness: 0.88, metalness: 0 });
  // Thêm một chi tiết (ống thép hoặc đĩa) xoay theo trục X tại vị trí x.
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number) => {
    geometry.rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = x;
    mesh.castShadow = true;
    mesh.raycast = NOOP_RAYCAST;
    group.add(mesh);
  };
  add(new THREE.CylinderGeometry(0.014, 0.014, 2.0, 10), steel, 0);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.026, 0.026, 0.38, 12), steel, s * 0.82);
    add(new THREE.CylinderGeometry(0.225, 0.225, 0.055, 24), rubber, s * 0.72);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.045, 24), rubber, s * 0.78);
  }
  return group;
}

/**
 * Giữ thanh tạ ở giữa hai bàn tay, dọc theo đường nối hai tay.
 *
 * Keeps a held bar centred between the two hands, along the line joining them.
 */
function updateHeldBarbell(holder: THREE.Object3D, held: HeldBarbell): void {
  holder.updateMatrixWorld(true);
  held.left.getWorldPosition(barStart);
  held.right.getWorldPosition(barEnd);
  holder.worldToLocal(barStart);
  holder.worldToLocal(barEnd);
  held.bar.position.copy(barStart).add(barEnd).multiplyScalar(0.5);
  barDir.subVectors(barEnd, barStart);
  if (barDir.lengthSq() > 1e-8) held.bar.quaternion.setFromUnitVectors(X_AXIS, barDir.normalize());
}

/**
 * Tạo nhân vật có xương cho một hoạt động; không có người hoặc thiếu clip thì trả null.
 *
 * A person for `def`, or null when the activity has no person or its clip is missing.
 */
export function createRiggedInstance(def: LiveActorDefinition, assets: RiggedAssets): RiggedInstance | null {
  const motion = getRiggedMotion(def.activity);
  if (!motion) return null;

  let rawClip: THREE.AnimationClip | undefined;
  if (motion.kind === 'clip') {
    const clipName = typeof motion.spec.clip === 'function' ? motion.spec.clip(def.id) : motion.spec.clip;
    rawClip = assets.clips.find(a => a.name === clipName);
    if (!rawClip) return null;
  }

  const hash = hashString(def.id);
  const gender: Gender = hash % 2 === 0 ? 'male' : 'female';
  const model = cloneSkinned(assets.humans.characters[gender]) as THREE.Object3D;
  const isBoxer = def.activity === 'boxing-spar' || def.activity === 'heavy-bag-boxer';
  const closedGrip =
    isBoxer ||
    def.activity === 'upright-bike' ||
    def.activity === 'elliptical-stride' ||
    def.activity === 'inbody-scan' ||
    (motion.kind === 'pose' &&
      (motion.spec.handProp?.kind === 'racket' ||
        Boolean(motion.spec.dumbbellsInHands) ||
        Boolean(motion.spec.barbellInHands)));
  const swimmer = def.activity === 'swim-freestyle';
  const wear = wearForActor(def);
  const scale = baseScale(assets.humans.characters[gender]) * (0.95 + (hash % 11) * 0.01);

  // All of this happens while the clone is still in its rest pose and unscaled.
  relaxHands(model, closedGrip ? 2 : 1);
  const rig = motion.kind === 'pose' ? createRetargetRig(model, scale) : null;
  if (motion.kind === 'pose' && !rig) return null;
  const styles = HAIR_STYLES[gender];
  const hairStyle: HairStyleName = swimmer
    ? gender === 'male'
      ? 'hair-buzzed'
      : 'hair-buzzedfemale'
    : styles[(hash >>> 5) % styles.length]!;
  dressHuman(model, assets.humans, {
    gender,
    palette: def.palette,
    hairStyle,
    outfit: outfitFor(def, gender, wear),
    swimCap: swimmer,
    wear,
    beard: gender === 'male' && !swimmer && (hash >>> 9) % 3 === 0,
  });

  model.scale.setScalar(scale);
  const shadowMeshes: THREE.Mesh[] = [];
  model.traverse(object => {
    object.frustumCulled = false;
    object.raycast = NOOP_RAYCAST;
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      shadowMeshes.push(mesh);
    }
  });

  const holder = new THREE.Group();
  holder.name = `rigged-${def.id}`;
  holder.add(model);

  const instance: RiggedInstance = { def, motion, holder, shadowMeshes };

  if (motion.kind === 'clip' && rawClip) {
    const mixer = new THREE.AnimationMixer(model);
    const clip = prepareCharacterClip(rawClip, model, gender);
    const baseTimeScale = Math.max(0.2, def.speed * motion.spec.timeScale);
    const action = mixer.clipAction(clip);
    action.timeScale = baseTimeScale;
    action.play();
    action.time = (def.phaseOffset / (Math.PI * 2)) * clip.duration;
    instance.mixer = mixer;
    instance.action = action;

    if (motion.spec.comboClips && motion.spec.comboClips.length > 1) {
      const uniqueClips = Array.from(new Set(motion.spec.comboClips))
        .map(name => assets.clips.find(a => a.name === name))
        .filter((c): c is THREE.AnimationClip => Boolean(c))
        .map(c => prepareCharacterClip(c, model, gender));
      if (uniqueClips.length > 1) {
        const actions = uniqueClips.map(c => {
          const act = mixer.clipAction(c);
          act.timeScale = baseTimeScale;
          return act;
        });
        const startIdx = Math.max(
          0,
          uniqueClips.findIndex(c => c.name === clip.name),
        );
        if (!uniqueClips.some(c => c.name === clip.name)) {
          action.stop();
        }
        for (let i = 0; i < actions.length; i++) {
          if (i === startIdx) {
            actions[i]!.play();
            actions[i]!.time = (def.phaseOffset / (Math.PI * 2)) * uniqueClips[i]!.duration;
          } else {
            actions[i]!.stop();
          }
        }
        instance.action = actions[startIdx];
        instance.combo = {
          actions,
          activeIndex: startIdx,
          elapsed: (hash % 7) * 0.19,
          interval: 1.55 + (hash % 5) * 0.18,
        };
      }
    }

    if (motion.spec.glovesInHands) {
      for (const handName of HUMAN_HAND_BONES) {
        const palmOffset = handName === 'hand_l' ? 0.016 : -0.016;
        const glove = buildHandProp(
          {
            kind: 'boxing-glove',
            bone: handName,
            position: [palmOffset, 0.085, 0.005],
            rotation: [0, 0, 0],
            size: 1.0,
            color: def.palette.accent,
          },
          scale,
        );
        model.getObjectByName(handName)?.add(glove);
      }
    }
  } else if (motion.kind === 'pose' && rig) {
    instance.rig = rig;
    const { handProp, dumbbellsInHands, barbellInHands } = motion.spec;
    if (handProp) model.getObjectByName(handProp.bone)?.add(buildHandProp(handProp, scale));
    if (dumbbellsInHands) {
      for (const handName of HUMAN_HAND_BONES) {
        // Palm normal is +X on `hand_l` and -X on `hand_r`; grip bar runs along local Z across fingers.
        const palmX = handName === 'hand_l' ? 0.032 : -0.032;
        const dumbbell = buildHandProp(
          { kind: 'dumbbell', bone: handName, position: [palmX, 0.075, 0.004], rotation: [0, 0, 0], size: 1 },
          scale,
        );
        model.getObjectByName(handName)?.add(dumbbell);
      }
    }
    if (barbellInHands) {
      const left = model.getObjectByName(HUMAN_HAND_BONES[0]);
      const right = model.getObjectByName(HUMAN_HAND_BONES[1]);
      if (left && right) {
        const bar = buildHeldBarbell();
        holder.add(bar);
        bar.traverse(obj => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) shadowMeshes.push(mesh);
        });
        instance.barbell = { bar, left, right };
      }
    }
  }
  return instance;
}

/** Đặt nhân vật vào cảnh theo hoạt động, tầng, chế độ tầng, tầng đang xem và thời gian. */
export function placeInstance(
  { def, holder, shadowMeshes }: RiggedInstance,
  scene: SceneDoc,
  levelMode: LevelMode,
  focusLevel: LevelCode | 'ALL',
  timeSec: number,
  walkMode = false,
): HumanPoseAngles {
  const placement = computeRiggedPlacement(def, scene, levelMode, timeSec);
  holder.position.set(placement.position[0], placement.position[1], placement.position[2]);
  holder.rotation.set(0, placement.yaw, 0);
  const hiddenUnderground =
    !walkMode && levelMode === 'stacked' && focusLevel === 'ALL' && def.level === 'B1';
  const visible =
    !hiddenUnderground &&
    isActorLevelVisible(def.level, levelMode, focusLevel) &&
    (!walkMode || isWalkFloorAdjacent(def.level, focusLevel));
  holder.visible = visible;
  const castsSunShadow =
    visible && !walkMode && (levelMode !== 'stacked' || def.level === 'OUT' || def.level === 'RF');
  for (let i = 0; i < shadowMeshes.length; i++) {
    const mesh = shadowMeshes[i]!;
    if (mesh.castShadow !== castsSunShadow) mesh.castShadow = castsSunShadow;
  }
  return placement.pose;
}

/**
 * Cập nhật hoạt ảnh theo thời gian (clip) hoặc đặt tư thế xương theo góc của hoạt động.
 *
 * Advances the clip, or poses the skeleton from the activity's angles.
 */
export function stepInstance(
  instance: RiggedInstance,
  deltaSec: number,
  pose: HumanPoseAngles,
  timeSec: number,
): void {
  const { def, motion, mixer, action, combo, rig } = instance;
  if (motion.kind === 'clip') {
    if (!mixer) return;
    if (def.activity === 'walking-patrol' && action) {
      const walkCycle = (timeSec * def.speed * 0.14 + def.phaseOffset * 0.2) % 2;
      const rawU = walkCycle < 1 ? walkCycle : 2 - walkCycle;
      // Match stride cadence to instantaneous cosine-eased patrol speed so feet never moonwalk at endpoints.
      const speedFactor = Math.max(0.32, Math.sin(rawU * Math.PI) * 1.15);
      action.timeScale = Math.max(0.25, def.speed * motion.spec.timeScale * speedFactor);
    }
    if (combo && deltaSec > 0) {
      combo.elapsed += deltaSec;
      if (combo.elapsed >= combo.interval) {
        combo.elapsed = 0;
        const prev = combo.actions[combo.activeIndex]!;
        combo.activeIndex = (combo.activeIndex + 1) % combo.actions.length;
        const next = combo.actions[combo.activeIndex]!;
        next.reset().play();
        prev.crossFadeTo(next, 0.16, false);
        instance.action = next;
      }
    }
    mixer.update(deltaSec);
  } else if (rig) {
    const phase = getActorPhase(def, timeSec);
    const override = motion.spec.override?.(phase);
    const roll =
      typeof motion.spec.forearmRoll === 'function'
        ? motion.spec.forearmRoll(phase, def, timeSec)
        : motion.spec.forearmRoll;
    applyRetargetPose(rig, pose, motion.spec, roll, timeSec, override);
  }
  if (instance.barbell) updateHeldBarbell(instance.holder, instance.barbell);
}

/** Giải phóng mixer và tạ của nhân vật (thân, quần áo, tóc dùng chung nên giữ cache). */
export function disposeInstance(instance: RiggedInstance): void {
  // Body, clothes and hair geometry and materials are shared between actors and stay cached.
  const { mixer, holder, barbell } = instance;
  mixer?.stopAllAction();
  const root = holder.children[0];
  if (mixer && root) mixer.uncacheRoot(root);
  instance.mixer = undefined;
  instance.action = undefined;
  instance.combo = undefined;
  barbell?.bar.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
}
