// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { WallNode } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { getLevels, zonesOfLevel } from '../scene/selectors';
import {
  buildLevelGeometry,
  buildSegmentedWallGeometry,
  computeExteriorWallNormal,
  CUTAWAY_WALL_HEIGHT,
  mergeBufferGeometries,
  splitWallIntoSegments,
  STAIRWELL_OPENING_BOUNDS,
} from '../renderers/architecture/buildLevelGeometry';
import {
  buildCampusGeometry,
  buildCampusSceneGeometries,
  buildCampusSignageGeometry,
} from '../renderers/architecture/buildCampusGeometry';
import {
  buildCityMetropolisGeometries,
  buildGymCrown,
} from '../renderers/architecture/buildCityMetropolis';
import { buildLevelInteriorDetailsGeometry } from '../renderers/architecture/buildInteriorDetails';
import {
  collectSceneExteriorWallDescriptors,
  computeCutawayWallIds,
  computeWallCameraDot,
  CUTAWAY_DOT_THRESHOLD,
  isWallFacingCamera,
} from '../canvas/Cutaway';
import {
  computeLevelTargetY,
  isExteriorWorldVisible,
  isLevelDimmedInMode,
  isLevelVisibleInMode,
} from '../canvas/LevelStack';
import { getLightingBudgetConfig } from '../canvas/Lights';
import {
  buildPlazaGridGeometry,
  ENTRANCE_WALKWAY_BOUNDS,
  PLAZA_BOUNDS,
} from '../canvas/Environment';
import {
  detectDocumentTheme,
  getExploreThemePalette,
  MaterialRegistry,
} from '../renderers/materials';

// Kiểm tra một BufferGeometry hợp lệ (có thuộc tính, không NaN; cho phép rỗng nếu allowEmpty).
function assertValidBufferGeometry(geom: THREE.BufferGeometry, allowEmpty = false): void {
  const pos = geom.getAttribute('position');
  const norm = geom.getAttribute('normal');
  const uv = geom.getAttribute('uv');
  const idx = geom.getIndex();

  expect(pos).toBeDefined();
  expect(norm).toBeDefined();
  expect(uv).toBeDefined();
  expect(idx).toBeDefined();

  if (!allowEmpty) {
    expect(pos.count).toBeGreaterThan(0);
    expect(idx!.count).toBeGreaterThan(0);
  }

  for (let i = 0; i < pos.count; i++) {
    expect(Number.isFinite(pos.getX(i))).toBe(true);
    expect(Number.isFinite(pos.getY(i))).toBe(true);
    expect(Number.isFinite(pos.getZ(i))).toBe(true);
    expect(Number.isFinite(norm.getX(i))).toBe(true);
    expect(Number.isFinite(norm.getY(i))).toBe(true);
    expect(Number.isFinite(norm.getZ(i))).toBe(true);
  }
}

describe('EXP-03 & EXP-11 Architecture, Cutaway, Materials & Lighting', () => {
  const LEVEL_IDS = ['lvl-b1', 'lvl-l1', 'lvl-l2', 'lvl-rf'] as const;

  describe('buildLevelGeometry across all 5 levels', () => {
    it.each(LEVEL_IDS)('builds non-empty, NaN-free geometry buckets for %s', levelId => {
      const built = buildLevelGeometry(SOL_CENTER_SCENE, levelId);
      const expectedZones = zonesOfLevel(SOL_CENTER_SCENE, levelId);

      expect(built.levelId).toBe(levelId);
      assertValidBufferGeometry(built.slabGeometry);
      assertValidBufferGeometry(built.slabEdgeGeometry);

      // Verify slab sits from -slabThickness (-0.28) to 0
      built.slabGeometry.computeBoundingBox();
      const slabBox = built.slabGeometry.boundingBox!;
      expect(slabBox.min.y).toBeCloseTo(-0.28, 3);
      expect(slabBox.max.y).toBeCloseTo(0, 3);

      // Verify all zones on the level have floor and border geometries at y ~ 0.015
      expect(built.zoneFloorGeometries).toHaveLength(expectedZones.length);
      for (const zf of built.zoneFloorGeometries) {
        assertValidBufferGeometry(zf.geometry);
        assertValidBufferGeometry(zf.borderGeometry);
        expect(zf.center[1]).toBeCloseTo(0.015, 3);
      }

      // Verify exterior walls have valid full and lowCut geometries
      expect(built.exteriorWallsByNormal.length).toBeGreaterThanOrEqual(3);
      for (const ext of built.exteriorWallsByNormal) {
        assertValidBufferGeometry(ext.fullGeometry);
        assertValidBufferGeometry(ext.lowCutGeometry);

        ext.lowCutGeometry.computeBoundingBox();
        const lowBox = ext.lowCutGeometry.boundingBox!;
        expect(lowBox.max.y).toBeLessThanOrEqual(CUTAWAY_WALL_HEIGHT + 1e-3);
      }

      // Interior opaque & glass wall buckets must be valid (OUT has only exterior fence walls)
      assertValidBufferGeometry(built.interiorOpaqueGeometry);
      assertValidBufferGeometry(built.glassWallGeometry);

      // Interior details geometry must be non-empty and vertex-colored on all 5 levels
      expect(built.interiorDetailsGeometry.getAttribute('position').count).toBeGreaterThan(100);
      expect(built.interiorDetailsGeometry.getAttribute('color')).toBeDefined();
    });

    it('builds comprehensive exterior campus & signage geometries without NaN vertices', () => {
      const campusDark = buildCampusGeometry('dark');
      expect(campusDark.getAttribute('position').count).toBeGreaterThan(1000);
      expect(campusDark.getAttribute('color')).toBeDefined();
      campusDark.dispose();

      const campusScene = buildCampusSceneGeometries('light');
      for (const geom of [campusScene.opaque, campusScene.glass, campusScene.water, campusScene.vehicles]) {
        const pos = geom.getAttribute('position');
        const norm = geom.getAttribute('normal');
        expect(pos).toBeDefined();
        expect(norm).toBeDefined();
        expect(pos.count).toBeGreaterThan(0);
        expect(geom.getAttribute('color')).toBeDefined();
        expect(geom.getIndex()).toBeDefined();
        for (let i = 0; i < pos.count; i += 1) {
          expect(Number.isFinite(pos.getX(i))).toBe(true);
          expect(Number.isFinite(pos.getY(i))).toBe(true);
          expect(Number.isFinite(pos.getZ(i))).toBe(true);
          expect(Number.isFinite(norm.getX(i))).toBe(true);
          expect(Number.isFinite(norm.getY(i))).toBe(true);
          expect(Number.isFinite(norm.getZ(i))).toBe(true);
        }
      }
      expect(campusScene.opaque.getAttribute('surf')).toBeDefined();
      expect(campusScene.vehicles.getAttribute('surf')).toBeDefined();
      campusScene.opaque.dispose();
      campusScene.glass.dispose();
      campusScene.water.dispose();
      campusScene.vehicles.dispose();

      const signageGeom = buildCampusSignageGeometry();
      assertValidBufferGeometry(signageGeom);
      expect(signageGeom.getAttribute('position').count).toBeGreaterThanOrEqual(40);
      signageGeom.dispose();

      for (const code of ['B1', 'L1', 'L2', 'RF', 'OUT'] as const) {
        const details = buildLevelInteriorDetailsGeometry(code);
        expect(details.getAttribute('position').count).toBeGreaterThan(100);
        details.dispose();
      }
    });

    it('merges arbitrary BufferGeometries with typed arrays without NaN vertices', () => {
      const b1 = new THREE.BoxGeometry(2, 3, 0.2);
      b1.translate(-3, 1.5, 0);
      const b2 = new THREE.BoxGeometry(4, 2, 0.2);
      b2.translate(3, 1.0, 2);

      const merged = mergeBufferGeometries([b1, b2]);
      assertValidBufferGeometry(merged);
      expect(merged.getAttribute('position').count).toBe(
        b1.getAttribute('position').count + b2.getAttribute('position').count,
      );
    });
  });

  describe('WallOpening segmentation (non-CSG)', () => {
    it('splits L1 south wall around op-l1-main-entry into left, header, and right segments', () => {
      const southWall = SOL_CENTER_SCENE.nodes['wall-l1-south'] as WallNode;
      expect(southWall).toBeDefined();
      expect(southWall.openings.some(o => o.id === 'op-l1-main-entry')).toBe(true);

      const segments = splitWallIntoSegments(southWall);
      // 1 door opening with sillHeight=0 and height=3.0 on a 4.2m wall -> left solid + header + right solid = 3 segments
      expect(segments).toHaveLength(3);
      expect(segments.map(s => s.kind)).toEqual(['solid', 'header', 'solid']);

      const header = segments.find(s => s.kind === 'header')!;
      expect(header.openingId).toBe('op-l1-main-entry');
      expect(header.y0).toBeCloseTo(3.0, 4);
      expect(header.y1).toBeCloseTo(southWall.height, 4);

      const geom = buildSegmentedWallGeometry(southWall);
      assertValidBufferGeometry(geom);
    });

    it('splits L1 north wall around op-l1-n-win1 and op-l1-n-win2 with sill and header segments', () => {
      const northWall = SOL_CENTER_SCENE.nodes['wall-l1-north'] as WallNode;
      expect(northWall).toBeDefined();
      expect(northWall.openings.map(o => o.id)).toEqual([
        'op-l1-n-win1',
        'op-l1-n-win2',
      ]);

      const segments = splitWallIntoSegments(northWall);
      // 2 windows -> left solid + (sill + header) + middle solid + (sill + header) + right solid = 7 segments
      expect(segments).toHaveLength(7);
      expect(segments.filter(s => s.kind === 'sill')).toHaveLength(2);
      expect(segments.filter(s => s.kind === 'header')).toHaveLength(2);
      expect(segments.filter(s => s.kind === 'solid')).toHaveLength(3);

      const geom = buildSegmentedWallGeometry(northWall);
      assertValidBufferGeometry(geom);
    });
  });

  describe('Cutaway normal & camera dot-product logic', () => {
    it('computes outward normals for N, S, W, E exterior walls on L1', () => {
      const l1 = SOL_CENTER_SCENE.nodes['lvl-l1'];
      if (!l1 || l1.type !== 'level') throw new Error('Missing lvl-l1');

      const north = SOL_CENTER_SCENE.nodes['wall-l1-north'] as WallNode;
      const south = SOL_CENTER_SCENE.nodes['wall-l1-south'] as WallNode;
      const west = SOL_CENTER_SCENE.nodes['wall-l1-west'] as WallNode;
      const east = SOL_CENTER_SCENE.nodes['wall-l1-east'] as WallNode;

      expect(computeExteriorWallNormal(north, l1.slabPolygon)).toEqual([0, -1]);
      expect(computeExteriorWallNormal(south, l1.slabPolygon)).toEqual([0, 1]);
      expect(computeExteriorWallNormal(west, l1.slabPolygon)).toEqual([-1, 0]);
      expect(computeExteriorWallNormal(east, l1.slabPolygon)).toEqual([1, 0]);
    });

    it('identifies camera-facing exterior walls using dot > 0.22 threshold', () => {
      const descriptors = collectSceneExteriorWallDescriptors();
      expect(descriptors.length).toBeGreaterThanOrEqual(15);

      // Camera in front of South facade at [0, 42] XZ
      const southCamCut = computeCutawayWallIds(descriptors, [0, 42], 'cutaway');
      expect(southCamCut.has('wall-l1-south')).toBe(true);
      expect(southCamCut.has('wall-l2-south')).toBe(true);
      expect(southCamCut.has('wall-l1-north')).toBe(false);
      expect(southCamCut.has('wall-l1-west')).toBe(false);
      expect(southCamCut.has('wall-l1-east')).toBe(false);

      // Camera at overview position [46, 48] XZ (South-East) cuts both South and East walls
      const seCamCut = computeCutawayWallIds(descriptors, [46, 48], 'cutaway');
      expect(seCamCut.has('wall-l1-south')).toBe(true);
      expect(seCamCut.has('wall-l1-east')).toBe(true);
      expect(seCamCut.has('wall-l1-north')).toBe(false);
      expect(seCamCut.has('wall-l1-west')).toBe(false);

      // wallMode='up' cuts nothing; wallMode='down' cuts everything
      expect(computeCutawayWallIds(descriptors, [46, 48], 'up').size).toBe(0);
      expect(computeCutawayWallIds(descriptors, [46, 48], 'down').size).toBe(
        descriptors.length,
      );

      // Verify exact dot threshold behavior
      expect(computeWallCameraDot([0, 1], [0, 16], [0, 42])).toBeCloseTo(1, 5);
      expect(isWallFacingCamera([0, 1], [0, 16], [0, 42], CUTAWAY_DOT_THRESHOLD)).toBe(
        true,
      );
      expect(isWallFacingCamera([0, -1], [0, -16], [0, 42], CUTAWAY_DOT_THRESHOLD)).toBe(
        false,
      );
    });
  });

  describe('LevelStack elevation & solo visibility rules', () => {
    it('computes stacked vs exploded target Y and solo visibility', () => {
      const levels = getLevels(SOL_CENTER_SCENE);
      const b1 = levels.find(l => l.code === 'B1')!;
      const l1 = levels.find(l => l.code === 'L1')!;
      const l2 = levels.find(l => l.code === 'L2')!;
      const rf = levels.find(l => l.code === 'RF')!;

      expect(computeLevelTargetY(l2, 'stacked')).toBeCloseTo(5.76, 4);
      expect(computeLevelTargetY(l2, 'exploded')).toBeCloseTo(11.76, 4);

      // In solo mode focused on L1, B1 and L1 and OUT remain visible while L2 and RF are hidden
      expect(isLevelVisibleInMode(b1, 'solo', 'L1')).toBe(true);
      expect(isLevelVisibleInMode(l1, 'solo', 'L1')).toBe(true);
      expect(isLevelVisibleInMode(l2, 'solo', 'L1')).toBe(false);
      expect(isLevelVisibleInMode(rf, 'solo', 'L1')).toBe(false);

      expect(isLevelDimmedInMode(b1, 'solo', 'L1')).toBe(true);
      expect(isLevelDimmedInMode(l1, 'solo', 'L1')).toBe(false);
    });
  });

  describe('Charcoal–Salmon Materials, Lights & Environment', () => {
    it('provides dark and light palettes and enforces MeshStandardMaterial for glass', () => {
      const dark = getExploreThemePalette('dark');
      const light = getExploreThemePalette('light');

      expect(dark.canvasBg).toBe('#161618');
      expect(dark.accentSalmon).toBe('#c8cdd6');
      expect(light.canvasBg).toBe('#eae5dd');
      expect(light.accentSalmon).toBe('#c47c6a');

      const registry = new MaterialRegistry('dark');
      expect(registry.walls.glass).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(registry.walls.glass).not.toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(registry.walls.glass.transparent).toBe(true);
      expect(registry.walls.glass.opacity).toBeCloseTo(0.34, 3);
      expect(registry.walls.glass.depthWrite).toBe(false);

      registry.applyTheme('light');
      expect(registry.theme).toBe('light');
      expect(`#${registry.slabEdge.color.getHexString()}`).toBe('#c47c6a');
      registry.dispose();
    });

    it('detects document theme from html[data-theme]', () => {
      document.documentElement.removeAttribute('data-theme');
      expect(detectDocumentTheme()).toBe('dark');

      document.documentElement.setAttribute('data-theme', 'light');
      expect(detectDocumentTheme()).toBe('light');

      document.documentElement.setAttribute('data-theme', 'dark');
      expect(detectDocumentTheme()).toBe('dark');
    });

    it('matches Section 5.2 lighting budget and plaza environment geometry', () => {
      const highLight = getLightingBudgetConfig('dark', 'high');
      expect(highLight.ambient.intensity).toBeCloseTo(0.06, 3);
      expect(highLight.hemisphere.intensity).toBeCloseTo(0.3, 3);
      expect(highLight.keyLight.position).toEqual([-26, 11, 40]);
      expect(highLight.keyLight.intensity).toBeCloseTo(3.4, 3);
      expect(highLight.keyLight.castShadow).toBe(true);
      expect(highLight.keyLight.shadowMapSize).toEqual([3072, 3072]);
      expect(highLight.keyLight.shadowBias).toBeCloseTo(-0.00012, 6);
      expect(highLight.keyLight.shadowNormalBias).toBeCloseTo(0.02, 4);
      expect(highLight.fillLight.position).toEqual([34, 18, -10]);
      expect(highLight.fillLight.intensity).toBeCloseTo(0.3, 3);
      expect(highLight.fillLight.castShadow).toBe(false);
      expect(highLight.rimLight.intensity).toBeCloseTo(0.4, 3);

      const lowLight = getLightingBudgetConfig('light', 'low');
      expect(lowLight.keyLight.castShadow).toBe(false);

      expect(PLAZA_BOUNDS).toEqual({
        minX: -45,
        maxX: 58,
        minZ: -30,
        maxZ: 30,
        y: -0.04,
      });
      expect(ENTRANCE_WALKWAY_BOUNDS.minZ).toBe(16);
      expect(ENTRANCE_WALKWAY_BOUNDS.maxZ).toBe(22);

      const gridGeom = buildPlazaGridGeometry();
      expect(gridGeom.getAttribute('position').count).toBeGreaterThan(20);
      gridGeom.dispose();
    });
  });
});

describe('Phase 2 foliage buckets & structural stairwell cutouts', () => {
  it('populates finite alpha-tested foliage buckets in both Campus and CityMetropolis builders', () => {
    const campus = buildCampusSceneGeometries('light');
    expect(campus.foliage).toBeDefined();
    assertValidBufferGeometry(campus.foliage);
    expect(campus.foliage.getAttribute('windWeight')).toBeDefined();
    expect(campus.foliage.getAttribute('color')).toBeDefined();
    expect(campus.opaque.getAttribute('surf')).toBeDefined();
    expect(campus.vehicles.getAttribute('surf')).toBeDefined();

    const city = buildCityMetropolisGeometries('dark', 'high');
    expect(city.foliageGeometry).toBeDefined();
    assertValidBufferGeometry(city.foliageGeometry);
    expect(city.foliageGeometry.getAttribute('windWeight')).toBeDefined();
  });

  it('punches stairwell cutouts in L1, L2, RF slabs while keeping B1 solid', () => {
    const stairCenter = new THREE.Vector3(
      (STAIRWELL_OPENING_BOUNDS.minX + STAIRWELL_OPENING_BOUNDS.maxX) * 0.5,
      5,
      (STAIRWELL_OPENING_BOUNDS.minZ + STAIRWELL_OPENING_BOUNDS.maxZ) * 0.5,
    );
    const downRay = new THREE.Raycaster(stairCenter, new THREE.Vector3(0, -1, 0));

    for (const cutId of ['lvl-l1', 'lvl-l2', 'lvl-rf'] as const) {
      const built = buildLevelGeometry(SOL_CENTER_SCENE, cutId);
      const slabMesh = new THREE.Mesh(built.slabGeometry);
      slabMesh.updateMatrixWorld(true);
      expect(downRay.intersectObject(slabMesh, false)).toHaveLength(0);
    }

    const b1Built = buildLevelGeometry(SOL_CENTER_SCENE, 'lvl-b1');
    const b1SlabMesh = new THREE.Mesh(b1Built.slabGeometry);
    b1SlabMesh.updateMatrixWorld(true);
    expect(downRay.intersectObject(b1SlabMesh, false).length).toBeGreaterThan(0);

    // RF stairwell headhouse must use real transparent glass walls up to the canopy rather than opaque grey vertex boxes
    const rfWest = SOL_CENTER_SCENE.nodes['wall-rf-stair-west'] as WallNode;
    const rfEast = SOL_CENTER_SCENE.nodes['wall-rf-stair-east'] as WallNode;
    const rfSouth = SOL_CENTER_SCENE.nodes['wall-rf-stair-south'] as WallNode;
    expect(rfWest.material).toBe('glass');
    expect(rfEast.material).toBe('glass');
    expect(rfSouth.material).toBe('glass');
    expect(rfWest.height).toBeGreaterThanOrEqual(2.5);
    expect(rfEast.height).toBeGreaterThanOrEqual(2.5);
    expect(rfSouth.height).toBeGreaterThanOrEqual(2.5);

    const rfDetails = buildLevelInteriorDetailsGeometry('RF');
    const dPos = rfDetails.getAttribute('position');
    const dCol = rfDetails.getAttribute('color');
    const bunkerGrey = new THREE.Color('#94a3b8');
    let opaqueHeadhouseWallVerts = 0;
    for (let i = 0; i < dPos.count; i++) {
      const x = dPos.getX(i);
      const y = dPos.getY(i);
      const z = dPos.getZ(i);
      if (x >= 8.5 && x <= 12.5 && z >= 9.2 && z <= 13.6 && y > 0.3 && y < 2.5) {
        if (
          Math.abs(dCol.getX(i) - bunkerGrey.r) < 0.02 &&
          Math.abs(dCol.getY(i) - bunkerGrey.g) < 0.02 &&
          Math.abs(dCol.getZ(i) - bunkerGrey.b) < 0.02
        ) {
          opaqueHeadhouseWallVerts++;
        }
      }
    }
    expect(opaqueHeadhouseWallVerts).toBe(0);
    rfDetails.dispose();
  });
});

describe('metro timetable', () => {
  it('dwells at the station and stays on the track', async () => {
    const { metroPosition, LOOP } = await import('../renderers/architecture/metroMotion');
    const samples = Array.from({ length: 400 }, (_, i) => metroPosition(i * 0.5, 15, 4));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(-LOOP / 2 - 1);
    expect(Math.max(...samples)).toBeLessThanOrEqual(LOOP / 2 + 1);
    expect(samples.filter(p => Math.abs(p - 4) < 0.01).length).toBeGreaterThan(10);
  });
});

describe('Soft ray-traced gym glass, rooftop sky & street sightlines', () => {
  it('attaches soft ray-traced Fresnel + reflection shader to MeshStandardMaterial glass without breaking PBR invariants', () => {
    const registry = new MaterialRegistry('dark');
    const glass = registry.walls.glass;
    expect(glass).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(glass).not.toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(glass.opacity).toBeCloseTo(0.34, 3);
    expect(glass.customProgramCacheKey()).toContain('sol-arch-glass');

    const mockShader: THREE.WebGLProgramParametersWithUniforms = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}',
      fragmentShader:
        '#include <common>\nvoid main() {\n#include <color_fragment>\n#include <normal_fragment_maps>\n#include <lights_fragment_end>\n}',
    } as unknown as THREE.WebGLProgramParametersWithUniforms;

    glass.onBeforeCompile(mockShader, {} as THREE.WebGLRenderer);
    expect(mockShader.uniforms.uGlassIsLight).toBeDefined();
    expect((mockShader.uniforms.uGlassIsLight as { value: number }).value).toBe(0);
    expect(mockShader.fragmentShader).toContain('vGlassWorldPos');
    expect(mockShader.fragmentShader).toContain('reflect(');

    registry.applyTheme('light');
    expect((mockShader.uniforms.uGlassIsLight as { value: number }).value).toBe(1);
    registry.dispose();
  });

  it('equips L1/L2 gym perimeter walls with panoramic windows & mullions and clears RF glass balustrades for street views', () => {
    for (const wallId of [
      'wall-l1-west',
      'wall-l1-east',
      'wall-l2-north',
      'wall-l2-west',
      'wall-l2-east',
    ]) {
      const wall = SOL_CENTER_SCENE.nodes[wallId] as WallNode;
      expect(wall).toBeDefined();
      const winOpenings = wall.openings.filter(o => o.kind === 'window');
      expect(winOpenings.length, `${wallId} must have panoramic windows`).toBeGreaterThan(0);
      for (const win of winOpenings) {
        expect(win.sillHeight).toBeLessThanOrEqual(0.65);
        expect(win.height).toBeGreaterThanOrEqual(3.4);
      }
    }

    const l2Built = buildLevelGeometry(SOL_CENTER_SCENE, 'lvl-l2');
    const l2WestExt = l2Built.exteriorWallsByNormal.find(w => w.wallId === 'wall-l2-west')!;
    expect(l2WestExt.glassGeometry).toBeDefined();
    expect(l2WestExt.frameGeometry).toBeDefined();
    assertValidBufferGeometry(l2WestExt.glassGeometry!);
    assertValidBufferGeometry(l2WestExt.frameGeometry!);

    // Rooftop parapets must be glass balustrades and free of eye-level opaque sign backboards
    for (const pid of [
      'wall-rf-parapet-n',
      'wall-rf-parapet-s',
      'wall-rf-parapet-w',
      'wall-rf-parapet-e',
    ]) {
      const parapet = SOL_CENTER_SCENE.nodes[pid] as WallNode;
      expect(parapet.material).toBe('glass');
      expect(parapet.height).toBeGreaterThanOrEqual(1.1);
    }

    const rfDetails = buildLevelInteriorDetailsGeometry('RF');
    const pos = rfDetails.getAttribute('position');
    let blockingPerimeterVerts = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y > 1.28 && y < 3.25 && (z > 15.5 || x > 21.5)) {
        blockingPerimeterVerts++;
      }
    }
    expect(blockingPerimeterVerts).toBe(0);
    rfDetails.dispose();

    // GymCrown leaves the East Rooftop Sky Deck (x > 9.5) open to the sky
    const crown = buildGymCrown('dark');
    crown.glassGeometry.computeBoundingBox();
    expect(crown.glassGeometry.boundingBox!.max.x).toBeLessThanOrEqual(9.5);
  });

  it('keeps streets visible from L2 and RF in solo mode and frames the sky on all RF viewpoints', () => {
    expect(isExteriorWorldVisible('solo', 'L2')).toBe(true);
    expect(isExteriorWorldVisible('solo', 'RF')).toBe(true);
    expect(isExteriorWorldVisible('solo', 'L1')).toBe(true);
    expect(isExteriorWorldVisible('solo', 'B1')).toBe(false);

    const rfNodes = [
      SOL_CENTER_SCENE.nodes['lvl-rf'],
      SOL_CENTER_SCENE.nodes['zone-rf-zen'],
      SOL_CENTER_SCENE.nodes['zone-rf-terrace'],
    ];
    for (const node of rfNodes) {
      if (!node || !('viewpoints' in node)) continue;
      for (const vp of node.viewpoints) {
        const dx = vp.target[0] - vp.position[0];
        const dy = vp.target[1] - vp.position[1];
        const dz = vp.target[2] - vp.position[2];
        const horiz = Math.hypot(dx, dz);
        const pitchDeg = (Math.atan2(dy, horiz) * 180) / Math.PI;
        const topOfFrameDeg = pitchDeg + (vp.fov ?? 38) * 0.5;
      expect(
        topOfFrameDeg,
        `Viewpoint ${vp.id} must extend above horizon to show rooftop sky`,
      ).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('eliminates opaque cyan fake-glass barrier blocks (#7dd3fc) from L1 QR turnstiles', () => {
    const l1Details = buildLevelInteriorDetailsGeometry('L1');
    const pos = l1Details.getAttribute('position');
    const col = l1Details.getAttribute('color');
    const cyanGlass = new THREE.Color('#7dd3fc');
    let cyanGateVerts = 0;
    for (let i = 0; i < pos.count; i++) {
      if (
        Math.abs(pos.getZ(i) - 4.0) < 0.3 &&
        Math.abs(col.getX(i) - cyanGlass.r) < 0.02 &&
        Math.abs(col.getY(i) - cyanGlass.g) < 0.02 &&
        Math.abs(col.getZ(i) - cyanGlass.b) < 0.02
      ) {
        cyanGateVerts++;
      }
    }
    expect(cyanGateVerts).toBe(0);
    l1Details.dispose();
  });
});
