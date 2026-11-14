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
 * Bench press on SÖL's adjustable incline bench (26.4° backrest, seat top at y = 0.50 m):
 * pelvis sits flush in the seat crease, spine reclines up the padded backrest, knees bend
 * with sneakers planted flat on the floor, and forearms drive the bar vertically over the upper chest.
 */
export function benchPress(phase: number): PoseOverride {
  const rise = 0.5 - 0.5 * Math.cos(phase); // 0 = bar near upper chest, 1 = controlled lockout
  const flare = lerp(1.68, 0.44, rise);
  const forearm = 0.44 * rise;
  // After the supine turn the character's left (+X at rest) lies toward -X.
  const arm = (side: -1 | 1) => dir(side * Math.sin(flare), Math.cos(flare), -0.18);
  const fore = (side: -1 | 1) => dir(side * Math.sin(forearm), Math.cos(forearm), -0.1);
  return {
    hipsPosition: [0, 0.07, -0.22],
    rotations: {
      Hips: SUPINE,
      Spine: tilt(-0.2),
      Spine1: tilt(-0.15),
      Spine2: tilt(-0.11),
    },
    aims: {
      LeftArm: arm(-1),
      LeftForeArm: fore(-1),
      RightArm: arm(1),
      RightForeArm: fore(1),
      // Thighs splayed out over the seat pad and shins planted cleanly down to the gym floor.
      LeftUpLeg: dir(-0.32, -0.13, -0.94),
      LeftLeg: dir(-0.1, -0.97, -0.22),
      RightUpLeg: dir(0.32, -0.13, -0.94),
      RightLeg: dir(0.1, -0.97, -0.22),
    },
    footTurn: FEET_AWAY,
  };
}
