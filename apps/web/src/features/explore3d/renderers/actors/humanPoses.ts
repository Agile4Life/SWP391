import * as THREE from 'three';
import type { PoseOverride } from './humanRetarget';

/**
 * Poses the pitch/splay angles of `solveHumanPose` cannot express. Frame: +Y up, +Z the
 * way the character faces at yaw 0, +X the character's left in the rest pose.
 */

const HALF_PI = Math.PI / 2;

/** Lying on the back, head toward +Z, face up: Ry(180°) after Rx(-90°). */
const SUPINE = new THREE.Quaternion().setFromEuler(new THREE.Euler(-HALF_PI, Math.PI, 0, 'YXZ'));
/** Feet flat on the floor with the toes pointing away from the head. */
const FEET_AWAY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dir = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
const tilt = (x: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), x);

/**
 * Bench press on an incline bench (about 21°): pelvis at the seat/backrest join, the spine
 * bending up the backrest, knees bent with the feet on the floor, forearms vertical while
 * the upper arms flare out and come back in. The bar is drawn between the hands.
 * `phase` is the actor's phase; the bar rises and falls once per 2π.
 */
export function benchPress(phase: number): PoseOverride {
  const rise = 0.5 - 0.5 * Math.cos(phase); // 0 = bar on the chest, 1 = arms locked out
  // Wide grip: at the chest the elbows flare and the forearms are vertical; at lockout
  // the whole arm leans out so the hands stay the same distance apart.
  const flare = lerp(1.75, 0.45, rise);
  // Absolute lean of the forearm from vertical: none at the chest, as much as the arm at lockout.
  const forearm = 0.45 * rise;
  // After the supine turn the character's left (+X at rest) lies toward -X.
  const arm = (side: -1 | 1) => dir(side * Math.sin(flare), Math.cos(flare), -0.2);
  const fore = (side: -1 | 1) => dir(side * Math.sin(forearm), Math.cos(forearm), -0.12);
  return {
    hipsPosition: [0, 0.14, -0.12],
    rotations: {
      Hips: SUPINE,
      Spine: tilt(-0.16),
      Spine1: tilt(-0.12),
      Spine2: tilt(-0.08),
    },
    aims: {
      LeftArm: arm(-1),
      LeftForeArm: fore(-1),
      RightArm: arm(1),
      RightForeArm: fore(1),
      // Thighs out and slightly down, shins down to the floor.
      LeftUpLeg: dir(-0.3, -0.15, -1),
      LeftLeg: dir(-0.15, -1, -0.05),
      RightUpLeg: dir(0.3, -0.15, -1),
      RightLeg: dir(0.15, -1, -0.05),
    },
    footTurn: FEET_AWAY,
  };
}
