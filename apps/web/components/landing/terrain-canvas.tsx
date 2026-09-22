"use client";

import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import posthog from "posthog-js";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { ModelErrorBoundary } from "@/components/landing/model-error-boundary";
import {
  type HeroModelAsset,
  heroModelExceptionGrouping,
} from "@/components/landing/model-load-report";
import {
  SACRED_VALLEY_GLB,
  SCENE_FAR_PLANE,
  TERRAIN_MODEL_SCALE,
  TERRAIN_SIZE,
} from "@/components/landing/sacred-valley-geometry";
import { SITE_STRUCTURES_GLB } from "@/components/landing/site-structures-place";
import { applyTerrainInk } from "@/components/landing/terrain-shader";

/** Same Draco decoder the lit hero uses — served locally, no CDN at runtime. */
const USE_DRACO = "/draco/";
const USE_MESHOPT = false;

/**
 * The vantage sits INSIDE the terrain's footprint, and circles its centre.
 *
 * Two constraints meet here. The camera has to be inside the tile or there is
 * no foreground: parked outside and looking in, everything between the lens and
 * the tile's near edge is empty space, and that edge projects as a hard
 * horizontal cut with black below it. And because the view now turns all the
 * way round, it has to stay inside at *every* bearing — a circle drawn about
 * the highest massif leaves the tile on one side, 185 units out against a
 * boundary at 92. Around the centre, any radius up to 92 holds.
 */
const ORBIT_RADIUS = 78;

/**
 * How far above the ground under it the eye rides.
 *
 * The camera is inside the range, not above it — that is the only way a peak
 * can stand against black sky — so its height cannot be a constant. Parked at a
 * fixed height it spent whole bearings *inside* a mountain: front faces culled,
 * everything near invisible, and a frame of distant ridges floating over
 * nothing. Riding a clearance above the measured ground keeps it in open air
 * all the way round, and keeps the peaks elsewhere towering over it.
 */
const EYE_CLEARANCE = 22;
/** A floor for the valley bottoms, so the eye never scrapes the river. */
const MIN_EYE = 26;
/** How far below the eye the aim sits: a shallow look across the valley. */
const AIM_DROP = 15;
/**
 * And how far below it looks on a portrait screen.
 *
 * `fov` is vertical, so a tall narrow window frames the same slice of sky as a
 * wide one and stacks it above the range — which on a phone leaves the top
 * third of the hero as empty black while the drawing sits entirely below the
 * middle. Tilting down raises the horizon and gives that band back to the
 * mountains. It moves nothing else: the camera keeps its position, so the
 * vantage and the clearance it rides above the ground are untouched, and
 * landscape is not affected at all.
 */
const AIM_DROP_PORTRAIT = 26;

/**
 * Vertical exaggeration.
 *
 * The corridor is honest terrain: 25 units of relief across 308 of ground, an
 * eight percent rise. Seen from the side that is a crumpled sheet, not a
 * cordillera, and no camera position rescues it — the Andes in a drawing are
 * about as tall as they are wide. The mesh already carries a 2x exaggeration
 * from the build; this takes it to roughly the proportions the eye remembers.
 *
 * Held here rather than pushed further because the camera stands inside the
 * range: every unit of stretch raises the peaks toward the eye, and past this
 * the vantage ends up inside a mountain on some bearings.
 */
const HEIGHT_GAIN = 2.4;

/**
 * Seconds for one revolution.
 *
 * Slow on purpose. This is the page's only autonomous motion and it never
 * stops, so it has to be something the eye can ignore while reading the copy
 * over it — drift, not a carousel. At two and a half minutes a turn the
 * skyline changes shape without ever catching the eye moving.
 */
const TURN_SECONDS = 150;

/** Opening bearing, chosen so the corridor runs across the frame. */
const YAW_REST = -0.35;

const EYE = new THREE.Vector3();
const AIM = new THREE.Vector3();
const VERTEX = new THREE.Vector3();

/** How many bearings the ground profile is sampled at. */
const PROFILE_BINS = 180;
/** Half-width of the ring the profile samples, in scene units. */
const PROFILE_BAND = 10;

/** Half-extent of the tile, which is where the ink has to dissolve. */
const TILE_EXTENT: readonly [number, number] = [
  (TERRAIN_SIZE.width / 2) * TERRAIN_MODEL_SCALE,
  (TERRAIN_SIZE.depth / 2) * TERRAIN_MODEL_SCALE,
];

/**
 * The terrain height around the orbit circle, sampled once from the mesh.
 *
 * Read straight off the position attribute rather than raycast: one pass over
 * the vertices is milliseconds, where 180 rays against a few hundred thousand
 * un-accelerated triangles is seconds of blocked main thread for the same
 * answer. Vertices carry the mesh's own y, so the exaggeration is applied here.
 */
function sampleGroundProfile(
  object: THREE.Object3D,
  radius: number,
  gain: number,
): Float32Array {
  const ground = new Float32Array(PROFILE_BINS);

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const position = child.geometry.getAttribute("position");
    if (!position) {
      return;
    }
    for (let i = 0; i < position.count; i += 1) {
      VERTEX.fromBufferAttribute(position, i);
      if (Math.abs(Math.hypot(VERTEX.x, VERTEX.z) - radius) > PROFILE_BAND) {
        continue;
      }
      // atan2(x, z), matching how the eye is placed from its yaw below.
      const yaw = Math.atan2(VERTEX.x, VERTEX.z);
      let bin = Math.floor(((yaw + Math.PI) / (Math.PI * 2)) * PROFILE_BINS);
      bin = ((bin % PROFILE_BINS) + PROFILE_BINS) % PROFILE_BINS;
      const height = VERTEX.y * gain;
      // The read is written this way because a typed-array index is
      // `number | undefined` under noUncheckedIndexedAccess.
      if (height > (ground[bin] ?? 0)) {
        ground[bin] = height;
      }
    }
  });

  return ground;
}

/** The sampled ground at a bearing, interpolated between bins. */
function groundAt(
  profile: Float32Array | null | undefined,
  yaw: number,
): number {
  if (!profile) {
    return 0;
  }
  const turn = ((yaw + Math.PI) / (Math.PI * 2)) * PROFILE_BINS;
  const low = Math.floor(turn);
  const t = turn - low;
  const a = profile[((low % PROFILE_BINS) + PROFILE_BINS) % PROFILE_BINS] ?? 0;
  const b =
    profile[(((low + 1) % PROFILE_BINS) + PROFILE_BINS) % PROFILE_BINS] ?? 0;
  return a + (b - a) * t;
}

function useInkedGltf(
  url: string,
  options?: Parameters<typeof applyTerrainInk>[1],
) {
  const gltf = useGLTF(url, USE_DRACO, USE_MESHOPT);
  const clone = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    const created = applyTerrainInk(clone, options ?? {});
    return () => {
      for (const material of created) {
        material.dispose();
      }
    };
  }, [clone, options]);

  return clone;
}

function ValleyInk({
  onDrawn,
  profileRef,
}: {
  readonly onDrawn?: () => void;
  readonly profileRef: { current: Float32Array | null };
}) {
  const options = useMemo(
    () => ({ height: HEIGHT_GAIN, extent: TILE_EXTENT }),
    [],
  );
  const clone = useInkedGltf(SACRED_VALLEY_GLB, options);
  const sent = useRef(false);

  useEffect(() => {
    profileRef.current = sampleGroundProfile(clone, ORBIT_RADIUS, HEIGHT_GAIN);
  }, [clone, profileRef]);

  useFrame(() => {
    if (sent.current || !onDrawn) {
      return;
    }
    sent.current = true;
    onDrawn();
  });

  return (
    <primitive
      object={clone}
      scale={[
        TERRAIN_MODEL_SCALE,
        TERRAIN_MODEL_SCALE * HEIGHT_GAIN,
        TERRAIN_MODEL_SCALE,
      ]}
    />
  );
}

function StructuresInk() {
  // Terraces and salt pans carry no drape, so the pen has nothing to trace but
  // their own faceting — which is the point: they read as ruled lines against
  // the mountain's wandering ones.
  const options = useMemo(
    () => ({
      contour: 0.25,
      height: HEIGHT_GAIN,
      shade: 0.2,
      extent: TILE_EXTENT,
    }),
    [],
  );
  const clone = useInkedGltf(SITE_STRUCTURES_GLB, options);
  // Stretched with the terrain it stands on, or it sinks into it.
  return <primitive object={clone} scale={[1, HEIGHT_GAIN, 1]} />;
}

function TurningCamera({
  profileRef,
  reducedMotion,
}: {
  readonly profileRef: { current: Float32Array | null };
  readonly reducedMotion: boolean;
}) {
  const { camera, size } = useThree();
  const yaw = useRef(YAW_REST);
  const eyeHeight = useRef(MIN_EYE);

  useFrame((_, delta) => {
    /*
     * Driven by elapsed time, not by frame count, so the range turns at the
     * same rate on a 120 Hz laptop, a 60 Hz monitor and a throttled background
     * tab. Reduced motion parks it at the opening bearing rather than slowing
     * it down: a turn this slow is still a turn, and the setting asks for none.
     */
    if (!reducedMotion) {
      yaw.current += (delta * Math.PI * 2) / TURN_SECONDS;
    }

    const wanted = Math.max(
      MIN_EYE,
      groundAt(profileRef.current, yaw.current) + EYE_CLEARANCE,
    );
    // Eased: the ground under the orbit rises and falls by tens of units, and
    // tracking it exactly makes the turn heave.
    eyeHeight.current += (wanted - eyeHeight.current) * 0.08;

    EYE.set(
      Math.sin(yaw.current) * ORBIT_RADIUS,
      eyeHeight.current,
      Math.cos(yaw.current) * ORBIT_RADIUS,
    );
    camera.position.copy(EYE);
    /*
     * Aimed across the valley at the eye's own height, less a shallow drop. A
     * turntable pointed at the summit would swing it across the frame once a
     * revolution, which reads as the mountain sliding rather than the world
     * turning.
     */
    const drop = size.height > size.width ? AIM_DROP_PORTRAIT : AIM_DROP;
    AIM.set(0, eyeHeight.current - drop, 0);
    camera.lookAt(AIM);
  });

  return null;
}

/**
 * Report a hero mesh that failed to load. The boundary swallows the error, so
 * without this the fall-through is invisible: no exception reaches error
 * tracking, and there is no counterpart to the drawn event to measure a
 * fall-through rate against.
 *
 * The exception carries a fixed fingerprint keyed on the asset, so the same
 * flaky network no longer opens a fresh error-tracking issue per browser
 * family — see `heroModelExceptionGrouping`.
 */
function reportModelLoadFailure(model: HeroModelAsset) {
  return (error: unknown, attempt: number) => {
    posthog.capture("hero_terrain_load_failed", { model, attempt });
    posthog.captureException(error, {
      hero_model: model,
      attempt,
      ...heroModelExceptionGrouping(model),
    });
  };
}

export type TerrainCanvasProps = {
  readonly quality: "low" | "high";
  readonly reducedMotion?: boolean;
  /** False parks the frame loop: the hero is off screen or the tab is hidden. */
  readonly running?: boolean;
  readonly onContextLost?: () => void;
  readonly onDrawn?: () => void;
};

export function TerrainCanvas({
  quality,
  reducedMotion = false,
  running = true,
  onContextLost,
  onDrawn,
}: TerrainCanvasProps) {
  const profileRef = useRef<Float32Array | null>(null);

  return (
    /*
     * Takes no pointer events at all. The range used to be dragged; it turns on
     * its own now, and a canvas that still swallowed gestures would only mean a
     * reader on a phone finding a dead zone where the page would not scroll.
     */
    <div className="pointer-events-none absolute inset-0 size-full">
      <Canvas
        camera={{
          far: SCENE_FAR_PLANE,
          fov: 58,
          near: 1,
          position: [0, MIN_EYE, ORBIT_RADIUS],
        }}
        className="absolute inset-0 size-full"
        dpr={quality === "high" ? [1, 1.5] : [1, 1]}
        /*
         * The turn never ends, so something has to stop it. Left running, a
         * canvas this size would keep a GPU busy drawing a range nobody is
         * looking at for the whole length of the page, and go on doing it in a
         * background tab.
         */
        frameloop={running ? "always" : "never"}
        gl={{
          alpha: true,
          antialias: quality === "high",
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          // No tone mapping: the drawing is ink on transparent, and a film
          // curve applied to "how much ink" means nothing.
          gl.toneMapping = THREE.NoToneMapping;
          gl.setClearColor("#000000", 0);
          gl.domElement.addEventListener(
            "webglcontextlost",
            (event) => {
              event.preventDefault();
              onContextLost?.();
            },
            { once: true },
          );
        }}
      >
        <TurningCamera profileRef={profileRef} reducedMotion={reducedMotion} />
        <ModelErrorBoundary
          fallback={null}
          onError={reportModelLoadFailure("sacred-valley")}
          onRetry={() => useGLTF.clear(SACRED_VALLEY_GLB)}
        >
          <Suspense fallback={null}>
            <ValleyInk onDrawn={onDrawn} profileRef={profileRef} />
          </Suspense>
        </ModelErrorBoundary>
        <ModelErrorBoundary
          fallback={null}
          onError={reportModelLoadFailure("site-structures")}
          onRetry={() => useGLTF.clear(SITE_STRUCTURES_GLB)}
        >
          <Suspense fallback={null}>
            <StructuresInk />
          </Suspense>
        </ModelErrorBoundary>
      </Canvas>
    </div>
  );
}

/** Warm the drei cache after capability gating, never at module evaluate. */
export function preloadHeroTerrain(): void {
  useGLTF.preload(SACRED_VALLEY_GLB, USE_DRACO, USE_MESHOPT);
  useGLTF.preload(SITE_STRUCTURES_GLB, USE_DRACO, USE_MESHOPT);
}
