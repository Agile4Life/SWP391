import * as THREE from 'three';

/**
 * Three r187's PCF filter takes 5 Vogel-disk taps. Following the Saltline PCSS
 * notes we widen it to 4 IGN-rotated Vogel taps (each a hardware 2×2 compare,
 * ≈48 filtered samples) and fade the shadow out near the shadow-map border so the
 * frustum edge never shows as a hard line. Patched once, before any program compiles.
 */
export const SOFT_SHADOW_TAPS = 4;

const PCF_BLOCK =
  /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0, 5, phi \) \* radius, shadowCoord\.z \) \)[\s\S]*?\) \* 0\.2;/;

const SOFT_BLOCK = `shadow = 0.0;
				for ( int i = 0; i < ${SOFT_SHADOW_TAPS}; i ++ ) {
					shadow += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, ${SOFT_SHADOW_TAPS}, phi ) * radius, shadowCoord.z ) );
				}
				shadow /= float( ${SOFT_SHADOW_TAPS} );
				vec2 slEdge = min( shadowCoord.xy, 1.0 - shadowCoord.xy );
				shadow = mix( 1.0, shadow, smoothstep( 0.0, 0.02, min( slEdge.x, slEdge.y ) ) );`;

let patched = false;

export function patchSoftShadowChunk(chunks: Record<string, string> = THREE.ShaderChunk): boolean {
  if (patched && chunks === THREE.ShaderChunk) return true;
  const source = chunks.shadowmap_pars_fragment;
  if (typeof source !== 'string' || !PCF_BLOCK.test(source)) return false;
  chunks.shadowmap_pars_fragment = source.replace(PCF_BLOCK, SOFT_BLOCK);
  if (chunks === THREE.ShaderChunk) patched = true;
  return true;
}
