import { useGLTF } from '@react-three/drei';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import {
  STATIC_POSE_TIME_SEC,
  buildLiveActorDefinitions,
} from '../renderers/actors/liveActorsConfig';
import type { HumanAssets } from '../renderers/actors/humanAppearance';
import {
  HUMAN_ASSET_URLS,
  isRiggedActivity,
  setRiggedActorIds,
} from '../renderers/actors/riggedActors';
import type { SceneDoc } from '../scene/schema';
import { SOL_CENTER_SCENE } from '../scene/solCenter.scene';
import { useExploreStore } from '../state/exploreStore';
import {
  configureSkinTexture,
  createRiggedInstance,
  disposeInstance,
  isWalkFloorAdjacent,
  placeInstance,
  stepInstance,
  type RiggedInstance,
} from './riggedInstance';
import { useActorMotion } from './useActorMotion';

/** Props của nhân vật có xương: cảnh và cờ benchmark. */
export interface RiggedActorsProps {
  scene?: SceneDoc;
  benchEnabled?: boolean;
}

/** Bước thời gian tối đa truyền cho các mixer để khoảng nghỉ dài trong vòng lặp theo yêu cầu (demand loop) không làm nhảy cóc tư thế. */
const MAX_STEP_SEC = 0.1;

/** Error boundary: nếu tải mô hình nhân vật lỗi thì không hiển thị gì thay vì làm hỏng cảnh. */
class RiggedErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[explore3d] Rigged characters failed to load, keeping procedural actors.', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Phần dựng nhân vật có xương: tải các mô hình, kiểu tóc, hoạt ảnh và texture da rồi dựng và chạy hoạt ảnh cho
 * các hoạt động có người.
 */
function RiggedActorsInner({ scene = SOL_CENTER_SCENE, benchEnabled = false }: RiggedActorsProps) {
  const hairNames = Object.keys(HUMAN_ASSET_URLS.hair) as (keyof typeof HUMAN_ASSET_URLS.hair)[];
  const gltfs = useGLTF(
    [
      HUMAN_ASSET_URLS.male,
      HUMAN_ASSET_URLS.female,
      HUMAN_ASSET_URLS.animations,
      ...hairNames.map(name => HUMAN_ASSET_URLS.hair[name]),
    ],
    false,
  );
  const skinTextures = useLoader(THREE.TextureLoader, [
    HUMAN_ASSET_URLS.skinLight.male,
    HUMAN_ASSET_URLS.skinLight.female,
  ]);
  const levelMode = useExploreStore(s => s.levelMode);
  const walkMode = useExploreStore(s => s.walkMode);
  const focusLevel = useExploreStore(s => s.focusLevel);
  const invalidate = useThree(s => s.invalidate);
  const { shouldAnimate } = useActorMotion(benchEnabled);

  const effectiveLevelMode = walkMode ? 'stacked' : levelMode;

  // Gom các tài nguyên người (nhân vật, tóc, da) và các clip hoạt ảnh.
  const assets = useMemo(() => {
    const humans: HumanAssets = {
      characters: { male: gltfs[0]!.scene, female: gltfs[1]!.scene },
      hair: Object.fromEntries(hairNames.map((name, i) => [name, gltfs[3 + i]!.scene])),
      skinLight: { male: configureSkinTexture(skinTextures[0]!), female: configureSkinTexture(skinTextures[1]!) },
    };
    return { humans, clips: gltfs[2]!.animations };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltfs, skinTextures]);

  const [instances, setInstances] = useState<RiggedInstance[]>([]);

  useEffect(() => {
    const view = useExploreStore.getState();
    const effMode = view.walkMode ? 'stacked' : view.levelMode;
    const created: RiggedInstance[] = [];
    for (const def of buildLiveActorDefinitions(scene)) {
      if (!isRiggedActivity(def.activity)) continue;
      const instance = createRiggedInstance(def, assets);
      if (!instance) continue;
      // Tạo tư thế cho nhân vật một lần để trạng thái giảm chuyển động / tiết kiệm năng lượng hiển thị khung hình hợp lý.
      const pose = placeInstance(
        instance,
        scene,
        effMode,
        view.focusLevel,
        STATIC_POSE_TIME_SEC,
        view.walkMode,
      );
      stepInstance(instance, 0, pose, STATIC_POSE_TIME_SEC);
      created.push(instance);
    }
    setInstances(created);
    setRiggedActorIds(created.map(instance => instance.def.id));
    invalidate();
    return () => {
      setRiggedActorIds([]);
      setInstances([]);
      for (const instance of created) disposeInstance(instance);
    };
  }, [scene, assets, invalidate]);

  // Giữ mỗi nhân vật đúng tầng của mình, kể cả khi chồng tầng tách ra hay thu gọn lại.
  useLayoutEffect(() => {
    for (const instance of instances) {
      placeInstance(
        instance,
        scene,
        effectiveLevelMode,
        focusLevel,
        STATIC_POSE_TIME_SEC,
        walkMode,
      );
    }
    invalidate();
  }, [instances, scene, effectiveLevelMode, walkMode, focusLevel, invalidate]);

  useFrame(({ clock }, delta) => {
    if (!shouldAnimate || instances.length === 0) return;
    const step = Math.min(delta, MAX_STEP_SEC);
    const timeSec = STATIC_POSE_TIME_SEC + clock.getElapsedTime();
    for (const instance of instances) {
      if (walkMode && !isWalkFloorAdjacent(instance.def.level, focusLevel)) continue;
      if (!instance.holder.visible) continue;
      const pose = placeInstance(
        instance,
        scene,
        effectiveLevelMode,
        focusLevel,
        timeSec,
        walkMode,
      );
      stepInstance(instance, step, pose, timeSec);
    }
    invalidate();
  });

  if (instances.length === 0) return null;

  return (
    <group name="sol-rigged-actors">
      {instances.map(({ def, holder }) => (
        <primitive key={def.id} object={holder} />
      ))}
    </group>
  );
}

/**
 * Nhân vật có xương cho mọi hoạt động có người; bọc trong error boundary và Suspense.
 */
export function RiggedActors(props: RiggedActorsProps) {
  return (
    <RiggedErrorBoundary>
      <Suspense fallback={null}>
        <RiggedActorsInner {...props} />
      </Suspense>
    </RiggedErrorBoundary>
  );
}

export default RiggedActors;
