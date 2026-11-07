import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { WallNode, ZoneNode } from '../scene/schema';

export type ExploreTheme = 'dark' | 'light';
export type FloorMaterialKind = ZoneNode['floorMaterial'];
export type WallMaterialKind = WallNode['material'];

export interface ExploreThemePalette {
  theme: ExploreTheme;
  canvasBg: string;
  fogColor: string;
  surfacePrimary: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  accentSalmon: string;
  accentSalmonHover: string;
  textPrimary: string;
  skyColor: string;
  groundColor: string;
  floors: Record<FloorMaterialKind, string>;
  walls: {
    concrete: string;
    glass: string;
    'accent-salmon': string;
    'wood-slat': string;
    exteriorConcrete: string;
    cutawayCap: string;
  };
  slab: {
    base: string;
    edge: string;
    plaza: string;
    grid: string;
    walkway: string;
    zoneBorder: string;
  };
  items: {
    equipmentFrame: string;
    equipmentVipFrame: string;
    salmonAccent: string;
    upholstery: string;
    chrome: string;
    statusMaintenance: string;
    statusBroken: string;
    statusRetired: string;
  };
}

export const DARK_PALETTE: ExploreThemePalette = {
  theme: 'dark',
  canvasBg: '#161618',
  fogColor: '#161618',
  surfacePrimary: '#202020',
  surfaceSecondary: '#2b2b2b',
  surfaceElevated: '#303030',
  accentSalmon: '#ce9180',
  accentSalmonHover: '#e1aa98',
  textPrimary: '#faf9f6',
  skyColor: '#ffe8de',
  groundColor: '#3d3735',
  floors: {
    'rubber-dark': '#2d2d33',
    hardwood: '#a17455',
    turf: '#335a49',
    'tile-stone': '#3f3d44',
    water: '#2b6d96',
    'acrylic-court': '#2e6954',
    'concrete-polished': '#38383f',
    tatami: '#af976f',
  },
  walls: {
    concrete: '#403e44',
    glass: '#d9edf7',
    'accent-salmon': '#ce9180',
    'wood-slat': '#a67858',
    exteriorConcrete: '#36343a',
    cutawayCap: '#ce9180',
  },
  slab: {
    base: '#242428',
    edge: '#ce9180',
    plaza: '#1e1e22',
    grid: '#2f2f35',
    walkway: '#ce9180',
    zoneBorder: '#4a4850',
  },
  items: {
    equipmentFrame: '#36363e',
    equipmentVipFrame: '#24242a',
    salmonAccent: '#ce9180',
    upholstery: '#434148',
    chrome: '#e4e8ec',
    statusMaintenance: '#e0a050',
    statusBroken: '#6b6b6b',
    statusRetired: '#4a4a4e',
  },
};

export const LIGHT_PALETTE: ExploreThemePalette = {
  theme: 'light',
  canvasBg: '#eae5dd',
  fogColor: '#eae5dd',
  surfacePrimary: '#f5f2ed',
  surfaceSecondary: '#e7e1d8',
  surfaceElevated: '#f0ece5',
  accentSalmon: '#c47c6a',
  accentSalmonHover: '#d48d7b',
  textPrimary: '#202020',
  skyColor: '#fff8f3',
  groundColor: '#d8d2c9',
  floors: {
    'rubber-dark': '#3a3a3d',
    hardwood: '#b98d6c',
    turf: '#3f6e59',
    'tile-stone': '#ddd6cc',
    water: '#3a7ca5',
    'acrylic-court': '#3d7a5a',
    'concrete-polished': '#e7e1d8',
    tatami: '#c3ad84',
  },
  walls: {
    concrete: '#f0ece5',
    glass: '#b9d6e6',
    'accent-salmon': '#c47c6a',
    'wood-slat': '#ad8162',
    exteriorConcrete: '#e7e1d8',
    cutawayCap: '#c47c6a',
  },
  slab: {
    base: '#f5f2ed',
    edge: '#c47c6a',
    plaza: '#e2dcd2',
    grid: '#cfc7bc',
    walkway: '#c47c6a',
    zoneBorder: '#c9c1b6',
  },
  items: {
    equipmentFrame: '#2f2f33',
    equipmentVipFrame: '#202020',
    salmonAccent: '#c47c6a',
    upholstery: '#484542',
    chrome: '#d6d9dc',
    statusMaintenance: '#e0a050',
    statusBroken: '#6b6b6b',
    statusRetired: '#8a8680',
  },
};

export function getExploreThemePalette(theme: ExploreTheme): ExploreThemePalette {
  return theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}

export function detectDocumentTheme(): ExploreTheme {
  if (typeof document === 'undefined') {
    return 'dark';
  }
  const root = document.documentElement;
  const attr = root.getAttribute('data-theme') ?? document.body?.getAttribute('data-theme');
  if (attr === 'light') {
    return 'light';
  }
  return 'dark';
}

export class MaterialRegistry {
  private currentTheme: ExploreTheme;

  public readonly floors: Record<FloorMaterialKind, THREE.MeshStandardMaterial>;
  public readonly walls: {
    concrete: THREE.MeshStandardMaterial;
    interior: THREE.MeshStandardMaterial;
    glass: THREE.MeshStandardMaterial;
    'accent-salmon': THREE.MeshStandardMaterial;
    'wood-slat': THREE.MeshStandardMaterial;
    exteriorConcrete: THREE.MeshStandardMaterial;
    exterior: THREE.MeshStandardMaterial;
    cutawayCap: THREE.MeshBasicMaterial;
    cutCap: THREE.MeshBasicMaterial;
  };
  public readonly slabBase: THREE.MeshStandardMaterial;
  public readonly slabEdge: THREE.MeshStandardMaterial;
  public readonly zoneBorder: THREE.MeshBasicMaterial;
  public readonly zoneSelectedBorder: THREE.MeshBasicMaterial;
  public readonly plazaGround: THREE.MeshStandardMaterial;
  public readonly plazaGrid: THREE.LineBasicMaterial;
  public readonly plazaWalkway: THREE.MeshStandardMaterial;
  public readonly vertexColored: THREE.MeshStandardMaterial;
  public readonly items: {
    base: THREE.MeshStandardMaterial;
    selected: THREE.MeshStandardMaterial;
    hovered: THREE.MeshStandardMaterial;
    equipmentFrame: THREE.MeshStandardMaterial;
    equipmentVipFrame: THREE.MeshStandardMaterial;
    salmonAccent: THREE.MeshStandardMaterial;
    upholstery: THREE.MeshStandardMaterial;
    chrome: THREE.MeshStandardMaterial;
    statusMaintenance: THREE.MeshStandardMaterial;
    statusBroken: THREE.MeshStandardMaterial;
    statusRetired: THREE.MeshStandardMaterial;
  };

  constructor(initialTheme: ExploreTheme = detectDocumentTheme()) {
    this.currentTheme = initialTheme;
    const p = getExploreThemePalette(initialTheme);

    this.floors = {
      'rubber-dark': new THREE.MeshStandardMaterial({
        name: 'floor-rubber-dark',
        color: p.floors['rubber-dark'],
        roughness: 0.72,
        metalness: 0.1,
        envMapIntensity: 1.15,
      }),
      hardwood: new THREE.MeshStandardMaterial({
        name: 'floor-hardwood',
        color: p.floors.hardwood,
        roughness: 0.44,
        metalness: 0.14,
        envMapIntensity: 1.2,
      }),
      turf: new THREE.MeshStandardMaterial({
        name: 'floor-turf',
        color: p.floors.turf,
        roughness: 0.78,
        metalness: 0.06,
        envMapIntensity: 1.1,
      }),
      'tile-stone': new THREE.MeshStandardMaterial({
        name: 'floor-tile-stone',
        color: p.floors['tile-stone'],
        roughness: 0.38,
        metalness: 0.18,
        envMapIntensity: 1.25,
      }),
      water: new THREE.MeshStandardMaterial({
        name: 'floor-water',
        color: p.floors.water,
        roughness: 0.14,
        metalness: 0.22,
        envMapIntensity: 1.35,
      }),
      'acrylic-court': new THREE.MeshStandardMaterial({
        name: 'floor-acrylic-court',
        color: p.floors['acrylic-court'],
        roughness: 0.5,
        metalness: 0.1,
        envMapIntensity: 1.15,
      }),
      'concrete-polished': new THREE.MeshStandardMaterial({
        name: 'floor-concrete-polished',
        color: p.floors['concrete-polished'],
        roughness: 0.36,
        metalness: 0.2,
        envMapIntensity: 1.25,
      }),
      tatami: new THREE.MeshStandardMaterial({
        name: 'floor-tatami',
        color: p.floors.tatami,
        roughness: 0.66,
        metalness: 0.08,
        envMapIntensity: 1.12,
      }),
    };

    // Never use MeshPhysicalMaterial with transmission — use MeshStandardMaterial for glass
    const wallConcrete = new THREE.MeshStandardMaterial({
      name: 'wall-concrete',
      color: p.walls.concrete,
      roughness: 0.58,
      metalness: 0.12,
      envMapIntensity: 1.15,
    });
    const wallExteriorConcrete = new THREE.MeshStandardMaterial({
      name: 'wall-exterior-concrete',
      color: p.walls.exteriorConcrete,
      roughness: 0.62,
      metalness: 0.14,
      envMapIntensity: 1.15,
    });
    const wallCutawayCap = new THREE.MeshBasicMaterial({
      name: 'wall-cutaway-cap',
      color: p.walls.cutawayCap,
    });

    this.walls = {
      concrete: wallConcrete,
      interior: wallConcrete,
      glass: new THREE.MeshStandardMaterial({
        name: 'wall-glass',
        color: p.walls.glass,
        roughness: 0.1,
        metalness: 0.18,
        envMapIntensity: 1.4,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      'accent-salmon': new THREE.MeshStandardMaterial({
        name: 'wall-accent-salmon',
        color: p.walls['accent-salmon'],
        emissive: p.walls['accent-salmon'],
        emissiveIntensity: 0.08,
        roughness: 0.38,
        metalness: 0.22,
        envMapIntensity: 1.25,
      }),
      'wood-slat': new THREE.MeshStandardMaterial({
        name: 'wall-wood-slat',
        color: p.walls['wood-slat'],
        roughness: 0.48,
        metalness: 0.12,
        envMapIntensity: 1.2,
      }),
      exteriorConcrete: wallExteriorConcrete,
      exterior: wallExteriorConcrete,
      cutawayCap: wallCutawayCap,
      cutCap: wallCutawayCap,
    };

    this.slabBase = new THREE.MeshStandardMaterial({
      name: 'slab-base',
      color: p.slab.base,
      roughness: 0.64,
      metalness: 0.12,
      envMapIntensity: 1.15,
    });

    this.slabEdge = new THREE.MeshStandardMaterial({
      name: 'slab-edge',
      color: p.slab.edge,
      emissive: p.slab.edge,
      emissiveIntensity: 0.18,
      roughness: 0.36,
      metalness: 0.28,
      envMapIntensity: 1.25,
    });

    this.zoneBorder = new THREE.MeshBasicMaterial({
      name: 'zone-border',
      color: p.slab.zoneBorder,
    });

    this.zoneSelectedBorder = new THREE.MeshBasicMaterial({
      name: 'zone-selected-border',
      color: p.accentSalmon,
    });

    this.plazaGround = new THREE.MeshStandardMaterial({
      name: 'plaza-ground',
      color: p.slab.plaza,
      roughness: 0.76,
      metalness: 0.08,
      envMapIntensity: 1.1,
    });

    this.plazaGrid = new THREE.LineBasicMaterial({
      name: 'plaza-grid',
      color: p.slab.grid,
      transparent: true,
      opacity: 0.56,
    });

    this.plazaWalkway = new THREE.MeshStandardMaterial({
      name: 'plaza-walkway',
      color: p.slab.walkway,
      roughness: 0.48,
      metalness: 0.18,
      envMapIntensity: 1.2,
    });

    this.vertexColored = new THREE.MeshStandardMaterial({
      name: 'arch-vertex-colored',
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.34,
      metalness: 0.28,
      envMapIntensity: 1.25,
    });

    this.items = {
      base: new THREE.MeshStandardMaterial({
        name: 'item-base-vertex-colored',
        color: '#ffffff',
        vertexColors: true,
        roughness: 0.34,
        metalness: 0.28,
        envMapIntensity: 1.25,
      }),
      selected: new THREE.MeshStandardMaterial({
        name: 'item-selected',
        color: p.accentSalmon,
        emissive: p.accentSalmon,
        emissiveIntensity: 0.28,
        roughness: 0.24,
        metalness: 0.35,
        envMapIntensity: 1.35,
      }),
      hovered: new THREE.MeshStandardMaterial({
        name: 'item-hovered',
        color: p.accentSalmonHover,
        emissive: p.accentSalmonHover,
        emissiveIntensity: 0.18,
        roughness: 0.24,
        metalness: 0.35,
        envMapIntensity: 1.3,
      }),
      equipmentFrame: new THREE.MeshStandardMaterial({
        name: 'item-equipment-frame',
        color: p.items.equipmentFrame,
        roughness: 0.34,
        metalness: 0.62,
        envMapIntensity: 1.25,
      }),
      equipmentVipFrame: new THREE.MeshStandardMaterial({
        name: 'item-equipment-vip-frame',
        color: p.items.equipmentVipFrame,
        roughness: 0.24,
        metalness: 0.78,
        envMapIntensity: 1.35,
      }),
      salmonAccent: new THREE.MeshStandardMaterial({
        name: 'item-salmon-accent',
        color: p.items.salmonAccent,
        emissive: p.items.salmonAccent,
        emissiveIntensity: 0.18,
        roughness: 0.28,
        metalness: 0.35,
        envMapIntensity: 1.25,
      }),
      upholstery: new THREE.MeshStandardMaterial({
        name: 'item-upholstery',
        color: p.items.upholstery,
        roughness: 0.58,
        metalness: 0.12,
        envMapIntensity: 1.15,
      }),
      chrome: new THREE.MeshStandardMaterial({
        name: 'item-chrome',
        color: p.items.chrome,
        roughness: 0.14,
        metalness: 0.92,
        envMapIntensity: 1.45,
      }),
      statusMaintenance: new THREE.MeshStandardMaterial({
        name: 'item-status-maintenance',
        color: p.items.statusMaintenance,
        roughness: 0.38,
        metalness: 0.26,
        envMapIntensity: 1.2,
      }),
      statusBroken: new THREE.MeshStandardMaterial({
        name: 'item-status-broken',
        color: p.items.statusBroken,
        roughness: 0.56,
        metalness: 0.14,
      }),
      statusRetired: new THREE.MeshStandardMaterial({
        name: 'item-status-retired',
        color: p.items.statusRetired,
        roughness: 0.72,
        metalness: 0.08,
        transparent: true,
        opacity: 0.5,
      }),
    };
  }

  public get theme(): ExploreTheme {
    return this.currentTheme;
  }

  public applyTheme(theme: ExploreTheme): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    const p = getExploreThemePalette(theme);

    for (const key of Object.keys(this.floors) as FloorMaterialKind[]) {
      this.floors[key].color.set(p.floors[key]);
    }

    this.walls.concrete.color.set(p.walls.concrete);
    this.walls.glass.color.set(p.walls.glass);
    this.walls['accent-salmon'].color.set(p.walls['accent-salmon']);
    this.walls['accent-salmon'].emissive.set(p.walls['accent-salmon']);
    this.walls['wood-slat'].color.set(p.walls['wood-slat']);
    this.walls.exteriorConcrete.color.set(p.walls.exteriorConcrete);
    this.walls.cutawayCap.color.set(p.walls.cutawayCap);

    this.slabBase.color.set(p.slab.base);
    this.slabEdge.color.set(p.slab.edge);
    this.slabEdge.emissive.set(p.slab.edge);
    this.zoneBorder.color.set(p.slab.zoneBorder);
    this.zoneSelectedBorder.color.set(p.accentSalmon);
    this.plazaGround.color.set(p.slab.plaza);
    this.plazaGrid.color.set(p.slab.grid);
    this.plazaWalkway.color.set(p.slab.walkway);

    this.items.selected.color.set(p.accentSalmon);
    this.items.selected.emissive.set(p.accentSalmon);
    this.items.hovered.color.set(p.accentSalmonHover);
    this.items.hovered.emissive.set(p.accentSalmonHover);
    this.items.equipmentFrame.color.set(p.items.equipmentFrame);
    this.items.equipmentVipFrame.color.set(p.items.equipmentVipFrame);
    this.items.salmonAccent.color.set(p.items.salmonAccent);
    this.items.salmonAccent.emissive.set(p.items.salmonAccent);
    this.items.upholstery.color.set(p.items.upholstery);
    this.items.chrome.color.set(p.items.chrome);
    this.items.statusMaintenance.color.set(p.items.statusMaintenance);
    this.items.statusBroken.color.set(p.items.statusBroken);
    this.items.statusRetired.color.set(p.items.statusRetired);
  }

  public getFloorMaterial(kind: FloorMaterialKind): THREE.MeshStandardMaterial {
    return this.floors[kind] ?? this.floors['concrete-polished'];
  }

  public getWallMaterial(
    kind: WallMaterialKind,
    exterior = false,
  ): THREE.MeshStandardMaterial {
    if (kind === 'glass') return this.walls.glass;
    if (kind === 'accent-salmon') return this.walls['accent-salmon'];
    if (kind === 'wood-slat') return this.walls['wood-slat'];
    return exterior ? this.walls.exteriorConcrete : this.walls.concrete;
  }

  public dispose(): void {
    const uniqueMaterials = new Set<THREE.Material>([
      ...Object.values(this.floors),
      ...Object.values(this.walls),
      this.slabBase,
      this.slabEdge,
      this.zoneBorder,
      this.zoneSelectedBorder,
      this.plazaGround,
      this.plazaGrid,
      this.plazaWalkway,
      this.vertexColored,
      ...Object.values(this.items),
    ]);
    uniqueMaterials.forEach(m => m.dispose());
  }
}

export function createMaterialLibrary(
  mode: ExploreTheme = detectDocumentTheme(),
): MaterialRegistry {
  return new MaterialRegistry(mode);
}

let sharedRegistry: MaterialRegistry | null = null;

export function getSharedMaterialRegistry(theme?: ExploreTheme): MaterialRegistry {
  if (!sharedRegistry) {
    sharedRegistry = new MaterialRegistry(theme ?? detectDocumentTheme());
  } else if (theme) {
    sharedRegistry.applyTheme(theme);
  }
  return sharedRegistry;
}

export function useDocumentTheme(): ExploreTheme {
  const [theme, setTheme] = useState<ExploreTheme>(() => detectDocumentTheme());

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }

    const syncTheme = () => {
      const detected = detectDocumentTheme();
      setTheme(detected);
      getSharedMaterialRegistry().applyTheme(detected);
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}

export function useExploreMaterials(explicitTheme?: ExploreTheme): MaterialRegistry {
  const docTheme = useDocumentTheme();
  const activeTheme = explicitTheme ?? docTheme;

  return useMemo(() => {
    const registry = getSharedMaterialRegistry(activeTheme);
    registry.applyTheme(activeTheme);
    return registry;
  }, [activeTheme]);
}
