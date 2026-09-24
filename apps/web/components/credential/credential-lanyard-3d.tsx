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
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { MOUNTAIN_ASPECT, traceMountain } from "./mountain-mark";

extend({ MeshLineGeometry, MeshLineMaterial });

const CARD_MODEL = "/card.glb";

const colors = brandColors.dark;

/**
 * The webbing: charcoal twill, with a checkerboard walking down it.
 *
 * Two earlier versions were wrong in opposite directions. The first drew
 * the strap in the page's own near-black and it was simply invisible. The
 * second made it bone, which was legible but is not the object — the
 * design has dark webbing with a white mark, and a pale ribbon reads as a
 * different product.
 *
 * What makes the dark strap visible is the pattern, not the cloth: a
 * field of squares carries at a strap's width where fourteen characters
 * of an event name never could, which is why this stopped printing the
 * name.
 */
const WEBBING = "#1d1c22";

/**
 * How long each of the three rope segments is, and where the top is tied.
 *
 * The anchor has to sit a whole rope's length above the card or the card
 * hangs off the bottom of the frame, so the two move together: lengthen
 * the rope and the anchor rises by the same amount.
 *
 * Lengthened from 1 so the strap has room to carry the wordmark above
 * the checkerboard. At the old length the band was under four
 * strap-widths end to end and barely one was ever in frame.
 */
const ROPE = 2;
const ANCHOR = 1 + ROPE * 3;

/**
 * How much of the rig the frame holds, tuned by rendering and looking.
 *
 * The reference hangs the card in the lower half with the strap filling
 * the upper, so the frame has to grow along with the rope or the extra
 * webbing all sits above the top edge where nobody sees it.
 */
const CAMERA_Y = 2.2;
const CAMERA_FOV = 25;

/**
 * How far the whole rig hangs below the point the camera looks at.
 *
 * The camera aims at the origin, so a rig centred there puts the card in
 * the middle of the frame with dead space under it and the new webbing
 * all above the top edge. Dropping the rig spends that dead space on
 * strap instead, which is the arrangement the reference has: card low,
 * webbing filling everything above it.
 */
const RIG_DROP = 0.85;

/**
 * The warp rib, and the shadow under it.
 *
 * Stronger than a twill looks up close, because almost none of it
 * survives: the strip is minified six-fold onto the strap, and a rib at
 * the contrast a photograph shows averaged away to flat black in the
 * render. What reads as cloth at 88 pixels is not what reads as cloth at
 * arm's length.
 */
const RIB_LIGHT = "rgba(255, 255, 255, 0.16)";
const RIB_SHADOW = "rgba(0, 0, 0, 0.22)";

/**
 * How much of the strap's width the texture spans, in texture pixels.
 *
 * The strap renders about 88px across, so this is a six-fold oversample —
 * enough that the diagonal ribs survive the minification without moiré.
 */
const BAND_ACROSS = 256;

/**
 * The whole band's length, in strap widths.
 *
 * `meshLineMaterial` runs u along the line and v across it, and the two
 * are not to the same scale: the band is long and thin, so the texture
 * covers far more world length than the strap has width. Sizing the
 * canvas by this ratio is what makes a texture pixel square on the
 * cloth, and every drawing here is laid out in strap widths because of
 * it.
 *
 * It is a property of the rig, so it is re-measured whenever the rope,
 * the camera or the strap's width changes — and measured, not derived:
 * three attempts to work it out from the geometry all came back wrong.
 * What settles it is a rendered square. Whatever value makes the
 * checkerboard's squares come back square is the right one.
 *
 * Getting it wrong does not fail, it stretches, which is why it kept
 * surviving: the texture spreads over the true length either way, so
 * squares arrive as rectangles and the checkerboard's diagonal
 * flattens. A zigzag that climbs two squares reads as drifting one when
 * the squares are half again as long as they are wide, and that is what
 * got reported.
 */
const BAND_WIDTHS = 18.4;

/**
 * One texture over the whole band, rather than two copies of half of it.
 *
 * The pattern is a composition with a direction, not a tile: a zigzag
 * that bounces off both edges. At two repeats the squares had to divide
 * a half-band exactly or the zigzag broke mid-bounce at the seam, and
 * the nearest size that divided was a quarter under the design's.
 */
const BAND_REPEATS = 1;
const BAND_ALONG = Math.round((BAND_ACROSS * BAND_WIDTHS) / BAND_REPEATS);

/**
 * One twill repeat: a lit rib and its shadow.
 *
 * Taken as a fraction of the strap's width rather than as a pixel count,
 * because it is the only thing here that has to stay put when the
 * texture's resolution changes. Halving `BAND_ACROSS` once doubled the
 * weave's coarseness without anybody asking it to.
 */
const RIB_PITCH = Math.round(BAND_ACROSS * 0.039);

/**
 * The checkerboard that walks down the strap.
 *
 * Measured off the proposal rather than judged: on a strap 70px across
 * its squares are 18.5 — 0.264 of the width — laid in three columns, and
 * each square meets the last at a corner, so the run reads as one zigzag
 * ribbon rather than as scattered tiles.
 *
 * The square is sized from the design and the run is counted from it,
 * rather than the other way round. While the checkerboard tiled the
 * whole band its size had to divide the band exactly — a whole number
 * of bounces or the zigzag broke where the texture met itself — and it
 * never landed on the design's. Now the band carries a composition with
 * a beginning and an end, so the run just stops, and the square is the
 * design's 0.264.
 *
 * Fourteen squares, counted off the reference. It opens on the low
 * column so the run climbs two before it turns, the way that one does.
 */
const CHECKER_COLUMNS = 3;
const SQUARE = Math.round(BAND_ACROSS * 0.264);
const CHECKER_SQUARES = 14;
/**
 * Which column each square sits in.
 *
 * Out to the far column and back, which is a period of four across three
 * columns. A sawtooth — 0, 1, 2, 0 — would jump the full width every
 * third square and read as a broken pattern rather than a bounce.
 */
const CHECKER_PATH = [0, 1, 2, 1] as const;

/**
 * Where the strap's furniture sits, in strap widths from the clip.
 *
 * Measured off the reference, which gives the clip about a width of bare
 * webbing, then the checkerboard, then the lockup running on up. The
 * texture's own x runs the other way — x zero is the anchor, which a
 * render settled — so these are subtracted rather than added.
 */
const RING_PLAIN = 1.1;
const WORDMARK_GAP = 0.3;

/**
 * The lockup along the strap, at the reference's own proportions.
 *
 * Its capitals stand about a third of the strap's width, which is where
 * the reference has them — a small lockup on a lot of cloth, not a
 * headline.
 *
 * This was 0.8 for two rounds because the measurement that set it was
 * reading the wrong thing: the band of ink I took for the lettering in
 * the reference was the checkerboard, which really is that wide. The
 * letters sit above it and are less than half its size. Cropping both
 * straps to the same width and putting them side by side is what
 * settled it, and is the only comparison worth trusting here — a
 * threshold over a soft-lit mockup reads anything from 0.3 to 1.0
 * depending on where it is set.
 */
const WORDMARK = "HACK THE ANDES";
const WORDMARK_CAP = 0.28;
/**
 * Stack Sans Notch's capitals, as a fraction of the em.
 *
 * Measured through satori on the TrueType file. The browser draws the
 * variable web font and comes out about a fifth larger, so what the
 * render shows is the number that matters — this only has to be close
 * enough that the cap above means roughly what it says.
 */
const NOTCH_CAP = 0.74;
const WORDMARK_SIZE = Math.round((BAND_ACROSS * WORDMARK_CAP) / NOTCH_CAP);
/**
 * The mark that opens it, measured across the strap like everything else.
 *
 * `traceMountain` is given a width, and the drawing is turned, so the
 * width it wants is this times the mark's own aspect — the first version
 * passed the across-size as the width and drew a mountain a third too
 * small.
 */
const MOUNTAIN_ACROSS = Math.round(BAND_ACROSS * 0.25);
const MOUNTAIN_ALONG = Math.round(MOUNTAIN_ACROSS * MOUNTAIN_ASPECT);

/**
 * A denser, unlit border along each edge of the strap.
 *
 * Its own dark rather than the page's: painted in `paper` it vanished
 * against the background, so the strap read as the 86% of itself that
 * is between the selvedges. Everything on the cloth is sized as a
 * fraction of the strap's width, so an invisible edge makes every mark
 * look a seventh too big — which is how the checkerboard came to seem
 * oversized when it was at the design's own 0.264.
 */
const SELVEDGE_INK = "#0f0e13";
const SELVEDGE = Math.round(BAND_ACROSS * 0.07);

interface CredentialLanyard3DProps {
  /**
   * The card's face, as an image.
   *
   * Without one the mesh wears what `card.glb` was exported with, which is
   * the demo card the model came from — someone else's product name on a
   * participant's credential. Nothing in production omits this; the guard
   * is that `onReady` waits for it.
   */
  readonly faceUrl?: string;
  /**
   * Fired once there is something of ours to look at, so the static layer
   * knows to step aside.
   *
   * Not when the context is created. That is what it used to be, and the
   * canvas exists a good deal earlier than the face does: the static card
   * stepped aside on an empty scene and the baked demo texture showed
   * through the gap. If the face never arrives this never fires, and the
   * static card — which carries the same name, role and picture as real
   * markup — is what stays.
   */
  readonly onReady?: () => void;
}

export function CredentialLanyard3D({
  faceUrl,
  onReady,
}: CredentialLanyard3DProps) {
  /*
    Both have to be true before the static card is allowed to go. A
    context with no face is the demo card; a face with no context is
    nothing at all.
  */
  const [contextReady, setContextReady] = useState(false);
  const [faceReady, setFaceReady] = useState(false);
  /*
    Stable, because the texture effect depends on it. An arrow written at
    the call site is a new function every render, which would re-run that
    effect and re-fetch a 1600x1475 face on each one.
  */
  const reportFaceReady = useCallback(() => setFaceReady(true), []);
  useEffect(() => {
    if (contextReady && (faceReady || !faceUrl)) {
      onReady?.();
    }
  }, [contextReady, faceReady, faceUrl, onReady]);
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
        camera={{ position: [0, CAMERA_Y, 11], fov: CAMERA_FOV }}
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearAlpha(0);
          setContextReady(true);
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
          <Band
            faceUrl={faceUrl}
            isMobile={isMobile}
            onFaceReady={reportFaceReady}
          />
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
  /** Called once the card is wearing our own face and not the model's. */
  readonly onFaceReady: () => void;
  readonly isMobile: boolean;
}

function Band({ faceUrl, isMobile, onFaceReady }: BandProps) {
  /*
    The real canvas, not a guess at it.

    `meshLineMaterial` converts its `lineWidth` through this, so a
    hardcoded pair means the strap keeps one width in pixels while
    everything else grows with the canvas. On a tall window the card came
    out half again as big and the strap stayed 36px, which made the strap
    relatively narrower — and the strap's width is the unit the whole
    texture is laid out in, so the checkerboard stretched along the band
    on exactly the screens nobody was testing on.
  */
  const size = useThree((state) => state.size);
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
   * One strip repeated down the band: charcoal cloth, the mountain woven
   * up it, a diagonal twill crossing both, and a darker selvedge at each
   * edge. Sized so a texture pixel is square on the strap — see
   * `ALONG_PER_ACROSS`.
   */
  const [bandTexture, setBandTexture] = useState<THREE.CanvasTexture | null>(
    null,
  );

  /*
    Built in an effect rather than a memo because it waits for a font.

    The lockup is set in the brand face, and a canvas asked for a family
    the browser has not finished fetching draws the fallback and is never
    told to redraw — the strap would carry the wrong letters for the rest
    of the session, and only on a cold load, which is the kind of bug
    that never reproduces while you are looking for it.
  */
  useEffect(() => {
    let live = true;
    let built: THREE.CanvasTexture | null = null;

    const build = async () => {
      /*
        `next/font` hashes the family it generates, so the name only
        exists at runtime. The variable the root element carries is the
        one thing that names it in both CSS and here.
      */
      const family =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--font-hta-brand")
          .trim() || "sans-serif";
      const font = `700 ${WORDMARK_SIZE}px ${family}`;
      try {
        await document.fonts.load(font, WORDMARK);
      } catch {
        // A face that will not load still draws, in whatever the browser
        // falls back to. A blank strap would be worse than a plain one.
      }
      if (!live) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = BAND_ALONG;
      canvas.height = BAND_ACROSS;
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      const { width, height } = canvas;

      context.fillStyle = WEBBING;
      context.fillRect(0, 0, width, height);
      context.fillStyle = colors.ink;

      /*
        The checkerboard, walking down the strap.

        Squares rather than the event's mountain, which is what this drew
        before: a silhouette repeated small does not carry at a strap's
        width, and a square field does.

        Laid from the clip upward, and opening on a climb: the first
        square sits in the low column and the run rises two before it
        turns, which is the figure the reference makes.

        Drawn before the weave so the ribs cross it — that is the whole
        difference between a pattern woven into cloth and one laid on it.
      */
      const inset = (height - CHECKER_COLUMNS * SQUARE) / 2;
      const checkerEnd = width - RING_PLAIN * BAND_ACROSS;
      for (let i = 0; i < CHECKER_SQUARES; i += 1) {
        const column = CHECKER_PATH[i % CHECKER_PATH.length] ?? 0;
        const along = checkerEnd - (i + 1) * SQUARE;
        context.fillRect(along, inset + column * SQUARE, SQUARE, SQUARE);
      }

      /*
        The lockup, running up the strap.

        Drawn without rotating: the texture's x is the axis that runs
        along the band, so letters set the ordinary way in texture space
        come out reading up the cloth, which is how a lanyard is printed.
        Turned a half turn so it advances toward the anchor and its first
        glyph — the mountain — lands nearest the checkerboard, the order
        the reference has.
      */
      const wordmarkAt =
        checkerEnd - CHECKER_SQUARES * SQUARE - WORDMARK_GAP * BAND_ACROSS;
      context.save();
      context.translate(wordmarkAt, height / 2);
      context.rotate(Math.PI);
      traceMountain(context, 0, -MOUNTAIN_ACROSS / 2, MOUNTAIN_ALONG);
      context.fill();
      context.font = font;
      context.textBaseline = "middle";
      context.fillText(WORDMARK, MOUNTAIN_ALONG * 1.2, 0);
      context.restore();

      /*
        The twill: a lit rib and the shadow it casts, running on the
        diagonal, over everything so the weave passes through the marks
        as well as around them.
      */
      context.lineWidth = 3;
      for (let k = -height; k < width + height; k += RIB_PITCH) {
        context.strokeStyle = RIB_LIGHT;
        context.beginPath();
        context.moveTo(k, 0);
        context.lineTo(k + height, height);
        context.stroke();

        context.strokeStyle = RIB_SHADOW;
        context.beginPath();
        context.moveTo(k + RIB_PITCH / 2, 0);
        context.lineTo(k + RIB_PITCH / 2 + height, height);
        context.stroke();
      }

      // Selvedge: a real strap is denser at its edges and catches less
      // light. Last, so it stays a clean border over both the weave and
      // whatever a mark would otherwise spill into it.
      context.fillStyle = SELVEDGE_INK;
      context.fillRect(0, 0, width, SELVEDGE);
      context.fillRect(0, height - SELVEDGE, width, SELVEDGE);

      built = new THREE.CanvasTexture(canvas);
      built.wrapS = THREE.RepeatWrapping;
      built.wrapT = THREE.RepeatWrapping;
      setBandTexture(built);
    };

    void build();
    return () => {
      live = false;
      built?.dispose();
    };
  }, []);

  const [face, setFace] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!faceUrl) {
      setFace(null);
      return;
    }
    let live = true;
    const loader = new THREE.TextureLoader();
    loader.load(
      faceUrl,
      (loaded) => {
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
        onFaceReady();
      },
      undefined,
      () => {
        /*
          A face that will not load leaves the mesh wearing the demo card
          the model was exported with. Saying nothing here is what made
          that possible: the load had no error handler at all, so a 401
          from an expired session, or a render that five-hundred'd, ended
          as somebody else's product name on a participant's credential —
          silently, and looking like it had worked.

          Reporting nothing is the fix. `onFaceReady` never fires, the
          scene never claims to be live, and the static card underneath
          stays where it is.
        */
      },
    );
    return () => {
      live = false;
    };
  }, [faceUrl, onFaceReady]);

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

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], ROPE]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], ROPE]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], ROPE]);
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
      <group position={[0, ANCHOR - RIG_DROP, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[ROPE * 0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[ROPE, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[ROPE * 1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[ROPE * 2, 0, 0]}
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
          lineWidth={1.4}
          map={bandTexture}
          repeat={[-BAND_REPEATS, 1]}
          resolution={[size.width, size.height]}
          useMap
        />
      </mesh>
    </>
  );
}

useGLTF.preload(CARD_MODEL);
