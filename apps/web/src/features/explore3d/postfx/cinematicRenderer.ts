import * as THREE from 'three';
import { getInternalScale, type PostFxConfig } from './postfxConfig';
import {
  BLOOM_DOWN_FRAG,
  BLOOM_UP_FRAG,
  COMPOSITE_FRAG,
  DEPTH_BLUR_FRAG,
  FINAL_FRAG,
  FULLSCREEN_VERT,
  GRADE_FRAG,
  SSAO_FRAG,
} from './shaders';

type Uniforms = Record<string, THREE.IUniform>;

function makeMaterial(fragmentShader: string, uniforms: Uniforms, defines?: Record<string, string | number>) {
  return new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader,
    uniforms,
    ...(defines ? { defines } : {}),
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

function makeTarget(type: THREE.TextureDataType, options: THREE.RenderTargetOptions = {}) {
  return new THREE.WebGLRenderTarget(1, 1, {
    type,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    ...options,
  });
}

interface Pipeline {
  scene: THREE.WebGLRenderTarget;
  composite: THREE.WebGLRenderTarget;
  ao: THREE.WebGLRenderTarget;
  aoBlur: THREE.WebGLRenderTarget;
  down: THREE.WebGLRenderTarget[];
  up: THREE.WebGLRenderTarget[];
  ldr: THREE.WebGLRenderTarget;
  mats: {
    ssao: THREE.ShaderMaterial;
    blur: THREE.ShaderMaterial;
    composite: THREE.ShaderMaterial;
    down: THREE.ShaderMaterial;
    up: THREE.ShaderMaterial;
    grade: THREE.ShaderMaterial;
    final: THREE.ShaderMaterial;
  };
  quadScene: THREE.Scene;
  quad: THREE.Mesh;
  quadCamera: THREE.Camera;
  width: number;
  height: number;
}

export function createPipeline(cfg: PostFxConfig, hdrType: THREE.TextureDataType): Pipeline {
  const depthTexture = new THREE.DepthTexture(1, 1);
  depthTexture.type = THREE.UnsignedIntType;
  const scene = makeTarget(hdrType, {
    depthBuffer: true,
    stencilBuffer: false,
    samples: cfg.msaa,
    depthTexture,
  });

  const down = Array.from({ length: cfg.bloom.levels }, () => makeTarget(hdrType));
  const up = Array.from({ length: cfg.bloom.levels - 1 }, () => makeTarget(hdrType));

  const mats = {
    ssao: makeMaterial(
      SSAO_FRAG,
      {
        tDepth: { value: null },
        uDepthSize: { value: new THREE.Vector2() },
        uNear: { value: 0.05 },
        uFar: { value: 380 },
        uTanHalf: { value: 0.35 },
        uAspect: { value: 1 },
        uRadiusNear: { value: cfg.ao.radiusNear },
        uRadiusFar: { value: cfg.ao.radiusFar },
        uIntensity: { value: cfg.ao.intensity },
        uFadeStart: { value: cfg.ao.fadeStart },
        uFadeEnd: { value: cfg.ao.fadeEnd },
      },
      { AO_TAPS: cfg.ao.taps },
    ),
    blur: makeMaterial(DEPTH_BLUR_FRAG, {
      tInput: { value: null },
      uDir: { value: new THREE.Vector2() },
      uTol: { value: 0.04 },
    }),
    composite: makeMaterial(COMPOSITE_FRAG, {
      tScene: { value: null },
      tDepth: { value: null },
      tAO: { value: null },
      uAOSize: { value: new THREE.Vector2() },
      uNear: { value: 0.05 },
      uFar: { value: 380 },
      uStrength: { value: cfg.ao.strength },
      uExposure: { value: cfg.grade.exposure },
    }),
    down: makeMaterial(BLOOM_DOWN_FRAG, {
      tInput: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uKaris: { value: 0 },
    }),
    up: makeMaterial(BLOOM_UP_FRAG, {
      tLow: { value: null },
      tCur: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uMix: { value: cfg.bloom.upMix },
    }),
    grade: makeMaterial(GRADE_FRAG, {
      tScene: { value: null },
      tDepth: { value: null },
      tBloom: { value: null },
      uBloom: { value: cfg.bloom.enabled ? cfg.bloom.strength : 0 },
      uExposure: { value: cfg.grade.exposure },
      uAgxMix: { value: cfg.grade.agxMix },
      uSplit: { value: cfg.grade.splitTone },
      uCurve: { value: cfg.grade.curve },
      uLift: { value: cfg.grade.blackLift },
      uSat: { value: cfg.grade.saturation },
      uVignette: { value: cfg.grade.vignette },
      uCA: { value: cfg.grade.chromaticAberration },
    }),
    final: makeMaterial(FINAL_FRAG, {
      tInput: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uScreen: { value: new THREE.Vector2() },
      uFxaa: { value: cfg.final.fxaa ? 1 : 0 },
      uSharpen: { value: cfg.final.sharpen },
      uGrain: { value: cfg.final.grain },
      uTime: { value: 0 },
    }),
  };

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mats.final);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);

  return {
    scene,
    composite: makeTarget(hdrType),
    ao: makeTarget(hdrType),
    aoBlur: makeTarget(hdrType),
    down,
    up,
    ldr: makeTarget(THREE.UnsignedByteType),
    mats,
    quadScene,
    quad,
    quadCamera: new THREE.Camera(),
    width: 0,
    height: 0,
  };
}

export function disposePipeline(p: Pipeline) {
  p.scene.depthTexture?.dispose();
  [p.scene, p.composite, p.ao, p.aoBlur, p.ldr, ...p.down, ...p.up].forEach(t => t.dispose());
  Object.values(p.mats).forEach(m => m.dispose());
  p.quad.geometry.dispose();
}

function resizePipeline(p: Pipeline, w: number, h: number) {
  if (p.width === w && p.height === h) return;
  p.width = w;
  p.height = h;
  p.scene.setSize(w, h);
  p.composite.setSize(w, h);
  p.ldr.setSize(w, h);
  const hw = Math.max(1, Math.floor(w / 2));
  const hh = Math.max(1, Math.floor(h / 2));
  p.ao.setSize(hw, hh);
  p.aoBlur.setSize(hw, hh);
  let bw = hw;
  let bh = hh;
  p.down.forEach((t, i) => {
    t.setSize(bw, bh);
    if (i < p.up.length) p.up[i].setSize(bw, bh);
    bw = Math.max(1, Math.floor(bw / 2));
    bh = Math.max(1, Math.floor(bh / 2));
  });
}

export function hasHalfFloatTargets(gl: THREE.WebGLRenderer): boolean {
  const ext = gl.extensions;
  return Boolean(ext?.has?.('EXT_color_buffer_float') || ext?.has?.('EXT_color_buffer_half_float'));
}

/**
 * Imperative HDR post chain (Saltline-style). Owns all render targets and
 * materials; React only creates/disposes it and forwards frames.
 */
export class CinematicRenderer {
  private readonly p: Pipeline;
  private cfg: PostFxConfig;
  private failed = false;
  private readonly size = new THREE.Vector2();
  private restoreShaderHook: (() => void) | null = null;

  constructor(cfg: PostFxConfig, hdrType: THREE.TextureDataType) {
    this.cfg = cfg;
    this.p = createPipeline(cfg, hdrType);
  }

  /** Falls back to forward rendering for good if any program fails to compile. */
  attach(gl: THREE.WebGLRenderer, onFail: () => void) {
    const prev = gl.debug.onShaderError;
    gl.debug.onShaderError = (ctx, program, vs, fs) => {
      this.failed = true;
      console.error(
        '[explore3d] cinematic pipeline disabled, shader failed to compile:',
        ctx.getShaderInfoLog(fs) || ctx.getShaderInfoLog(vs) || ctx.getProgramInfoLog(program),
      );
      onFail();
    };
    this.restoreShaderHook = () => {
      gl.debug.onShaderError = prev;
    };
  }

  applyConfig(cfg: PostFxConfig) {
    this.cfg = cfg;
    const m = this.p.mats;
    m.ssao.uniforms.uIntensity.value = cfg.ao.intensity;
    m.composite.uniforms.uStrength.value = cfg.ao.strength;
    m.composite.uniforms.uExposure.value = cfg.grade.exposure;
    m.grade.uniforms.uBloom.value = cfg.bloom.enabled ? cfg.bloom.strength : 0;
    m.grade.uniforms.uExposure.value = cfg.grade.exposure;
    m.grade.uniforms.uSplit.value = cfg.grade.splitTone;
    m.grade.uniforms.uCurve.value = cfg.grade.curve;
    m.grade.uniforms.uLift.value = cfg.grade.blackLift;
    m.grade.uniforms.uSat.value = cfg.grade.saturation;
    m.grade.uniforms.uVignette.value = cfg.grade.vignette;
    m.grade.uniforms.uCA.value = cfg.grade.chromaticAberration;
    m.final.uniforms.uGrain.value = cfg.final.grain;
    m.final.uniforms.uSharpen.value = cfg.final.sharpen;
  }

  dispose() {
    this.restoreShaderHook?.();
    this.restoreShaderHook = null;
    disposePipeline(this.p);
  }

  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, delta: number) {
    if (this.failed) {
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      return;
    }
    const cfg = this.cfg;
    const p = this.p;
    const m = p.mats;
    const drawing = gl.getDrawingBufferSize(this.size);
    const scale = getInternalScale(drawing.x, drawing.y, cfg.pixelBudget);
    const w = Math.max(1, Math.round(drawing.x * scale));
    const h = Math.max(1, Math.round(drawing.y * scale));
    resizePipeline(p, w, h);

    const pass = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      p.quad.material = material;
      gl.setRenderTarget(target);
      gl.render(p.quadScene, p.quadCamera);
    };

    const info = gl.info;
    const prevAutoReset = info.autoReset;
    info.autoReset = false;
    info.reset();

    // 1. Scene → HDR (MSAA) with depth texture.
    gl.setRenderTarget(p.scene);
    gl.clear();
    gl.render(scene, camera);
    const sceneCalls = info.render.calls;
    const sceneTriangles = info.render.triangles;

    const depth = p.scene.depthTexture;
    let hdr: THREE.Texture = p.scene.texture;
    const persp = (camera as THREE.PerspectiveCamera).isPerspectiveCamera
      ? (camera as THREE.PerspectiveCamera)
      : null;

    // 2. Half-res SSAO → depth-aware blur H/V → composite with bilateral upsample.
    if (cfg.ao.enabled && persp && depth) {
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(persp.fov) / 2) / (persp.zoom || 1);
      const su = m.ssao.uniforms;
      su.tDepth.value = depth;
      su.uDepthSize.value.set(w, h);
      su.uNear.value = persp.near;
      su.uFar.value = persp.far;
      su.uTanHalf.value = tanHalf;
      su.uAspect.value = w / h;
      pass(m.ssao, p.ao);

      const bu = m.blur.uniforms;
      bu.tInput.value = p.ao.texture;
      bu.uDir.value.set(1 / p.ao.width, 0);
      pass(m.blur, p.aoBlur);
      bu.tInput.value = p.aoBlur.texture;
      bu.uDir.value.set(0, 1 / p.ao.height);
      pass(m.blur, p.ao);

      const cu = m.composite.uniforms;
      cu.tScene.value = p.scene.texture;
      cu.tDepth.value = depth;
      cu.tAO.value = p.ao.texture;
      cu.uAOSize.value.set(p.ao.width, p.ao.height);
      cu.uNear.value = persp.near;
      cu.uFar.value = persp.far;
      pass(m.composite, p.composite);
      hdr = p.composite.texture;
    }

    // 3. Dual-filter bloom: 6 downsamples (Karis on the first), 5 tent upsamples.
    let bloomTex: THREE.Texture | null = null;
    if (cfg.bloom.enabled) {
      const du = m.down.uniforms;
      let src: THREE.Texture = hdr;
      let srcW = w;
      let srcH = h;
      p.down.forEach((t, i) => {
        du.tInput.value = src;
        du.uTexel.value.set(1 / srcW, 1 / srcH);
        du.uKaris.value = i === 0 ? 1 : 0;
        pass(m.down, t);
        src = t.texture;
        srcW = t.width;
        srcH = t.height;
      });
      const uu = m.up.uniforms;
      let low = p.down[p.down.length - 1];
      for (let i = p.up.length - 1; i >= 0; i -= 1) {
        uu.tLow.value = low.texture;
        uu.tCur.value = p.down[i].texture;
        uu.uTexel.value.set(1 / low.width, 1 / low.height);
        pass(m.up, p.up[i]);
        low = p.up[i];
      }
      bloomTex = p.up[0].texture;
    }

    // 4. Grade → LDR.
    const gu = m.grade.uniforms;
    gu.tScene.value = hdr;
    gu.tDepth.value = depth;
    gu.tBloom.value = bloomTex ?? hdr;
    pass(m.grade, p.ldr);

    // 5. FXAA + sharpen + grain + dither, upscaled to the drawing buffer.
    const fu = m.final.uniforms;
    fu.tInput.value = p.ldr.texture;
    fu.uTexel.value.set(1 / w, 1 / h);
    fu.uScreen.value.set(drawing.x, drawing.y);
    fu.uTime.value = (fu.uTime.value + Math.min(delta, 0.1)) % 1000;
    pass(m.final, null);

    // Keep perf telemetry/bench budgets about the scene, not the fullscreen passes.
    info.render.calls = sceneCalls;
    info.render.triangles = sceneTriangles;
    info.autoReset = prevAutoReset;
  }
}
