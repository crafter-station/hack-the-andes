"use client";

/**
 * The credential, hung from a simulated lanyard.
 *
 * Adapted from the implementation already shipping in
 * crafter-station/badge-creator, which is the react-bits Lanyard: a rope of
 * rapier joints, a meshline band carrying a printed texture, and the card
 * itself as a glTF mesh. The model (`/card.glb`) carries three meshes — the
 * card, the clip and the clamp — so the D-ring and the swivel hook are
 * geometry rather than something drawn by hand.
 *
 * Three things this buys that a DOM version could not, and they are exactly
 * the three that were wrong before:
 *
 * - the band is a textured ribbon, not a stroked path;
 * - the card hangs from a spherical joint above its own centre, so it swings
 *   from the grommet instead of spinning about its middle;
 * - the drag moves the *card*, with the grab offset preserved, while the
 *   rope's fixed end stays put.
 */

import { brandColors } from "@chofex/ui/lib/brand-theme";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { Canvas, extend, useFrame } from "@react-three/fiber";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

extend({ MeshLineGeometry, MeshLineMaterial });

const CARD_MODEL = "/card.glb";

const colors = brandColors.dark;

/**
 * The webbing: charcoal, with the mountain mark printed up it.
 *
 * Two earlier versions were wrong in opposite directions. The first drew
 * the strap in the page's own near-black and it was simply invisible. The
 * second made it bone, which was legible but is not the object — the
 * design has dark webbing with a white mark, and a pale ribbon reads as a
 * different product.
 *
 * What makes the dark strap visible is the mark, not the cloth: a repeated
 * white triangle carries at a strap's width where fourteen characters of
 * an event name never could, which is why this stopped printing the name.
 */
const WEBBING = "#17161b";

interface CredentialLanyard3DProps {
  /** The card's face, as an image. Falls back to the model's baked texture. */
  readonly faceUrl?: string;
  /** Fired once the context exists, so the static layer knows to step aside. */
  readonly onReady?: () => void;
}

export function CredentialLanyard3D({
  faceUrl,
  onReady,
}: CredentialLanyard3DProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const notify = () => setIsMobile(media.matches);
    notify();
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, []);

  return (
    <div className="credential-canvas">
      <Canvas
        /*
          Close enough that the card is the subject.

          The rope is anchored at y=4, above the top of the frame on
          purpose: a strap whose end is visible reads as a stubby ribbon
          hanging from nothing, where one cut by the frame reads as webbing
          that continues past it. Tuned by rendering and looking — at
          z=15 the card came to about a third of the canvas's height.
        */
        camera={{ position: [0, 1.25, 11], fov: 22 }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearAlpha(0);
          onReady?.();
        }}
      >
        {/*
          Low, because the card is meant to be near-black.

          Inherited at `Math.PI` from the model this was adapted from,
          where the card is a bright printed face. Three units of flat
          ambient lifts a #141510 sheet to a mid grey and the credential
          stops being a dark object in a dark room. The environment below
          does the shaping; this only keeps the shadows off pure black.
        */}
        <ambientLight intensity={0.55} />
        <Physics gravity={[0, -40, 0]} timeStep={isMobile ? 1 / 30 : 1 / 60}>
          <Band faceUrl={faceUrl} isMobile={isMobile} />
        </Physics>
        {/*
          A synthetic environment rather than an HDR file: four strip lights
          are enough to make the clip read as metal, and they cost no asset.
        */}
        <Environment blur={0.75}>
          <Lightformer
            color="white"
            intensity={2}
            position={[0, -1, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            color="white"
            intensity={3}
            position={[-1, -1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            color="white"
            intensity={3}
            position={[1, 1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          {/*
            The key light, and the last thing lifting the card off black.
            At 10 — the value inherited from the model this was adapted
            from — its reflection in the lamination washes a #141510 sheet
            to a mid grey however low the ambient goes.
          */}
          <Lightformer
            color="white"
            intensity={4}
            position={[-10, 0, 14]}
            rotation={[0, Math.PI / 2, Math.PI / 3]}
            scale={[100, 10, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
}

const MAX_SPEED = 50;
const MIN_SPEED = 0;

interface BandProps {
  readonly faceUrl?: string;
  readonly isMobile: boolean;
}

function Band({ faceUrl, isMobile }: BandProps) {
  // biome-ignore lint/suspicious/noExplicitAny: rapier's ref types are internal
  const band = useRef<any>(null);
  // biome-ignore lint/suspicious/noExplicitAny: rapier's ref types are internal
  const fixed = useRef<any>(null);
  // biome-ignore lint/suspicious/noExplicitAny: rapier's ref types are internal
  const j1 = useRef<any>(null);
  // biome-ignore lint/suspicious/noExplicitAny: rapier's ref types are internal
  const j2 = useRef<any>(null);
  // biome-ignore lint/suspicious/noExplicitAny: rapier's ref types are internal
  const j3 = useRef<any>(null);
  // biome-ignore lint/suspicious/noExplicitAny: rapier's ref types are internal
  const card = useRef<any>(null);

  const vec = useMemo(() => new THREE.Vector3(), []);
  const ang = useMemo(() => new THREE.Vector3(), []);
  const rot = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const segmentProps = {
    type: "dynamic" as const,
    canSleep: true,
    colliders: false as const,
    angularDamping: 4,
    linearDamping: 4,
  };

  // biome-ignore lint/suspicious/noExplicitAny: useGLTF's node map is untyped
  const { nodes, materials } = useGLTF(CARD_MODEL) as any;

  /**
   * The webbing, drawn rather than shipped as an asset.
   *
   * A 512×64 strip repeated twice down the band: charcoal cloth, a darker
   * selvedge at each edge, and the mountain mark printed up it.
   */
  const bandTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.fillStyle = WEBBING;
    context.fillRect(0, 0, 512, 64);

    // Selvedge: a real strap is denser at its edges and catches less light.
    context.fillStyle = colors.paper;
    context.fillRect(0, 0, 512, 5);
    context.fillRect(0, 59, 512, 5);

    /*
      The mountain, repeated up the strip.

      Drawn turned a quarter turn like everything printed on webbing, so
      the peak points along the strap rather than across it. Small and
      often rather than large and sparse: at the size the band renders,
      the first version's marks filled the strap's whole width and read as
      solid blocks with gaps, not as a printed pattern.
    */
    context.fillStyle = colors.ink;
    for (let x = 48; x <= 512; x += 96) {
      context.save();
      context.translate(x, 32);
      context.rotate(-Math.PI / 2);
      context.beginPath();
      context.moveTo(0, -13);
      context.lineTo(12, 9);
      context.lineTo(-12, 9);
      context.closePath();
      context.fill();
      context.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, []);

  const [face, setFace] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!faceUrl) {
      setFace(null);
      return;
    }
    let live = true;
    const loader = new THREE.TextureLoader();
    loader.load(faceUrl, (loaded) => {
      if (!live) {
        loaded.dispose();
        return;
      }
      loaded.flipY = false;
      loaded.colorSpace = THREE.SRGBColorSpace;
      /*
        The one it replaces is disposed here, not left to the collector.

        A GPU texture is not ordinary memory: dropping the last reference
        frees the JavaScript object and leaves the upload on the card. It
        never mattered while the face was set once per page, and the
        picker changes it every few hundred milliseconds — an afternoon of
        trying hairstyles would have leaked a 1600x1475 texture per try.
      */
      setFace((previous) => {
        previous?.dispose();
        return loaded;
      });
    });
    return () => {
      live = false;
    };
  }, [faceUrl]);

  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
  );
  const [dragged, drag] = useState<false | THREE.Vector3>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  // The pivot that makes it swing rather than spin: 1.45 above the card's
  // centre is where the grommet is punched.
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, 1.45, 0],
  ]);

  useEffect(() => {
    if (!hovered) {
      return;
    }
    document.body.style.cursor = dragged ? "grabbing" : "grab";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      for (const ref of [card, j1, j2, j3, fixed]) {
        ref.current?.wakeUp();
      }
      // The grab offset is what stops the card snapping its centre to the
      // cursor the instant it is touched.
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }

    if (!fixed.current) {
      return;
    }

    for (const ref of [j1, j2]) {
      if (!ref.current.lerped) {
        ref.current.lerped = new THREE.Vector3().copy(
          ref.current.translation(),
        );
      }
      const clamped = Math.max(
        0.1,
        Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())),
      );
      ref.current.lerped.lerp(
        ref.current.translation(),
        delta * (MIN_SPEED + clamped * (MAX_SPEED - MIN_SPEED)),
      );
    }

    // Destructured rather than indexed: the repo enables
    // noUncheckedIndexedAccess, and the guard is honest anyway — the curve is
    // built with exactly these four and nothing else writes to it.
    const [tip, mid, high, top] = curve.points;
    if (!tip || !mid || !high || !top) {
      return;
    }
    tip.copy(j3.current.translation());
    mid.copy(j2.current.lerped);
    high.copy(j1.current.lerped);
    top.copy(fixed.current.translation());
    band.current.geometry.setPoints(curve.getPoints(isMobile ? 16 : 32));

    // Bleeds the spin out of the card so it settles facing forward instead
    // of slowly rotating away from the reader.
    ang.copy(card.current.angvel());
    rot.copy(card.current.rotation());
    card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
  });

  curve.curveType = "chordal";

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            onPointerDown={(event) => {
              (event.target as Element).setPointerCapture(event.pointerId);
              drag(
                new THREE.Vector3()
                  .copy(event.point)
                  .sub(vec.copy(card.current.translation())),
              );
            }}
            onPointerOut={() => hover(false)}
            onPointerOver={() => hover(true)}
            onPointerUp={(event) => {
              (event.target as Element).releasePointerCapture(event.pointerId);
              drag(false);
            }}
            position={[0, -1.2, -0.05]}
            scale={2.25}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                clearcoat={isMobile ? 0 : 1}
                clearcoatRoughness={0.15}
                map={face ?? materials.base.map}
                map-anisotropy={16}
                /*
                  A laminated badge is a dielectric, so metalness is zero.
                  Inherited as 0.8 from the model this was adapted from,
                  where it is the setting for the metal clip: on the card it
                  routes the whole albedo through a metallic response and
                  returns a grey slab no matter what the texture says.
                  The gloss belongs to the clearcoat above, which is the
                  lamination.
                */
                metalness={0}
                roughness={0.45}
              />
            </mesh>
            {/*
              Polished chrome, and each mesh gets its own material.

              The model ships one `metal` material shared by the hook and
              the clamp, so setting `material-roughness` on one of them
              mutated it for both — and it arrived dark anyway, because a
              metal surface has no diffuse colour of its own and returns
              only what the environment gives it. These declare the finish
              and turn the environment up until it reads as the polished
              swivel hook in the reference rather than a black blob.
            */}
            <mesh geometry={nodes.clip.geometry}>
              <meshStandardMaterial
                color="#e9e9ee"
                envMapIntensity={3.2}
                metalness={1}
                roughness={0.16}
              />
            </mesh>
            <mesh geometry={nodes.clamp.geometry}>
              <meshStandardMaterial
                color="#d8d8dd"
                envMapIntensity={2.6}
                metalness={1}
                roughness={0.24}
              />
            </mesh>
          </group>
        </RigidBody>
      </group>

      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest={false}
          /*
            Measured against the reference photograph rather than judged:
            its webbing is 57px across a card 263px wide, so the strap is
            0.217 of the card. 1.3 gave 0.156, which reads as a cord
            rather than as a strap, and 1.8 overshot to 0.30.
          */
          lineWidth={1.5}
          map={bandTexture}
          repeat={[-2, 1]}
          resolution={isMobile ? [1000, 2000] : [1000, 1000]}
          useMap
        />
      </mesh>
    </>
  );
}

useGLTF.preload(CARD_MODEL);
