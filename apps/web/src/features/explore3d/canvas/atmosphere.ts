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
    zenith: [0.1, 0.21, 0.46],
    horizon: [1.25, 0.78, 0.42],
    horizonAway: [0.42, 0.52, 0.66],
    midSun: [0.85, 0.62, 0.44],
    midAway: [0.28, 0.42, 0.64],
    ground: [0.5, 0.58, 0.7],
    sun: [1.0, 0.78, 0.5],
    cloudLight: [0.8, 0.72, 0.66],
    cloudDark: [0.3, 0.32, 0.4],
    cloudAmount: 0.62,
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
    zenith: [0.012, 0.024, 0.062],
    horizon: [1.0, 0.42, 0.15],
    horizonAway: [0.05, 0.078, 0.14],
    midSun: [0.44, 0.24, 0.2],
    midAway: [0.034, 0.06, 0.125],
    ground: [0.06, 0.085, 0.14],
    sun: [1.0, 0.58, 0.28],
    cloudLight: [0.1, 0.12, 0.18],
    cloudDark: [0.018, 0.026, 0.045],
    cloudAmount: 0.9,
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
