import * as THREE from 'three';
import type { ExploreTheme } from '../renderers/materials';

type RGB = [number, number, number];

/**
 * Time-of-day art direction. Light theme = golden hour, dark theme = dusk /
 * blue hour with practical lights on. All colours are linear HDR.
 */
export interface Atmosphere {
  /** Sun (key light) position; direction = normalize(position). */
  sunPosition: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  /** Practical (street / flood) lights are lit. */
  practicals: boolean;
  /** Strength of the baked sky as ambient light (scene.environmentIntensity). */
  skyLight: number;
  /** Colour of the terrain that runs from the campus to the horizon. */
  terrain: string;
  sky: {
    zenith: RGB;
    horizon: RGB;
    horizonAway: RGB;
    midSun: RGB;
    midAway: RGB;
    ground: RGB;
    sun: RGB;
    cloudLight: RGB;
    cloudDark: RGB;
    cloudAmount: number;
  };
  haze: {
    density: number;
    falloff: number;
    max: number;
    color: RGB;
    sunColor: RGB;
  };
}

const GOLDEN_HOUR: Atmosphere = {
  sunPosition: [-26, 23, 40],
  sunColor: '#ffcf9c',
  sunIntensity: 5.6,
  practicals: false,
  skyLight: 0.5,
  terrain: '#59603f',
  sky: {
    zenith: [0.11, 0.24, 0.52],
    horizon: [1.28, 0.8, 0.44],
    horizonAway: [0.44, 0.55, 0.7],
    midSun: [0.88, 0.64, 0.46],
    midAway: [0.3, 0.45, 0.68],
    ground: [0.5, 0.58, 0.7],
    sun: [1.0, 0.78, 0.5],
    cloudLight: [0.92, 0.82, 0.74],
    cloudDark: [0.32, 0.35, 0.44],
    cloudAmount: 0.58,
  },
  haze: {
    density: 0.0021,
    falloff: 0.06,
    max: 0.94,
    color: [0.5, 0.58, 0.7],
    sunColor: [1.1, 0.74, 0.44],
  },
};

const DUSK: Atmosphere = {
  sunPosition: [-26, 11, 40],
  sunColor: '#ff9d5c',
  sunIntensity: 3.4,
  practicals: true,
  skyLight: 1.15,
  terrain: '#161b14',
  sky: {
    zenith: [0.032, 0.062, 0.165],
    horizon: [1.08, 0.46, 0.18],
    horizonAway: [0.075, 0.115, 0.22],
    midSun: [0.48, 0.27, 0.24],
    midAway: [0.058, 0.098, 0.205],
    ground: [0.06, 0.085, 0.14],
    sun: [1.0, 0.58, 0.28],
    cloudLight: [0.22, 0.25, 0.36],
    cloudDark: [0.048, 0.068, 0.125],
    cloudAmount: 0.68,
  },
  haze: {
    density: 0.0046,
    falloff: 0.06,
    max: 0.94,
    color: [0.06, 0.085, 0.14],
    sunColor: [0.7, 0.3, 0.12],
  },
};

export function getAtmosphere(theme: ExploreTheme): Atmosphere {
  return theme === 'light' ? GOLDEN_HOUR : DUSK;
}

export function getSunDirection(theme: ExploreTheme, target = new THREE.Vector3()): THREE.Vector3 {
  const [x, y, z] = getAtmosphere(theme).sunPosition;
  return target.set(x, y, z).normalize();
}
